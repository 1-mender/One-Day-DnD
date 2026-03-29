import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-tickets-proof-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { getDb, getSinglePartyId, initDb } = await import("../src/db.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");
const { buildSeededScrabbleRack } = await import("../src/tickets/domain/playValidation.js");
const {
  createMatch3Session,
  findFirstMatch3ValidMove,
  getMatch3Performance,
  getMatch3Status,
  tryMatch3Move
} = await import("../../shared/match3Domain.js");

initDb();

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use("/api/tickets", ticketsRouter);

const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => {
  server.close();
});

function createPlayer(displayName = "Player") {
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  return db.prepare(
    "INSERT INTO players(party_id, display_name, status, last_seen, banned, created_at) VALUES(?,?,?,?,?,?)"
  ).run(partyId, displayName, "offline", t, 0, t).lastInsertRowid;
}

function createSession(playerId) {
  const db = getDb();
  const t = now();
  const token = `tok_${playerId}_${t}`;
  db.prepare(
    "INSERT INTO sessions(token, player_id, party_id, created_at, expires_at, revoked, impersonated, impersonated_write) VALUES(?,?,?,?,?,?,?,?)"
  ).run(token, playerId, getSinglePartyId(), t, t + 24 * 60 * 60 * 1000, 0, 0, 0);
  return token;
}

function seedTickets(playerId, balance = 20) {
  const db = getDb();
  const t = now();
  db.prepare(
    "INSERT INTO tickets(player_id, balance, daily_earned, daily_spent, updated_at) VALUES(?,?,?,?,?)"
  ).run(playerId, balance, 0, 0, t);
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function makeClientProof(seed, data) {
  return simpleHash(`${seed || ""}:${JSON.stringify(data || {})}`);
}

function makeRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return (h & 0xfffffff) / 0xfffffff;
  };
}

function rollDice(seed, suffix) {
  const rng = makeRng(`${seed}:${suffix}`);
  return Array.from({ length: 5 }, () => Math.floor(rng() * 6) + 1);
}

function shuffleWithSeed(list, seed) {
  const rng = makeRng(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getGuessTarget(seed, ranks = ["A", "K", "Q", "J"]) {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) deck.push({ suit, rank });
  }
  const shuffled = shuffleWithSeed(deck, seed);
  const rng = makeRng(`${seed}-target`);
  return shuffled[Math.floor(rng() * shuffled.length)];
}

function classifyDiceRoll(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const counts = new Map();
  for (const value of sorted) counts.set(value, (counts.get(value) || 0) + 1);
  const groups = Array.from(counts.values()).sort((left, right) => right - left);
  const distinct = Array.from(counts.keys()).sort((left, right) => left - right);
  const isStraight = distinct.length === 5 && distinct.every((value, index) => value === distinct[0] + index);

  if (groups[0] === 5) return "five";
  if (groups[0] === 4) return "four";
  if (groups[0] === 3 && groups[1] === 2) return "full_house";
  if (isStraight) return "straight";
  if (groups[0] === 3) return "three";
  if (groups[0] === 2 && groups[1] === 2) return "two_pairs";
  if (groups[0] === 2) return "pair";
  return "high";
}

function diceScore(category) {
  return {
    high: 0,
    pair: 1,
    two_pairs: 2,
    three: 3,
    straight: 4,
    full_house: 5,
    four: 6,
    five: 7
  }[category] ?? 0;
}

async function api(pathname, { method = "GET", token = "", body } = {}) {
  const headers = {};
  if (token) headers["x-player-token"] = token;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

test("play rejects submission without payload/proof", async () => {
  const playerId = createPlayer("Proofless");
  const token = createSession(playerId);

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "ttt",
      outcome: "win",
      performance: "normal",
      clientProof: makeClientProof("", {
        gameKey: "ttt",
        outcome: "win",
        performance: "normal",
        payload: {}
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("play accepts valid ttt payload with issued seed/proof token", async () => {
  const playerId = createPlayer("Proofed");
  const token = createSession(playerId);
  seedTickets(playerId, 20);
  const payload = {
    modeKey: "normal",
    rounds: [
      { moves: [0, 4, 7, 2, 6, 8, 3], outcome: "win" },
      { moves: [0, 4, 7, 2, 6, 8, 3], outcome: "win" }
    ],
    playerSymbol: "X",
    aiWins: 0,
    playerWins: 2,
    outcome: "win"
  };

  const seedOut = await api("/api/tickets/seed?gameKey=ttt", { token });
  assert.equal(seedOut.res.status, 200);
  assert.ok(seedOut.data?.seed);
  assert.ok(seedOut.data?.proof);

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "ttt",
      outcome: "win",
      performance: "normal",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "ttt",
        outcome: "win",
        performance: "normal",
        payload
      })
    }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data?.result?.outcome, "win");
});

test("issued seed/proof token is one-time", async () => {
  const playerId = createPlayer("SingleUse");
  const token = createSession(playerId);
  seedTickets(playerId, 20);
  const payload = {
    modeKey: "normal",
    rounds: [
      { moves: [0, 4, 7, 2, 6, 8, 3], outcome: "win" },
      { moves: [0, 4, 7, 2, 6, 8, 3], outcome: "win" }
    ],
    playerSymbol: "X",
    aiWins: 0,
    playerWins: 2,
    outcome: "win"
  };

  const seedOut = await api("/api/tickets/seed?gameKey=ttt", { token });
  assert.equal(seedOut.res.status, 200);

  const first = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "ttt",
      outcome: "win",
      performance: "normal",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "ttt",
        outcome: "win",
        performance: "normal",
        payload
      })
    }
  });
  assert.equal(first.res.status, 200);

  const second = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "ttt",
      outcome: "win",
      performance: "normal",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "ttt",
        outcome: "win",
        performance: "normal",
        payload
      })
    }
  });
  assert.equal(second.res.status, 400);
  assert.equal(second.data.error, "invalid_seed");
});

