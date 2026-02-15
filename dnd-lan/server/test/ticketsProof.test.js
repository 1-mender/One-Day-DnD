import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-tickets-proof-test-"));
process.env.DND_LAN_DATA_DIR = tmpDir;

const { getDb, getPartyId, initDb } = await import("../src/db.js");
const { ticketsRouter } = await import("../src/routes/tickets.js");
const { now } = await import("../src/util.js");

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
  const partyId = getPartyId();
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
  ).run(token, playerId, getPartyId(), t, t + 24 * 60 * 60 * 1000, 0, 0, 0);
  return token;
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
    body: { gameKey: "ttt", outcome: "win", performance: "normal" }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});

test("play accepts valid ttt payload with issued seed/proof token", async () => {
  const playerId = createPlayer("Proofed");
  const token = createSession(playerId);
  const payload = {
    moves: [0, 3, 1, 4, 2],
    playerSymbol: "X",
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
      proof: seedOut.data.proof
    }
  });

  assert.equal(out.res.status, 200);
  assert.equal(out.data?.result?.outcome, "win");
});

test("issued seed/proof token is one-time", async () => {
  const playerId = createPlayer("SingleUse");
  const token = createSession(playerId);
  const payload = {
    moves: [0, 3, 1, 4, 2],
    playerSymbol: "X",
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
      proof: seedOut.data.proof
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
      proof: seedOut.data.proof
    }
  });
  assert.equal(second.res.status, 400);
  assert.equal(second.data.error, "invalid_seed");
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
        score: 10,
        target: 120,
        size: 6,
        maxRun: 3,
        movesUsed: 12
      },
      seed: seedOut.data.seed,
      proof: seedOut.data.proof
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

  const out = await api("/api/tickets/play", {
    method: "POST",
    token,
    body: {
      gameKey: "scrabble",
      outcome: "win",
      performance: "rare",
      payload: {
        word: "\u0410\u0411\u0412",
        rack: ["\u0410", "\u0411", "\u0412", "\u0413", "\u0414", "\u0415", "\u0416"]
      },
      seed: seedOut.data.seed,
      proof: seedOut.data.proof
    }
  });

  assert.equal(out.res.status, 400);
  assert.equal(out.data.error, "invalid_proof");
});
