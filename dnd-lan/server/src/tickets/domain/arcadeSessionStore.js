import crypto from "node:crypto";
import { GAME_CATALOG } from "../../gameCatalog.js";
import { makePlayClientProof } from "./playValidation.js";

const SUITS = Object.freeze(["hearts", "diamonds", "clubs", "spades"]);
const SUIT_LABELS = Object.freeze({
  hearts: "Черви",
  diamonds: "Бубны",
  clubs: "Трефы",
  spades: "Пики"
});

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

function getCatalogMode(gameKey, modeKey) {
  const game = GAME_CATALOG.find((item) => item?.key === gameKey) || null;
  if (!game) return null;
  const safeModeKey = String(modeKey || "").trim().toLowerCase();
  return game.modes?.find((mode) => String(mode?.key || "").trim().toLowerCase() === safeModeKey) || null;
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
    if (safeGameKey !== "guess") return { error: "unsupported_game" };
    deleteIndexedSession(playerId, safeGameKey);

    const created = createGuessSession({
      playerId,
      modeKey: body?.modeKey,
      nowFn,
      ttlMs
    });
    if (created.error) return created;

    sessions.set(created.session.id, created.session);
    playerSessionIndex.set(`${playerId}:${safeGameKey}`, created.session.id);
    return { snapshot: created.snapshot };
  }

  function moveSession(playerId, sessionId, body = {}) {
    const session = getSession(playerId, sessionId);
    if (!session) return { error: "invalid_session" };
    if (session.gameKey === "guess") return applyGuessMove(session, body, nowFn);
    return { error: "unsupported_game" };
  }

  function finishSession(playerId, sessionId) {
    const session = getSession(playerId, sessionId);
    if (!session) return { error: "invalid_session" };

    let built;
    if (session.gameKey === "guess") built = buildGuessFinishPayload(session, nowFn);
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
