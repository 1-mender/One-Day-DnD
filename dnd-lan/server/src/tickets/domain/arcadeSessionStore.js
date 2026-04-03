import crypto from "node:crypto";
import { GAME_CATALOG } from "../../gameCatalog.js";
import {
  createMatch3Session,
  getMatch3Performance,
  getMatch3Status,
  tryMatch3Move
} from "../../../../shared/match3Domain.js";
import { makePlayClientProof } from "./playValidation.js";

const SUITS = Object.freeze(["hearts", "diamonds", "clubs", "spades"]);
const SUIT_LABELS = Object.freeze({
  hearts: "Черви",
  diamonds: "Бубны",
  clubs: "Трефы",
  spades: "Пики"
});
const SCRABBLE_RARE = new Set(["Ф", "Щ", "Ъ", "Э", "Ю", "Я"]);
const SCRABBLE_ALPHABET = new Set(Array.from("АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЭЮЯ"));
const SCRABBLE_LETTERS = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЭЮЯ";
const DICE_CATEGORY_SCORE = Object.freeze({
  high: 0,
  pair: 1,
  two_pairs: 2,
  three: 3,
  straight: 4,
  full_house: 5,
  four: 6,
  five: 7
});
const TTT_LINES = Object.freeze([
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
]);
const TTT_CORNERS = Object.freeze([0, 2, 6, 8]);
const TTT_SIDES = Object.freeze([1, 3, 5, 7]);

function makeSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

function makeSeed() {
  return crypto.randomBytes(16).toString("hex");
}

