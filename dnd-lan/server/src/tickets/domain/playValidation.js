import crypto from "node:crypto";
import { GAME_CATALOG } from "../../gameCatalog.js";

const SCRABBLE_RARE = new Set(["\u0424", "\u0429", "\u042A", "\u042D", "\u042E", "\u042F"]);
const SCRABBLE_ALPHABET = new Set(Array.from("\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042D\u042E\u042F"));
const SCRABBLE_LETTERS = "\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042D\u042E\u042F";
const DICE_MODE_RULES = Object.freeze({
  classic: { allowReroll: true, targetScore: 2 },
  risk: { allowReroll: true, targetScore: 4 },
  single: { allowReroll: false, targetScore: 1 }
});
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

function getCatalogMode(gameKey, modeKey) {
  const game = GAME_CATALOG.find((item) => item?.key === gameKey) || null;
  if (!game) return null;
  const safeModeKey = String(modeKey || "").trim().toLowerCase();
  return game.modes?.find((mode) => String(mode?.key || "").trim().toLowerCase() === safeModeKey) || null;
}

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

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function makePlayClientProof(seed, data) {
  const body = `${seed || ""}:${JSON.stringify(data || {})}`;
  return simpleHash(body);
}

function makeSeed() {
  return Math.random().toString(36).slice(2, 12);
}

function seedKey(playerId, gameKey) {
  return `${playerId}:${gameKey}`;
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
  return Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
}

