import crypto from "node:crypto";

const SCRABBLE_RARE = new Set(["\u0424", "\u0429", "\u042A", "\u042D", "\u042E", "\u042F"]);

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

export function createSeedStore({ ttlMs, nowFn }) {
  const issuedSeeds = new Map();

  function issueSeed(playerId, gameKey) {
    const seed = makeSeed();
    const proof = crypto.randomBytes(16).toString("hex");
    issuedSeeds.set(seedKey(playerId, gameKey), { seed, proof, expiresAt: nowFn() + ttlMs });
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
      return false;
    }
    issuedSeeds.delete(key);
    return true;
  }

  return { issueSeed, takeSeed };
}

export function validateGuessPayload(payload, seed) {
  if (!payload?.picks || !Array.isArray(payload.picks)) return false;
  if (!payload.picks.every((p) => p && typeof p.suit === "string" && typeof p.rank === "string")) return false;
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const ranks = Array.isArray(payload.ranks) ? payload.ranks : ["A", "K", "Q"];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) deck.push({ suit, rank });
  }
  const shuffled = shuffleWithSeed(deck, seed);
  const targetIndex = Math.floor(makeRng(`${seed}-target`)() * shuffled.length);
  const target = shuffled[targetIndex];
  const maxAttempts = Number(payload.maxAttempts || 3);
  const picks = payload.picks.slice(0, maxAttempts).map((p) => `${p.suit}:${p.rank}`);
  const targetKey = `${target.suit}:${target.rank}`;
  const winAttempt = picks.findIndex((p) => p === targetKey) + 1;
  if (payload.outcome === "win") return winAttempt > 0;
  return winAttempt === 0;
}

export function validateTttPayload(payload) {
  const moves = Array.isArray(payload?.moves) ? payload.moves : [];
  if (moves.length === 0) return false;
  const board = new Array(9).fill(null);
  const playerSymbol = payload?.playerSymbol === "O" ? "O" : "X";
  let player = "X";
  for (const move of moves) {
    if (!Number.isInteger(move) || move < 0 || move > 8) return false;
    if (board[move]) return false;
    board[move] = player;
    player = player === "X" ? "O" : "X";
  }
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];
  const winner = lines.find((line) => line.every((idx) => board[idx] && board[idx] === board[line[0]]));
  const hasWinner = !!winner;
  const winnerSymbol = hasWinner ? board[winner[0]] : null;
  if (payload.outcome === "win") return winnerSymbol === playerSymbol;
  if (payload.outcome === "loss") return hasWinner && winnerSymbol !== playerSymbol;
  return false;
}

export function validateMatch3Payload(payload, outcome, performanceKey) {
  const score = Number(payload?.score);
  const target = Number(payload?.target);
  const size = Number(payload?.size);
  const maxRun = Number(payload?.maxRun);
  const movesUsed = Number(payload?.movesUsed);

  if (!intInRange(Math.floor(score), 0, 50000) || score !== Math.floor(score)) return false;
  if (!intInRange(Math.floor(target), 60, 500) || target !== Math.floor(target)) return false;
  if (!intInRange(Math.floor(size), 4, 8) || size !== Math.floor(size)) return false;
  if (!intInRange(Math.floor(maxRun), 0, 8) || maxRun !== Math.floor(maxRun)) return false;
  if (!intInRange(Math.floor(movesUsed), 0, 60) || movesUsed !== Math.floor(movesUsed)) return false;

  if (outcome === "win" && score < target) return false;
  if (outcome === "loss" && score >= target) return false;
  if (performanceKey === "combo5" && maxRun < 5) return false;
  if (performanceKey === "combo4" && maxRun < 4) return false;
  return true;
}

export function validateUnoPayload(payload, outcome, performanceKey) {
  const playerDraws = Number(payload?.playerDraws);
  const handSize = Number(payload?.handSize);
  if (!intInRange(Math.floor(playerDraws), 0, 60) || playerDraws !== Math.floor(playerDraws)) return false;
  if (!intInRange(Math.floor(handSize), 1, 20) || handSize !== Math.floor(handSize)) return false;
  if (outcome === "win" && performanceKey === "clean" && playerDraws !== 0) return false;
  return true;
}

export function validateScrabblePayload(payload, outcome, performanceKey) {
  const rackRaw = Array.isArray(payload?.rack) ? payload.rack : [];
  const rack = rackRaw
    .map((item) => normalizeScrabbleWord(item))
    .filter(Boolean);
  if (!intInRange(rack.length, 3, 12)) return false;
  if (!rack.every((ch) => ch.length === 1)) return false;

  const word = normalizeScrabbleWord(payload?.word);
  if (word.length > rack.length) return false;

  if (outcome === "win") {
    if (!canFormScrabbleWord(word, rack)) return false;
    const hasRare = Array.from(word).some((ch) => SCRABBLE_RARE.has(ch));
    if (performanceKey === "long" && word.length < 6) return false;
    if (performanceKey === "rare" && !hasRare) return false;
  }
  return true;
}

export function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}