function makeProof() {
  return crypto.randomBytes(16).toString("hex");
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

function shuffleWithSeed(list, seed) {
  const rng = makeRng(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function rollDice(seed, suffix) {
  const rng = makeRng(`${seed}:${suffix}`);
  return Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
}

function classifyDiceRoll(values) {
  const dice = Array.isArray(values) ? values.map((value) => Number(value)) : [];
  if (dice.length !== 5 || !dice.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)) {
    return "high";
  }
  const counts = new Map();
  for (const value of dice) counts.set(value, (counts.get(value) || 0) + 1);
  const groups = Array.from(counts.values()).sort((left, right) => right - left);
  const sorted = dice.slice().sort((left, right) => left - right);
  const isStraight = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);

  if (groups[0] === 5) return "five";
  if (groups[0] === 4) return "four";
  if (groups[0] === 3 && groups[1] === 2) return "full_house";
  if (isStraight) return "straight";
  if (groups[0] === 3) return "three";
  if (groups[0] === 2 && groups[1] === 2) return "two_pairs";
  if (groups[0] === 2) return "pair";
  return "high";
}

function getDicePerformance(outcome, category) {
  if (outcome !== "win") return "normal";
  const score = Number(DICE_CATEGORY_SCORE[String(category || "").toLowerCase()] || 0);
  if (score >= 6) return "elite";
  if (score >= 4) return "smart";
  return "normal";
}

function normalizeScrabbleWord(word) {
  return String(word || "").trim().toUpperCase();
}

function buildScrabbleRack(seed, rackSize) {
  const size = Number(rackSize || 0);
  if (!seed || !Number.isInteger(size) || size < 3 || size > 12) return [];
  const rng = makeRng(`${seed}:scrabble:${size}`);
  return Array.from({ length: size }, () => SCRABBLE_LETTERS[Math.floor(rng() * SCRABBLE_LETTERS.length)]);
}

function canFormScrabbleWord(word, rack) {
  if (word.length < 3) return false;
  const letters = rack.slice();
  for (const ch of word) {
    const idx = letters.indexOf(ch);
    if (idx === -1) return false;
    letters.splice(idx, 1);
  }
  return true;
}

function getCatalogMode(gameKey, modeKey) {
  const game = GAME_CATALOG.find((item) => item?.key === gameKey) || null;
  if (!game) return null;
  const safeModeKey = String(modeKey || "").trim().toLowerCase();
  return game.modes?.find((mode) => String(mode?.key || "").trim().toLowerCase() === safeModeKey) || null;
}

function getTttWinnerLine(board) {
  for (const [a, b, c] of TTT_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [a, b, c];
  }
  return null;
}

function getTttWinner(board) {
  const line = getTttWinnerLine(board);
  return line ? board[line[0]] : null;
}

function findTttWinningMove(board, symbol) {
  for (const [a, b, c] of TTT_LINES) {
    const line = [board[a], board[b], board[c]];
    const empties = [a, b, c].filter((idx) => !board[idx]);
    if (empties.length !== 1) continue;
    const filled = line.filter(Boolean);
    if (filled.length === 2 && filled.every((value) => value === symbol)) return empties[0];
  }
  return null;
}

function pickTttAiMove(board) {
  const win = findTttWinningMove(board, "O");
  if (win != null) return win;
  const block = findTttWinningMove(board, "X");
  if (block != null) return block;
  if (!board[4]) return 4;
  for (const idx of TTT_CORNERS) {
    if (!board[idx]) return idx;
  }
  for (const idx of TTT_SIDES) {
    if (!board[idx]) return idx;
  }
  return null;
}

function buildGuessDeck(seed, ranks) {
  const cards = [];
  let cardId = 1;
  for (const suit of SUITS) {
    for (const rank of ranks) {
      cards.push({
        id: `g${cardId++}`,
        suit,
        rank,
        color: suit === "hearts" || suit === "diamonds" ? "red" : "black",
        revealed: false
      });
    }
  }
  return shuffleWithSeed(cards, seed);
}

function getGuessHints(target, attempt, hintCount) {
  if (!target) return [];
  const hints = [
    `Цвет: ${target.color === "red" ? "красная" : "чёрная"}`,
    `Масть: ${SUIT_LABELS[target.suit] || target.suit}`,
    `Ранг: ${target.rank}`
  ];
  const visibleCount = Math.max(0, Math.min(hints.length, Number(attempt || 1), Number(hintCount || hints.length)));
  return hints.slice(0, visibleCount);
}

function getGuessPublicDeck(cards, status) {
  return cards.map((card) => {
    const revealed = status !== "playing" || card.revealed === true;
    return revealed
      ? {
          id: card.id,
          revealed: true,
          suit: card.suit,
          rank: card.rank,
          color: card.color
        }
      : {
          id: card.id,
          revealed: false
        };
  });
}

function buildGuessSnapshot(session, nowFn) {
  const state = session.state;
  const mode = session.mode;
  const timeLimitMs = Math.max(0, Number(mode.timeLimit || 0) * 1000);
  const elapsedMs = Math.max(0, nowFn() - Number(session.issuedAt || 0));
  const timeLeftMs = Math.max(0, timeLimitMs - elapsedMs);
  return {
    sessionId: session.id,
    gameKey: session.gameKey,
    modeKey: session.modeKey,
    state: {
      status: state.status,
      attempt: Math.min(state.attempt, Number(mode.maxAttempts || 1)),
      maxAttempts: Number(mode.maxAttempts || 1),
      timeLimit: Number(mode.timeLimit || 0),
      timeLeftMs,
      hints: getGuessHints(state.target, state.attempt, mode.hintCount),
      deck: getGuessPublicDeck(state.deck, state.status),
      target: state.status === "playing"
        ? null
        : {
            suit: state.target?.suit || "",
            rank: state.target?.rank || ""
          }
    }
  };
}

function createGuessSession({ playerId, modeKey, nowFn, ttlMs }) {
  const mode = getCatalogMode("guess", modeKey);
  if (!mode) return { error: "invalid_game" };

  const seed = makeSeed();
  const deck = buildGuessDeck(seed, mode.ranks);
  const targetRng = makeRng(`${seed}-target`);
  const target = deck[Math.floor(targetRng() * deck.length)] || null;
  const session = {
    id: makeSessionId(),
    playerId,
    gameKey: "guess",
    modeKey: String(mode.key || "normal"),
    mode,
    seed,
    proof: makeProof(),
    issuedAt: nowFn(),
    expiresAt: nowFn() + ttlMs,
    state: {
      status: "playing",
      attempt: 1,
      winAttempt: 0,
      picks: [],
      deck,
      target
    }
  };
  return { session, snapshot: buildGuessSnapshot(session, nowFn) };
}

function expireGuessByTimer(session, nowFn) {
  if (session.state.status !== "playing") return;
  const timeLimitMs = Math.max(0, Number(session.mode?.timeLimit || 0) * 1000);
  if (timeLimitMs <= 0) return;
  const elapsedMs = Math.max(0, nowFn() - Number(session.issuedAt || 0));
  if (elapsedMs >= timeLimitMs) {
    session.state.status = "loss";
  }
}

function applyGuessMove(session, body, nowFn) {
  expireGuessByTimer(session, nowFn);
  if (session.state.status !== "playing") return { error: "game_already_finished" };

  const cardId = String(body?.cardId || "").trim();
  const card = session.state.deck.find((item) => item.id === cardId) || null;
  if (!card || card.revealed) return { error: "invalid_move" };

  card.revealed = true;
  session.state.picks.push({ suit: card.suit, rank: card.rank });

  if (session.state.target?.id === card.id) {
    session.state.status = "win";
    session.state.winAttempt = session.state.attempt;
  } else {
    session.state.attempt += 1;
    if (session.state.attempt > Number(session.mode?.maxAttempts || 1)) {
      session.state.status = "loss";
    }
  }

  return { snapshot: buildGuessSnapshot(session, nowFn) };
}

function buildGuessFinishPayload(session, nowFn) {
  expireGuessByTimer(session, nowFn);
  if (session.state.status === "playing") return { error: "game_not_finished" };

  const outcome = session.state.status === "win" ? "win" : "loss";
  const performance = outcome === "win"
    ? (session.state.winAttempt === 1 ? "first" : session.state.winAttempt === 2 ? "second" : "third")
    : "normal";
  const payload = {
    modeKey: session.modeKey,
    picks: session.state.picks.slice(),
    outcome
  };
  return {
    snapshot: buildGuessSnapshot(session, nowFn),
    issuedSeed: {
      seed: session.seed,
      proof: session.proof,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt
    },
    playBody: {
      gameKey: session.gameKey,
      outcome,
      performance,
      payload,
      seed: session.seed,
      proof: session.proof,
      clientProof: makePlayClientProof(session.seed, session.proof, {
        gameKey: session.gameKey,
        outcome,
        performance,
        payload
      })
    }
  };
}

function buildMatch3Snapshot(session) {
  const domain = session.state.domain;
  return {
    sessionId: session.id,
    gameKey: session.gameKey,
    modeKey: session.modeKey,
    state: {
      status: getMatch3Status(domain),
      board: domain.board.slice(),
      score: Number(domain.score || 0),
      movesUsed: Number(domain.movesUsed || 0),
      movesLeft: Math.max(0, Number(domain.config?.moves || 0) - Number(domain.movesUsed || 0)),
      target: Number(domain.config?.target || 0),
      size: Number(domain.config?.size || 0),
      comboCount: Number(session.state.comboCount || 0),
      maxRunThisMove: Number(session.state.maxRunThisMove || 0),
      reshuffled: session.state.reshuffled === true
    }
  };
}

function createMatch3ArcadeSession({ playerId, modeKey, nowFn, ttlMs }) {
  const mode = getCatalogMode("match3", modeKey);
  if (!mode) return { error: "invalid_game" };

  const seed = makeSeed();
  const session = {
    id: makeSessionId(),
    playerId,
    gameKey: "match3",
    modeKey: String(mode.key || "normal"),
    mode,
    seed,
    proof: makeProof(),
    issuedAt: nowFn(),
    expiresAt: nowFn() + ttlMs,
    state: {
      domain: createMatch3Session(seed, mode),
      moves: [],
      comboCount: 0,
      maxRunThisMove: 0,
      reshuffled: false
    }
  };
  return { session, snapshot: buildMatch3Snapshot(session) };
}

function applyMatch3Move(session, body) {
  if (getMatch3Status(session.state.domain) !== "playing") {
    return { error: "game_already_finished" };
  }

  const from = Number(body?.from);
  const to = Number(body?.to);
  const applied = tryMatch3Move(session.state.domain, from, to);
  if (!applied.valid) return { error: "invalid_move" };

  session.state.moves.push({ from, to });
  session.state.comboCount = Number(applied.comboCount || 0);
  session.state.maxRunThisMove = Number(applied.maxRunThisMove || 0);
  session.state.reshuffled = applied.reshuffled === true;

  return { snapshot: buildMatch3Snapshot(session) };
}

function buildMatch3FinishPayload(session) {
  const outcome = getMatch3Status(session.state.domain);
  if (outcome === "playing") return { error: "game_not_finished" };

  const performance = getMatch3Performance(session.state.domain, outcome);
  const payload = {
    modeKey: session.modeKey,
    moves: session.state.moves.slice()
  };

  return {
    snapshot: buildMatch3Snapshot(session),
    issuedSeed: {
      seed: session.seed,
      proof: session.proof,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt
    },
    playBody: {
      gameKey: session.gameKey,
      outcome,
      performance,
      payload,
      seed: session.seed,
      proof: session.proof,
      clientProof: makePlayClientProof(session.seed, session.proof, {
        gameKey: session.gameKey,
        outcome,
        performance,
        payload
      })
    }
  };
}

function buildDiceSnapshot(session, nowFn) {
  const state = session.state;
  const mode = session.mode;
  const timeLimitMs = Math.max(0, Number(mode.timeLimit || 0) * 1000);
  const elapsedMs = Math.max(0, nowFn() - Number(session.issuedAt || 0));
  const timeLeftMs = Math.max(0, timeLimitMs - elapsedMs);
  const currentCategory = classifyDiceRoll(state.currentRoll);
  const currentScore = Number(DICE_CATEGORY_SCORE[currentCategory] || 0);

  return {
    sessionId: session.id,
    gameKey: session.gameKey,
    modeKey: session.modeKey,
    state: {
      status: state.status,
      timeLimit: Number(mode.timeLimit || 0),
      timeLeftMs,
      allowReroll: mode.allowReroll !== false,
      targetScore: Number(mode.targetScore || 0),
      rerollMask: state.rerollMask.slice(),
      rerolled: state.rerolled === true,
      currentRoll: state.currentRoll.slice(),
      currentCategory,
      currentScore
    }
  };
}

function createDiceSession({ playerId, modeKey, nowFn, ttlMs }) {
  const mode = getCatalogMode("dice", modeKey);
  if (!mode) return { error: "invalid_game" };
  const seed = makeSeed();
  const firstRoll = rollDice(seed, "roll1");
  const session = {
    id: makeSessionId(),
    playerId,
    gameKey: "dice",
    modeKey: String(mode.key || "classic"),
    mode,
    seed,
    proof: makeProof(),
    issuedAt: nowFn(),
    expiresAt: nowFn() + ttlMs,
    state: {
      status: "playing",
      currentRoll: firstRoll,
      rerollMask: [0, 0, 0, 0, 0],
      rerolled: false,
      finalCategory: classifyDiceRoll(firstRoll)
    }
  };
  return { session, snapshot: buildDiceSnapshot(session, nowFn) };
}

function expireDiceByTimer(session, nowFn) {
  if (session.state.status !== "playing") return;
  const timeLimitMs = Math.max(0, Number(session.mode?.timeLimit || 0) * 1000);
  if (timeLimitMs <= 0) return;
  const elapsedMs = Math.max(0, nowFn() - Number(session.issuedAt || 0));
  if (elapsedMs < timeLimitMs) return;
  const category = classifyDiceRoll(session.state.currentRoll);
  const score = Number(DICE_CATEGORY_SCORE[category] || 0);
  session.state.finalCategory = category;
  session.state.status = score >= Number(session.mode?.targetScore || 0) ? "win" : "loss";
}

function applyDiceMove(session, body, nowFn) {
  expireDiceByTimer(session, nowFn);
  if (session.state.status !== "playing") return { error: "game_already_finished" };
  if (session.mode?.allowReroll === false || session.state.rerolled) return { error: "invalid_move" };

  const rawMask = Array.isArray(body?.rerollMask) ? body.rerollMask : [];
  if (rawMask.length !== 5 || rawMask.some((value) => ![0, 1, true, false].includes(value))) {
    return { error: "invalid_move" };
  }
  const rerollMask = rawMask.map((value) => (value === true || value === 1 ? 1 : 0));
  if (!rerollMask.some(Boolean)) return { error: "invalid_move" };

  const rerollValues = rollDice(session.seed, "reroll");
  session.state.currentRoll = session.state.currentRoll.map((value, index) => (
    rerollMask[index] ? rerollValues[index] : value
  ));
  session.state.rerollMask = rerollMask;
  session.state.rerolled = true;
  session.state.finalCategory = classifyDiceRoll(session.state.currentRoll);

  return { snapshot: buildDiceSnapshot(session, nowFn) };
}

function buildDiceFinishPayload(session, nowFn) {
  expireDiceByTimer(session, nowFn);
  if (session.state.status === "playing") {
    const category = classifyDiceRoll(session.state.currentRoll);
    const score = Number(DICE_CATEGORY_SCORE[category] || 0);
    session.state.finalCategory = category;
    session.state.status = score >= Number(session.mode?.targetScore || 0) ? "win" : "loss";
  }

  const outcome = session.state.status === "win" ? "win" : "loss";
  const performance = getDicePerformance(outcome, session.state.finalCategory);
  const payload = {
    modeKey: session.modeKey,
    targetScore: Number(session.mode?.targetScore || 0),
    rerollMask: session.state.rerollMask.slice(),
    usedReroll: session.state.rerolled === true,
    finalCategory: session.state.finalCategory
  };

  return {
    snapshot: buildDiceSnapshot(session, nowFn),
    issuedSeed: {
      seed: session.seed,
      proof: session.proof,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt
    },
    playBody: {
      gameKey: session.gameKey,
      outcome,
      performance,
      payload,
      seed: session.seed,
      proof: session.proof,
      clientProof: makePlayClientProof(session.seed, session.proof, {
        gameKey: session.gameKey,
        outcome,
        performance,
        payload
      })
    }
  };
}

function buildScrabbleSnapshot(session, nowFn) {
  const state = session.state;
  const mode = session.mode;
  const timeLimitMs = Math.max(0, Number(mode.timeLimit || 0) * 1000);
  const elapsedMs = Math.max(0, nowFn() - Number(session.issuedAt || 0));
  const timeLeftMs = Math.max(0, timeLimitMs - elapsedMs);

  return {
    sessionId: session.id,
    gameKey: session.gameKey,
    modeKey: session.modeKey,
    state: {
      status: state.status,
      timeLimit: Number(mode.timeLimit || 0),
      timeLeftMs,
      rack: state.rack.slice(),
      word: state.word
    }
  };
}

function createScrabbleSession({ playerId, modeKey, nowFn, ttlMs }) {
  const mode = getCatalogMode("scrabble", modeKey);
  if (!mode) return { error: "invalid_game" };
  const seed = makeSeed();
  const rack = buildScrabbleRack(seed, Number(mode.rackSize || 7));
  const session = {
    id: makeSessionId(),
    playerId,
    gameKey: "scrabble",
    modeKey: String(mode.key || "normal"),
    mode,
    seed,
    proof: makeProof(),
    issuedAt: nowFn(),
    expiresAt: nowFn() + ttlMs,
    state: {
      status: "playing",
      rack,
      word: ""
    }
  };
  return { session, snapshot: buildScrabbleSnapshot(session, nowFn) };
}

function expireScrabbleByTimer(session, nowFn) {
  if (session.state.status !== "playing") return;
  const timeLimitMs = Math.max(0, Number(session.mode?.timeLimit || 0) * 1000);
  if (timeLimitMs <= 0) return;
  const elapsedMs = Math.max(0, nowFn() - Number(session.issuedAt || 0));
  if (elapsedMs >= timeLimitMs) {
    session.state.status = "loss";
  }
}

function applyScrabbleMove(session, body, nowFn) {
  expireScrabbleByTimer(session, nowFn);
  if (session.state.status !== "playing") return { error: "game_already_finished" };

  const word = normalizeScrabbleWord(body?.word);
  if (!word || !Array.from(word).every((ch) => SCRABBLE_ALPHABET.has(ch))) {
    session.state.status = "loss";
    session.state.word = word;
    return { snapshot: buildScrabbleSnapshot(session, nowFn) };
  }

  session.state.word = word;
  session.state.status = canFormScrabbleWord(word, session.state.rack) ? "win" : "loss";
  return { snapshot: buildScrabbleSnapshot(session, nowFn) };
}

function buildScrabbleFinishPayload(session, nowFn) {
  expireScrabbleByTimer(session, nowFn);
  if (session.state.status === "playing") return { error: "game_not_finished" };

  const outcome = session.state.status === "win" ? "win" : "loss";
  const word = normalizeScrabbleWord(session.state.word);
  const hasRare = Array.from(word).some((ch) => SCRABBLE_RARE.has(ch));
  const performance = outcome === "win"
    ? (word.length >= 6 ? "long" : hasRare ? "rare" : "normal")
    : "normal";
  const payload = {
    modeKey: session.modeKey,
    word
  };

  return {
    snapshot: buildScrabbleSnapshot(session, nowFn),
    issuedSeed: {
      seed: session.seed,
      proof: session.proof,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt
    },
    playBody: {
      gameKey: session.gameKey,
      outcome,
      performance,
      payload,
      seed: session.seed,
      proof: session.proof,
      clientProof: makePlayClientProof(session.seed, session.proof, {
        gameKey: session.gameKey,
        outcome,
        performance,
        payload
      })
    }
  };
}

function buildTttSnapshot(session) {
  const state = session.state;
  return {
    sessionId: session.id,
    gameKey: session.gameKey,
    modeKey: session.modeKey,
    state: {
      status: state.status,
      board: state.board.slice(),
      playerWins: Number(state.playerWins || 0),
      aiWins: Number(state.aiWins || 0),
      roundsToWin: Number(session.mode?.roundsToWin || 1),
      winnerLine: Array.isArray(state.winnerLine) ? state.winnerLine.slice() : null
    }
  };
}

function createTttSession({ playerId, modeKey, nowFn, ttlMs }) {
  const mode = getCatalogMode("ttt", modeKey);
  if (!mode) return { error: "invalid_game" };

  const session = {
    id: makeSessionId(),
    playerId,
    gameKey: "ttt",
    modeKey: String(mode.key || "normal"),
    mode,
    seed: makeSeed(),
    proof: makeProof(),
    issuedAt: nowFn(),
    expiresAt: nowFn() + ttlMs,
    state: {
      status: "playing",
      board: Array(9).fill(null),
      winnerLine: null,
      moves: [],
      rounds: [],
      playerWins: 0,
      aiWins: 0
    }
  };
  return { session, snapshot: buildTttSnapshot(session) };
}

function commitTttRound(session, outcome) {
  const state = session.state;
  state.rounds.push({
    moves: state.moves.slice(),
    outcome
  });

  if (outcome === "win") state.playerWins += 1;
  if (outcome === "loss") state.aiWins += 1;

  const roundsToWin = Number(session.mode?.roundsToWin || 1);
  const isFinished = state.playerWins >= roundsToWin || state.aiWins >= roundsToWin;
  if (isFinished) {
    state.status = state.playerWins >= roundsToWin ? "win" : "loss";
    return;
  }

  state.board = Array(9).fill(null);
  state.winnerLine = null;
  state.moves = [];
}

function maybeCompleteTttRound(session) {
  const state = session.state;
  const winner = getTttWinner(state.board);
  if (winner) {
    state.winnerLine = getTttWinnerLine(state.board);
    commitTttRound(session, winner === "X" ? "win" : "loss");
    return true;
  }

  if (!state.board.some((value) => !value)) {
    state.winnerLine = null;
    commitTttRound(session, "draw");
    return true;
  }

  return false;
}

function applyTttMove(session, body) {
  if (session.state.status !== "playing") return { error: "game_already_finished" };

  const index = Number(body?.index);
  if (!Number.isInteger(index) || index < 0 || index > 8 || session.state.board[index]) {
    return { error: "invalid_move" };
  }

  session.state.board[index] = "X";
  session.state.moves.push(index);
  if (maybeCompleteTttRound(session)) {
    return { snapshot: buildTttSnapshot(session) };
  }

  const aiMove = pickTttAiMove(session.state.board);
  if (aiMove == null || session.state.board[aiMove]) {
    return { error: "invalid_move" };
  }

  session.state.board[aiMove] = "O";
  session.state.moves.push(aiMove);
  maybeCompleteTttRound(session);

  return { snapshot: buildTttSnapshot(session) };
}

function buildTttFinishPayload(session) {
  if (session.state.status === "playing") return { error: "game_not_finished" };

  const outcome = session.state.status === "win" ? "win" : "loss";
  const performance = outcome === "win" && Number(session.state.aiWins || 0) === 0 && Number(session.mode?.roundsToWin || 1) > 1
    ? "sweep"
    : "normal";
  const payload = {
    modeKey: session.modeKey,
    rounds: session.state.rounds.map((round) => ({
      moves: Array.isArray(round?.moves) ? round.moves.slice() : [],
      outcome: String(round?.outcome || "")
    })),
    playerSymbol: "X",
    aiWins: Number(session.state.aiWins || 0),
    playerWins: Number(session.state.playerWins || 0),
    outcome
  };

  return {
    snapshot: buildTttSnapshot(session),
    issuedSeed: {
      seed: session.seed,
      proof: session.proof,
      issuedAt: session.issuedAt,
      expiresAt: session.expiresAt
    },
    playBody: {
      gameKey: session.gameKey,
      outcome,
      performance,
      payload,
      seed: session.seed,
      proof: session.proof,
      clientProof: makePlayClientProof(session.seed, session.proof, {
        gameKey: session.gameKey,
        outcome,
        performance,
        payload
      })
    }
  };
}

export function createArcadeSessionStore({ ttlMs, nowFn }) {
  const sessions = new Map();
  const playerSessionIndex = new Map();

  function cleanupExpired() {
    const t = nowFn();
    for (const [sessionId, session] of sessions.entries()) {
      if (Number(session?.expiresAt || 0) >= t) continue;
      sessions.delete(sessionId);
      if (playerSessionIndex.get(`${session.playerId}:${session.gameKey}`) === sessionId) {
        playerSessionIndex.delete(`${session.playerId}:${session.gameKey}`);
      }
    }
  }

  function deleteIndexedSession(playerId, gameKey) {
    const key = `${playerId}:${gameKey}`;
    const oldSessionId = playerSessionIndex.get(key);
    if (oldSessionId) sessions.delete(oldSessionId);
    playerSessionIndex.delete(key);
  }

  function getSession(playerId, sessionId) {
    cleanupExpired();
    const session = sessions.get(String(sessionId || "")) || null;
    if (!session || Number(session.playerId) !== Number(playerId)) return null;
    return session;
  }

  function startSession(playerId, gameKey, body = {}) {
    cleanupExpired();
    const safeGameKey = String(gameKey || "").trim().toLowerCase();
    if (!["guess", "match3", "dice", "scrabble", "ttt"].includes(safeGameKey)) return { error: "unsupported_game" };
    deleteIndexedSession(playerId, safeGameKey);

    const args = {
      playerId,
      modeKey: body?.modeKey,
      nowFn,
      ttlMs
    };
    const created = safeGameKey === "guess"
      ? createGuessSession(args)
      : safeGameKey === "match3"
        ? createMatch3ArcadeSession(args)
      : safeGameKey === "dice"
        ? createDiceSession(args)
      : safeGameKey === "scrabble"
        ? createScrabbleSession(args)
        : createTttSession(args);
    if (created.error) return created;

    sessions.set(created.session.id, created.session);
    playerSessionIndex.set(`${playerId}:${safeGameKey}`, created.session.id);
    return { snapshot: created.snapshot };
  }

  function moveSession(playerId, sessionId, body = {}) {
    const session = getSession(playerId, sessionId);
    if (!session) return { error: "invalid_session" };
    if (session.gameKey === "guess") return applyGuessMove(session, body, nowFn);
    if (session.gameKey === "match3") return applyMatch3Move(session, body);
    if (session.gameKey === "dice") return applyDiceMove(session, body, nowFn);
    if (session.gameKey === "scrabble") return applyScrabbleMove(session, body, nowFn);
    if (session.gameKey === "ttt") return applyTttMove(session, body);
    return { error: "unsupported_game" };
  }

  function finishSession(playerId, sessionId) {
    const session = getSession(playerId, sessionId);
    if (!session) return { error: "invalid_session" };

    let built;
    if (session.gameKey === "guess") built = buildGuessFinishPayload(session, nowFn);
    else if (session.gameKey === "match3") built = buildMatch3FinishPayload(session);
    else if (session.gameKey === "dice") built = buildDiceFinishPayload(session, nowFn);
    else if (session.gameKey === "scrabble") built = buildScrabbleFinishPayload(session, nowFn);
    else if (session.gameKey === "ttt") built = buildTttFinishPayload(session);
    else built = { error: "unsupported_game" };
    if (built.error) return built;

    sessions.delete(session.id);
    if (playerSessionIndex.get(`${session.playerId}:${session.gameKey}`) === session.id) {
      playerSessionIndex.delete(`${session.playerId}:${session.gameKey}`);
    }
    return built;
  }

  return { startSession, moveSession, finishSession };
}