function classifyDiceRoll(values) {
  const dice = Array.isArray(values) ? values.map((v) => Number(v)) : [];
  if (dice.length !== 5 || !dice.every((v) => intInRange(v, 1, 6))) return "high";
  const counts = new Map();
  for (const value of dice) counts.set(value, (counts.get(value) || 0) + 1);
  const groups = Array.from(counts.values()).sort((a, b) => b - a);
  const sorted = dice.slice().sort((a, b) => a - b);
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

function shuffleWithSeed(list, seed) {
  const rng = makeRng(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function intInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function normalizeScrabbleWord(word) {
  return String(word || "").trim().toUpperCase();
}

export function buildSeededScrabbleRack(seed, rackSize) {
  const size = Number(rackSize || 0);
  if (!seed || !intInRange(size, 3, 12)) return [];
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

function getTttWinner(board) {
  for (const [a, b, c] of TTT_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
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

function pickDeterministicTttAiMove(board) {
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

function validateTttRoundMoves(moves, playerSymbol = "X") {
  const safeMoves = Array.isArray(moves) ? moves : [];
  if (!safeMoves.length || !intInRange(safeMoves.length, 1, 9)) return { valid: false };
  if (playerSymbol !== "X") return { valid: false };

  const board = new Array(9).fill(null);
  let turn = "X";
  let idx = 0;

  while (idx < safeMoves.length) {
    let move = safeMoves[idx];
    if (turn === "O") {
      const expectedAiMove = pickDeterministicTttAiMove(board);
      if (expectedAiMove == null || move !== expectedAiMove) return { valid: false };
    }
    if (!Number.isInteger(move) || move < 0 || move > 8) return { valid: false };
    if (board[move]) return { valid: false };
    board[move] = turn;
    idx += 1;

    const winnerAfterMove = getTttWinner(board);
    const hasEmpty = board.some((value) => !value);

    if (winnerAfterMove || !hasEmpty) {
      if (idx !== safeMoves.length) return { valid: false };
      if (winnerAfterMove === "X") return { valid: true, outcome: "win" };
      if (winnerAfterMove === "O") return { valid: true, outcome: "loss" };
      return { valid: true, outcome: "draw" };
    }

    turn = turn === "X" ? "O" : "X";
  }

  return { valid: false };
}

export function createSeedStore({ ttlMs, nowFn }) {
  const issuedSeeds = new Map();

  function issueSeed(playerId, gameKey) {
    const seed = makeSeed();
    const proof = crypto.randomBytes(16).toString("hex");
    issuedSeeds.set(seedKey(playerId, gameKey), {
      seed,
      proof,
      issuedAt: nowFn(),
      expiresAt: nowFn() + ttlMs
    });
    return { seed, proof };
  }

  function takeSeed(playerId, gameKey, seed, proof) {
    const key = seedKey(playerId, gameKey);
    const entry = issuedSeeds.get(key);
    if (!entry) return false;
    if (entry.seed !== seed) return false;
    if (entry.proof !== proof) return false;
    if (entry.expiresAt < nowFn()) {
      issuedSeeds.delete(key);
      return null;
    }
    issuedSeeds.delete(key);
    return {
      seed: entry.seed,
      proof: entry.proof,
      issuedAt: Number(entry.issuedAt || 0),
      expiresAt: Number(entry.expiresAt || 0)
    };
  }

  return { issueSeed, takeSeed };
}

export function validateGuessPayload(payload, seed, performanceKey) {
  if (!payload?.picks || !Array.isArray(payload.picks)) return false;
  if (!payload.picks.every((p) => p && typeof p.suit === "string" && typeof p.rank === "string")) return false;
  const mode = getCatalogMode("guess", payload?.modeKey);
  if (!mode) return false;
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const ranks = Array.isArray(mode.ranks) ? mode.ranks : ["A", "K", "Q"];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) deck.push({ suit, rank });
  }
  const shuffled = shuffleWithSeed(deck, seed);
  const targetIndex = Math.floor(makeRng(`${seed}-target`)() * shuffled.length);
  const target = shuffled[targetIndex];
  const maxAttempts = Number(mode.maxAttempts || 3);
  const picks = payload.picks.slice(0, maxAttempts).map((p) => `${p.suit}:${p.rank}`);
  const targetKey = `${target.suit}:${target.rank}`;
  const winAttempt = picks.findIndex((p) => p === targetKey) + 1;
  if (payload.outcome === "win") {
    if (winAttempt <= 0) return false;
    const expectedPerformance = winAttempt === 1 ? "first" : winAttempt === 2 ? "second" : "third";
    return performanceKey === expectedPerformance;
  }
  return winAttempt === 0;
}

export function validateTttPayload(payload, performanceKey) {
  const mode = getCatalogMode("ttt", payload?.modeKey);
  if (!mode) return false;
  const playerSymbol = payload?.playerSymbol === "O" ? "O" : "X";
  const rounds = Array.isArray(payload?.rounds)
    ? payload.rounds
    : Array.isArray(payload?.moves)
      ? [{ moves: payload.moves, outcome: payload.outcome }]
      : [];
  if (!rounds.length) return false;
  if (rounds.length > 9) return false;

  let playerWins = 0;
  let aiWins = 0;

  for (const round of rounds) {
    const validated = validateTttRoundMoves(round?.moves, playerSymbol);
    if (!validated.valid) return false;
    const claimedOutcome = String(round?.outcome || "").trim().toLowerCase();
    if (claimedOutcome && claimedOutcome !== validated.outcome) return false;
    if (validated.outcome === "win") playerWins += 1;
    if (validated.outcome === "loss") aiWins += 1;
  }

  const roundsToWin = Number(mode.roundsToWin || 1);
  if (payload.outcome === "win") {
    if (playerWins < roundsToWin) return false;
    if (aiWins >= roundsToWin) return false;
    if (performanceKey === "sweep") {
      if (roundsToWin <= 1) return false;
      if (aiWins !== 0) return false;
      if (playerWins !== roundsToWin) return false;
    } else if (performanceKey !== "normal") {
      return false;
    }
    return true;
  }
  if (payload.outcome === "loss") {
    if (aiWins < roundsToWin) return false;
    if (playerWins >= roundsToWin) return false;
    return performanceKey === "normal";
  }
  return false;
}

export function validateMatch3Payload(payload, outcome, performanceKey) {
  const mode = getCatalogMode("match3", payload?.modeKey);
  if (!mode) return false;
  const score = Number(payload?.score);
  const target = Number(payload?.target);
  const size = Number(payload?.size);
  const maxRun = Number(payload?.maxRun);
  const movesUsed = Number(payload?.movesUsed);

  if (!intInRange(Math.floor(score), 0, 50000) || score !== Math.floor(score)) return false;
  if (!intInRange(Math.floor(target), 60, 500) || target !== Math.floor(target)) return false;
  if (!intInRange(Math.floor(size), 4, 8) || size !== Math.floor(size)) return false;
  if (!intInRange(Math.floor(maxRun), 0, size) || maxRun !== Math.floor(maxRun)) return false;
  if (!intInRange(Math.floor(movesUsed), 1, Number(mode.moves || size * 4)) || movesUsed !== Math.floor(movesUsed)) return false;
  if (target !== Number(mode.target)) return false;
  if (size !== Number(mode.size)) return false;

  if (outcome === "win" && score < target) return false;
  if (outcome === "loss" && score >= target) return false;
  if (outcome === "loss" && performanceKey !== "normal") return false;
  if (performanceKey === "combo5" && maxRun < 5) return false;
  if (performanceKey === "combo4" && maxRun < 4) return false;

  // Conservative anti-cheat ceiling based on board size and used turns.
  const maxPlausibleScore = movesUsed * size * size * 12;
  if (score > maxPlausibleScore) return false;

  return true;
}

export function validateDicePayload(payload, outcome, performanceKey, seed) {
  const modeKey = String(payload?.modeKey || "").trim().toLowerCase();
  const mode = DICE_MODE_RULES[modeKey];
  if (!mode) return false;
  const rerollMaskRaw = Array.isArray(payload?.rerollMask) ? payload.rerollMask : [];
  if (rerollMaskRaw.length !== 5) return false;
  const rerollMask = rerollMaskRaw.map((value) => (value === true || value === 1 ? 1 : 0));
  if (rerollMaskRaw.some((value) => ![true, false, 0, 1].includes(value))) return false;
  if (!mode.allowReroll && rerollMask.some(Boolean)) return false;
  if (Number(payload?.targetScore) !== Number(mode.targetScore)) return false;

  const firstRoll = rollDice(seed, "roll1");
  const reroll = rollDice(seed, "reroll");
  const finalRoll = firstRoll.map((value, index) => (rerollMask[index] ? reroll[index] : value));
  const finalCategory = classifyDiceRoll(finalRoll);
  const claimedCategory = String(payload?.finalCategory || "").trim().toLowerCase();
  if (!claimedCategory || claimedCategory !== finalCategory) return false;

  const score = Number(DICE_CATEGORY_SCORE[finalCategory] || 0);
  if (outcome === "win" && score < mode.targetScore) return false;
  if (outcome === "loss" && score >= mode.targetScore) return false;

  const expectedPerformance = outcome === "win"
    ? (score >= 6 ? "elite" : score >= 4 ? "smart" : "normal")
    : "normal";
  if (performanceKey !== expectedPerformance) return false;

  return true;
}

export function validateScrabblePayload(payload, outcome, performanceKey, seed) {
  const mode = getCatalogMode("scrabble", payload?.modeKey);
  if (!mode) return false;
  const rack = buildSeededScrabbleRack(seed, Number(mode.rackSize || 7));
  if (!intInRange(rack.length, 3, 12)) return false;
  if (rack.length !== Number(mode.rackSize || 7)) return false;
  if (!rack.every((ch) => ch.length === 1)) return false;
  if (!rack.every((ch) => SCRABBLE_ALPHABET.has(ch))) return false;

  const word = normalizeScrabbleWord(payload?.word);
  if (word.length > rack.length) return false;
  if (word && !Array.from(word).every((ch) => SCRABBLE_ALPHABET.has(ch))) return false;

  if (outcome === "win") {
    if (!canFormScrabbleWord(word, rack)) return false;
    const hasRare = Array.from(word).some((ch) => SCRABBLE_RARE.has(ch));
    if (performanceKey === "long" && word.length < 6) return false;
    if (performanceKey === "rare" && !hasRare) return false;
  } else if (performanceKey !== "normal") {
    return false;
  }
  return true;
}

export function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