test("ttt rejects round sequence that does not match deterministic AI", async () => {
  const playerId = createPlayer("Ttt-Spoof");
  const token = createSession(playerId);

  const seedOut = await api("/api/tickets/seed?gameKey=ttt", { token });
  assert.equal(seedOut.res.status, 200);

  const payload = {
    modeKey: "normal",
    rounds: [
      { moves: [0, 3, 1, 4, 2], outcome: "win" },
      { moves: [0, 3, 1, 4, 2], outcome: "win" }
    ],
    playerSymbol: "X",
    aiWins: 0,
    playerWins: 2,
    outcome: "win"
  };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "ttt",
      outcome: "win",
      performance: "sweep",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "ttt",
        outcome: "win",
        performance: "sweep",
        payload
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("match3 win rejects payload with score below target", async () => {
  const playerId = createPlayer("Match3-Invalid");
  const token = createSession(playerId);

  const seedOut = await api("/api/tickets/seed?gameKey=match3", { token });
  assert.equal(seedOut.res.status, 200);

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "match3",
      outcome: "win",
      performance: "normal",
      payload: {
        modeKey: "normal",
        moves: []
      },
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "match3",
        outcome: "win",
        performance: "normal",
        payload: {
          modeKey: "normal",
          moves: []
        }
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("scrabble rare performance requires rare letter in word", async () => {
  const playerId = createPlayer("Scrabble-Rare");
  const token = createSession(playerId);

  const seedOut = await api("/api/tickets/seed?gameKey=scrabble", { token });
  assert.equal(seedOut.res.status, 200);
  const rack = buildSeededScrabbleRack(seedOut.data.seed, 7);
  const nonRareWord = rack.filter((ch) => !["Ф", "Щ", "Ъ", "Э", "Ю", "Я"].includes(ch)).slice(0, 3).join("");
  assert.equal(nonRareWord.length, 3);

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "scrabble",
      outcome: "win",
      performance: "rare",
      payload: {
        modeKey: "normal",
        word: nonRareWord
      },
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "scrabble",
        outcome: "win",
        performance: "rare",
        payload: {
          modeKey: "normal",
          word: nonRareWord
        }
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("scrabble ignores spoofed rack and validates against seeded letters", async () => {
  const playerId = createPlayer("Scrabble-Seeded");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const seedOut = await api("/api/tickets/seed?gameKey=scrabble", { token });
  assert.equal(seedOut.res.status, 200);
  const rack = buildSeededScrabbleRack(seedOut.data.seed, 7);
  const seededWord = rack.slice(0, 3).join("");
  assert.equal(seededWord.length, 3);

  const valid = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "scrabble",
      outcome: "win",
      performance: "normal",
      payload: {
        modeKey: "normal",
        word: seededWord,
        rack: ["Я", "Я", "Я", "Я", "Я", "Я", "Я"]
      },
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "scrabble",
        outcome: "win",
        performance: "normal",
        payload: {
          modeKey: "normal",
          word: seededWord,
          rack: ["Я", "Я", "Я", "Я", "Я", "Я", "Я"]
        }
      })
    }
  });

  assert.equal(valid.res.status, 200);

  const secondSeedOut = await api("/api/tickets/seed?gameKey=scrabble", { token });
  assert.equal(secondSeedOut.res.status, 200);

  const invalid = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "scrabble",
      outcome: "win",
      performance: "normal",
      payload: {
        modeKey: "normal",
        word: "ЯЯЯ",
        rack: ["Я", "Я", "Я", "Я", "Я", "Я", "Я"]
      },
      seed: secondSeedOut.data.seed,
      proof: secondSeedOut.data.proof,
      clientProof: makeClientProof(secondSeedOut.data.seed, {
        gameKey: "scrabble",
        outcome: "win",
        performance: "normal",
        payload: {
          modeKey: "normal",
          word: "ЯЯЯ",
          rack: ["Я", "Я", "Я", "Я", "Я", "Я", "Я"]
        }
      })
    }
  });

  assert.equal(invalid.res.status, 400);
  assert.equal(invalid.data.error, "invalid_proof");
});

test("dice accepts valid deterministic payload", async () => {
  const playerId = createPlayer("Dice-Valid");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const seedOut = await api("/api/tickets/seed?gameKey=dice", { token });
  assert.equal(seedOut.res.status, 200);

  const finalRoll = rollDice(seedOut.data.seed, "roll1");
  const finalCategory = classifyDiceRoll(finalRoll);
  const score = diceScore(finalCategory);
  const targetScore = 1;
  const outcome = score >= targetScore ? "win" : "loss";
  const performance = outcome === "win"
    ? (score >= 6 ? "elite" : score >= 4 ? "smart" : "normal")
    : "normal";
  const payload = {
    modeKey: "single",
    rerollMask: [0, 0, 0, 0, 0],
    targetScore,
    finalCategory,
    usedReroll: false
  };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "dice",
      outcome,
      performance,
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "dice",
        outcome,
        performance,
        payload
      })
    }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data?.result?.gameKey, "dice");
});

test("dice rejects mismatched category", async () => {
  const playerId = createPlayer("Dice-Invalid");
  const token = createSession(playerId);

  const seedOut = await api("/api/tickets/seed?gameKey=dice", { token });
  assert.equal(seedOut.res.status, 200);

  const payload = {
    modeKey: "single",
    rerollMask: [0, 0, 0, 0, 0],
    targetScore: 1,
    finalCategory: "five",
    usedReroll: false
  };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "dice",
      outcome: "win",
      performance: "elite",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "dice",
        outcome: "win",
        performance: "elite",
        payload
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("guess rejects spoofed first-attempt bonus when payload does not match seeded result", async () => {
  const playerId = createPlayer("Guess-Spoof");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const seedOut = await api("/api/tickets/seed?gameKey=guess", { token });
  assert.equal(seedOut.res.status, 200);
  const target = getGuessTarget(seedOut.data.seed);
  const picks = [
    { suit: "hearts", rank: "A" },
    { suit: "spades", rank: "A" },
    { suit: "clubs", rank: "A" },
    { suit: "diamonds", rank: "A" }
  ].filter((pick) => !(pick.suit === target.suit && pick.rank === target.rank)).slice(0, 3);
  assert.equal(picks.length, 3);

  const payload = {
    modeKey: "normal",
    picks,
    outcome: "win"
  };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "guess",
      outcome: "win",
      performance: "first",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "guess",
        outcome: "win",
        performance: "first",
        payload
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("guess hard mode uses mode-specific entry cost", async () => {
  const playerId = createPlayer("Guess-Hard-Cost");
  const token = createSession(playerId);
  seedTickets(playerId, 1);

  const seedOut = await api("/api/tickets/seed?gameKey=guess", { token });
  assert.equal(seedOut.res.status, 200);
  const target = getGuessTarget(seedOut.data.seed, ["A", "K", "Q", "J", "10"]);
  const payload = {
    modeKey: "hard",
    picks: [{ suit: target.suit, rank: target.rank }],
    outcome: "win"
  };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "guess",
      outcome: "win",
      performance: "first",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "guess",
        outcome: "win",
        performance: "first",
        payload
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "not_enough_tickets");
});

test("match3 rejects payload with mismatched mode settings", async () => {
  const playerId = createPlayer("Match3-Mode");
  const token = createSession(playerId);

  const seedOut = await api("/api/tickets/seed?gameKey=match3", { token });
  assert.equal(seedOut.res.status, 200);

  const payload = {
    modeKey: "compact",
    moves: [{ from: 0, to: 1 }]
  };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "match3",
      outcome: "win",
      performance: "normal",
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "match3",
        outcome: "win",
        performance: "normal",
        payload
      })
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("match3 accepts seeded replay with valid move history", async () => {
  const playerId = createPlayer("Match3-Seeded");
  const token = createSession(playerId);
  seedTickets(playerId, 20);

  const seedOut = await api("/api/tickets/seed?gameKey=match3", { token });
  assert.equal(seedOut.res.status, 200);

  const mode = { key: "compact", size: 5, moves: 14, target: 90, colors: 5, blocks: 0 };
  const session = createMatch3Session(seedOut.data.seed, mode);
  const moves = [];
  let guard = 0;
  while (getMatch3Status(session) === "playing" && guard < 20) {
    const move = findFirstMatch3ValidMove(session);
    assert.ok(move, "expected a valid move");
    const applied = tryMatch3Move(session, move.from, move.to);
    assert.equal(applied.valid, true);
    moves.push(move);
    guard += 1;
  }

  const outcome = getMatch3Status(session);
  assert.ok(outcome === "win" || outcome === "loss");
  const performance = getMatch3Performance(session, outcome);
  const payload = { modeKey: "compact", moves };

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "match3",
      outcome,
      performance,
      payload,
      seed: seedOut.data.seed,
      proof: seedOut.data.proof,
      clientProof: makeClientProof(seedOut.data.seed, {
        gameKey: "match3",
        outcome,
        performance,
        payload
      })
    }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data?.result?.gameKey, "match3");
});
