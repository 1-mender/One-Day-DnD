import express from "express";
import { dmAuthMiddleware, getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb, getParty, getPartySettings, setPartySettings } from "../db.js";
import { now, jsonParse } from "../util.js";
import { logEvent } from "../events.js";
import { GAME_CATALOG, validateGameCatalog } from "../gameCatalog.js";
import { logger } from "../logger.js";

export const ticketsRouter = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_TTL_MS = 10 * 60 * 1000;
const ARCADE_QUEUE_TTL_MS = Number(process.env.ARCADE_QUEUE_TTL_MS || 2 * 60 * 1000);
const ARCADE_HISTORY_LIMIT = Number(process.env.ARCADE_HISTORY_LIMIT || 20);
const ARCADE_QUEUE_ETA_SEC = Number(process.env.ARCADE_QUEUE_ETA_SEC || 12);
const ARCADE_METRICS_DAYS = Number(process.env.ARCADE_METRICS_DAYS || 7);
const issuedSeeds = new Map();

validateGameCatalog();

const DEFAULT_DAILY_QUEST = {
  enabled: true,
  key: "daily_mix",
  title: "Микс игр",
  description: "Сыграй в 2 разные игры за день",
  goal: 2,
  reward: 2
};

const DEFAULT_TICKET_RULES = {
  enabled: true,
  dailyEarnCap: 14,
  dailySpendCap: 0,
  streak: {
    max: 3,
    step: 0.05,
    flatBonus: 1
  },
  games: {
    ttt: {
      enabled: true,
      entryCost: 0,
      rewardMin: 1,
      rewardMax: 3,
      lossPenalty: 0,
      dailyLimit: 10,
      ui: {
        difficulty: "Легкая",
        risk: "Низкий",
        time: "2-4 мин"
      },
      performance: {
        normal: { label: "Победа", multiplier: 1 },
        sweep: { label: "Победа 2-0", multiplier: 1.15 }
      }
    },
    guess: {
      enabled: true,
      entryCost: 1,
      rewardMin: 2,
      rewardMax: 4,
      lossPenalty: 1,
      dailyLimit: 8,
      ui: {
        difficulty: "Средняя",
        risk: "Средний",
        time: "3-5 мин"
      },
      performance: {
        first: { label: "Угадал с 1-й попытки", multiplier: 1.2 },
        second: { label: "Со 2-й попытки", multiplier: 1.05 },
        third: { label: "С 3-й попытки", multiplier: 1 }
      }
    },
    match3: {
      enabled: true,
      entryCost: 1,
      rewardMin: 2,
      rewardMax: 5,
      lossPenalty: 1,
      dailyLimit: 6,
      ui: {
        difficulty: "Средняя",
        risk: "Средний",
        time: "4-6 мин"
      },
      performance: {
        normal: { label: "Комбо 3", multiplier: 1 },
        combo4: { label: "Комбо 4+", multiplier: 1.1 },
        combo5: { label: "Комбо 5+", multiplier: 1.2 }
      }
    },
    uno: {
      enabled: true,
      entryCost: 1,
      rewardMin: 2,
      rewardMax: 5,
      lossPenalty: 1,
      dailyLimit: 5,
      ui: {
        difficulty: "Средняя",
        risk: "Средний",
        time: "5-7 мин"
      },
      performance: {
        normal: { label: "Победа", multiplier: 1 },
        clean: { label: "Без штрафных", multiplier: 1.15 }
      }
    },
    scrabble: {
      enabled: true,
      entryCost: 1,
      rewardMin: 3,
      rewardMax: 6,
      lossPenalty: 2,
      dailyLimit: 5,
      ui: {
        difficulty: "Сложная",
        risk: "Высокий",
        time: "2-3 мин"
      },
      performance: {
        normal: { label: "Слово собрано", multiplier: 1 },
        long: { label: "6+ букв", multiplier: 1.2 },
        rare: { label: "Редкая буква", multiplier: 1.1 }
      }
    }
  },
  shop: {
    stat: { enabled: true, price: 12, dailyLimit: 1 },
    feat: { enabled: true, price: 15, dailyLimit: 1 },
    reroll: { enabled: true, price: 4, dailyLimit: 2 },
    luck: { enabled: true, price: 3, dailyLimit: 3 },
    chest: { enabled: true, price: 7, dailyLimit: 1 },
    hint: { enabled: true, price: 5, dailyLimit: 2 }
  },
  autoBalance: {
    enabled: false,
    windowDays: 7,
    targetWinRate: 0.55,
    rewardStep: 1,
    penaltyStep: 1,
    minPlays: 20
  },
  dailyQuest: {
    enabled: true,
    activeKey: DEFAULT_DAILY_QUEST.key,
    pool: [DEFAULT_DAILY_QUEST]
  }
};

function getDayKey(t = now()) {
  return Math.floor(Number(t) / DAY_MS);
}

function makeSeed() {
  return Math.random().toString(36).slice(2, 12);
}

function seedKey(playerId, gameKey) {
  return `${playerId}:${gameKey}`;
}

function issueSeed(playerId, gameKey) {
  const seed = makeSeed();
  issuedSeeds.set(seedKey(playerId, gameKey), { seed, expiresAt: now() + SEED_TTL_MS });
  return seed;
}

function takeSeed(playerId, gameKey, seed) {
  const key = seedKey(playerId, gameKey);
  const entry = issuedSeeds.get(key);
  if (!entry) return false;
  if (entry.seed !== seed) return false;
  if (entry.expiresAt < now()) {
    issuedSeeds.delete(key);
    return false;
  }
  issuedSeeds.delete(key);
  return true;
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

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function makeProof(seed, payload) {
  const body = `${seed || ""}:${JSON.stringify(payload || {})}`;
  return simpleHash(body);
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

function validateGuessPayload(payload, seed) {
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

function validateTttPayload(payload) {
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

function randInt(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function isDmRequest(req) {
  const token = req.cookies?.[getDmCookieName()];
  if (!token) return false;
  try {
    verifyDmToken(token);
    return true;
  } catch {
    return false;
  }
}

function getPlayerFromToken(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), Date.now());
  if (!sess) return null;
  const player = db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(sess.player_id);
  if (!player) return null;
  return { sess, player };
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function mergeRules(base, override) {
  if (!isPlainObject(override)) return { ...base };
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(base?.[k])) out[k] = mergeRules(base[k], v);
    else out[k] = v;
  }
  return out;
}

function clampInt(value, min = 0, max = 999) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampFloat(value, min = 0, max = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizeRules(rules) {
  const out = { ...rules };
  out.enabled = out.enabled !== false;
  out.dailyEarnCap = clampInt(out.dailyEarnCap, 0, 9999);
  out.dailySpendCap = clampInt(out.dailySpendCap, 0, 9999);

  const streak = out.streak || {};
  out.streak = {
    max: clampInt(streak.max, 0, 10),
    step: clampFloat(streak.step, 0, 2),
    flatBonus: clampInt(streak.flatBonus, 0, 10)
  };

  const games = { ...(out.games || {}) };
  for (const [key, g] of Object.entries(games)) {
    const cur = g || {};
    const rewardMin = clampInt(cur.rewardMin, 0, 999);
    const rewardMax = clampInt(cur.rewardMax, rewardMin, 999);
    const uiRaw = cur.ui && typeof cur.ui === "object" ? cur.ui : {};
    const ui = {
      difficulty: typeof uiRaw.difficulty === "string" ? uiRaw.difficulty.slice(0, 40) : "",
      risk: typeof uiRaw.risk === "string" ? uiRaw.risk.slice(0, 40) : "",
      time: typeof uiRaw.time === "string" ? uiRaw.time.slice(0, 40) : ""
    };
    games[key] = {
      ...cur,
      enabled: cur.enabled !== false,
      entryCost: clampInt(cur.entryCost, 0, 999),
      rewardMin,
      rewardMax,
      lossPenalty: clampInt(cur.lossPenalty, 0, 999),
      dailyLimit: clampInt(cur.dailyLimit, 0, 999),
      ui
    };
  }
  out.games = games;

  const shop = { ...(out.shop || {}) };
  for (const [key, s] of Object.entries(shop)) {
    const cur = s || {};
    shop[key] = {
      ...cur,
      enabled: cur.enabled !== false,
      price: clampInt(cur.price, 0, 999),
      dailyLimit: clampInt(cur.dailyLimit, 0, 999)
    };
  }
  out.shop = shop;

  const autoBalance = out.autoBalance || {};
  out.autoBalance = {
    enabled: autoBalance.enabled === true,
    windowDays: clampInt(autoBalance.windowDays, 1, 30),
    targetWinRate: clampFloat(autoBalance.targetWinRate, 0.2, 0.8),
    rewardStep: clampInt(autoBalance.rewardStep, 0, 5),
    penaltyStep: clampInt(autoBalance.penaltyStep, 0, 5),
    minPlays: clampInt(autoBalance.minPlays, 10, 200)
  };

  const dqRaw = out.dailyQuest && typeof out.dailyQuest === "object" ? out.dailyQuest : {};
  const poolRaw = Array.isArray(dqRaw.pool) && dqRaw.pool.length ? dqRaw.pool : DEFAULT_TICKET_RULES.dailyQuest.pool;
  const pool = [];
  const seen = new Set();
  const maxPool = 10;

  function sanitizeKey(value, fallback) {
    const raw = String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40);
    return raw || fallback;
  }

  for (let i = 0; i < poolRaw.length && pool.length < maxPool; i++) {
    const q = poolRaw[i] || {};
    const baseKey = sanitizeKey(q.key, `dq_${i + 1}`);
    let key = baseKey;
    let n = 1;
    while (seen.has(key)) {
      n += 1;
      key = sanitizeKey(`${baseKey}_${n}`, `dq_${i + 1}_${n}`);
    }
    seen.add(key);
    pool.push({
      key,
      enabled: q.enabled !== false,
      title: typeof q.title === "string" ? q.title.slice(0, 80) : DEFAULT_DAILY_QUEST.title,
      description: typeof q.description === "string" ? q.description.slice(0, 160) : DEFAULT_DAILY_QUEST.description,
      goal: clampInt(q.goal ?? DEFAULT_DAILY_QUEST.goal, 1, 10),
      reward: clampInt(q.reward ?? DEFAULT_DAILY_QUEST.reward, 0, 50)
    });
  }

  const activeKeyRaw = sanitizeKey(dqRaw.activeKey, "");
  const enabledPool = pool.filter((q) => q.enabled !== false);
  const activeKey = enabledPool.find((q) => q.key === activeKeyRaw)?.key
    || enabledPool[0]?.key
    || "";

  out.dailyQuest = {
    enabled: dqRaw.enabled !== false,
    activeKey,
    pool
  };

  return out;
}

function applyAutoBalance(db, partyId, rules) {
  if (!rules.autoBalance?.enabled) return rules;
  const dayKey = getDayKey();
  const windowDays = Number(rules.autoBalance.windowDays || 7);
  const minDay = dayKey - windowDays + 1;
  const stats = db.prepare(
    `SELECT tp.game_key as gameKey,
            SUM(CASE WHEN tp.outcome='win' THEN 1 ELSE 0 END) as wins,
            COUNT(*) as total
       FROM ticket_plays tp
       JOIN players p ON p.id = tp.player_id
      WHERE p.party_id = ? AND tp.day_key >= ?
      GROUP BY tp.game_key`
  ).all(partyId, minDay);
  const statsMap = new Map(stats.map((row) => [row.gameKey, row]));
  const nextRules = { ...rules, games: { ...rules.games } };
  for (const [key, game] of Object.entries(rules.games || {})) {
    const row = statsMap.get(key);
    if (!row || Number(row.total || 0) < rules.autoBalance.minPlays) {
      nextRules.games[key] = { ...game };
      continue;
    }
    const winRate = Number(row.wins || 0) / Number(row.total || 1);
    const tweak = winRate - rules.autoBalance.targetWinRate;
    const rewardStep = Number(rules.autoBalance.rewardStep || 0);
    const penaltyStep = Number(rules.autoBalance.penaltyStep || 0);
    const next = { ...game };
    if (tweak > 0.08) {
      next.rewardMax = Math.max(next.rewardMin, next.rewardMax - rewardStep);
      next.lossPenalty = Math.min(999, next.lossPenalty + penaltyStep);
    } else if (tweak < -0.08) {
      next.rewardMax = Math.min(999, next.rewardMax + rewardStep);
      next.lossPenalty = Math.max(0, next.lossPenalty - penaltyStep);
    }
    nextRules.games[key] = next;
  }
  return nextRules;
}

function getQuestProgress(db, playerId, dayKey) {
  const row = db
    .prepare("SELECT COUNT(DISTINCT game_key) AS c FROM ticket_plays WHERE player_id=? AND day_key=?")
    .get(playerId, dayKey);
  return Number(row?.c || 0);
}

function getActiveQuest(rules) {
  const dq = rules?.dailyQuest;
  if (!dq || dq.enabled === false) return null;
  const pool = Array.isArray(dq.pool) ? dq.pool : [];
  let q = pool.find((x) => x.key === dq.activeKey && x.enabled !== false);
  if (!q) q = pool.find((x) => x.enabled !== false) || null;
  return q;
}

function getQuestStates(db, playerId, dayKey, rules) {
  const q = getActiveQuest(rules);
  if (!q) return [];
  const distinctGames = getQuestProgress(db, playerId, dayKey);
  const row = db.prepare(
    "SELECT reward_granted, rewarded_at FROM ticket_quests WHERE player_id=? AND quest_key=? AND day_key=?"
  ).get(playerId, q.key, dayKey);
  const completed = distinctGames >= q.goal;
  return [{
    key: q.key,
    title: q.title,
    description: q.description,
    goal: q.goal,
    progress: distinctGames,
    reward: q.reward,
    completed,
    rewarded: !!row,
    rewardGranted: row?.reward_granted ?? 0,
    rewardedAt: row?.rewarded_at ?? null
  }];
}

function getQuestHistory(db, playerId, dayKey, rules, days = 7) {
  const q = getActiveQuest(rules);
  if (!q) return [];
  const d = Math.max(1, Math.min(30, Math.floor(Number(days) || 7)));
  const minDay = dayKey - (d - 1);
  const rows = db.prepare(
    "SELECT day_key, reward_granted, rewarded_at FROM ticket_quests WHERE player_id=? AND quest_key=? AND day_key>=? ORDER BY day_key DESC"
  ).all(playerId, q.key, minDay);
  return rows.map((r) => ({
    dayKey: r.day_key,
    rewardGranted: r.reward_granted ?? 0,
    rewardedAt: r.rewarded_at ?? null
  }));
}

function maybeGrantDailyQuest(db, playerId, dayKey, rules) {
  const q = getActiveQuest(rules);
  if (!q) return null;
  const distinctGames = getQuestProgress(db, playerId, dayKey);
  if (distinctGames < q.goal) return null;

  const existing = db.prepare(
    "SELECT 1 FROM ticket_quests WHERE player_id=? AND quest_key=? AND day_key=?"
  ).get(playerId, q.key, dayKey);
  if (existing) return null;

  const row = db.prepare("SELECT balance, daily_earned FROM tickets WHERE player_id=?").get(playerId);
  const currentEarned = Number(row?.daily_earned || 0);
  const currentBalance = Number(row?.balance || 0);

  let reward = Number(q.reward || 0);
  const cap = Number(rules?.dailyEarnCap || 0);
  if (cap > 0) {
    reward = Math.max(0, Math.min(reward, cap - currentEarned));
  }

  const t = now();
  const tx = db.transaction(() => {
    db.prepare(
      "INSERT INTO ticket_quests(player_id, quest_key, day_key, reward_granted, rewarded_at, created_at) VALUES(?,?,?,?,?,?)"
    ).run(playerId, q.key, dayKey, reward, t, t);
    if (reward > 0) {
      db.prepare("UPDATE tickets SET balance=?, daily_earned=?, updated_at=? WHERE player_id=?")
        .run(currentBalance + reward, currentEarned + reward, t, playerId);
    }
  });
  tx();

  return { questKey: q.key, rewardGranted: reward };
}

function getEffectiveRules(partyId) {
  const settings = getPartySettings(partyId);
  const overrides = jsonParse(settings?.tickets_rules, {});
  const merged = mergeRules(DEFAULT_TICKET_RULES, overrides);
  merged.enabled = settings?.tickets_enabled == null ? true : !!settings.tickets_enabled;
  const normalized = normalizeRules(merged);
  return applyAutoBalance(getDb(), partyId, normalized);
}

function saveRulesOverride(partyId, enabled, rules) {
  const nextEnabled = enabled == null ? 1 : enabled ? 1 : 0;
  setPartySettings(partyId, {
    tickets_enabled: nextEnabled,
    tickets_rules: JSON.stringify(rules || {})
  });
}

function ensureTicketRow(db, playerId) {
  let row = db.prepare("SELECT * FROM tickets WHERE player_id=?").get(playerId);
  if (!row) {
    const t = now();
    db.prepare(
      "INSERT INTO tickets(player_id, balance, streak, daily_earned, daily_spent, day_key, last_played_at, updated_at) VALUES(?,?,?,?,?,?,?,?)"
    ).run(playerId, 0, 0, 0, 0, getDayKey(t), null, t);
    row = db.prepare("SELECT * FROM tickets WHERE player_id=?").get(playerId);
  }
  return row;
}

function normalizeDay(db, row, dayKey) {
  if (row.day_key === dayKey) return row;
  const t = now();
  db.prepare(
    "UPDATE tickets SET daily_earned=0, daily_spent=0, day_key=?, streak=0, updated_at=? WHERE player_id=?"
  ).run(dayKey, t, row.player_id);
  return db.prepare("SELECT * FROM tickets WHERE player_id=?").get(row.player_id);
}

function mapState(row) {
  return {
    balance: Number(row.balance || 0),
    streak: Number(row.streak || 0),
    dailyEarned: Number(row.daily_earned || 0),
    dailySpent: Number(row.daily_spent || 0),
    dayKey: Number(row.day_key || 0),
    lastPlayedAt: row.last_played_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function getUsage(db, playerId, dayKey) {
  const plays = db
    .prepare("SELECT game_key as gameKey, COUNT(*) as c FROM ticket_plays WHERE player_id=? AND day_key=? GROUP BY game_key")
    .all(playerId, dayKey);
  const purchases = db
    .prepare("SELECT item_key as itemKey, SUM(qty) as c FROM ticket_purchases WHERE player_id=? AND day_key=? GROUP BY item_key")
    .all(playerId, dayKey);

  const playsToday = {};
  const purchasesToday = {};

  for (const p of plays) playsToday[p.gameKey] = Number(p.c || 0);
  for (const p of purchases) purchasesToday[p.itemKey] = Number(p.c || 0);

  return { playsToday, purchasesToday };
}

function clampLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function getCatalogGame(gameKey) {
  return GAME_CATALOG.find((g) => g.key === gameKey) || null;
}

function resolveModeKey(gameKey, modeKey) {
  const game = getCatalogGame(gameKey);
  if (!game) return null;
  const modes = Array.isArray(game.modes) ? game.modes : [];
  if (!modes.length) return modeKey || "default";
  const safe = String(modeKey || "").trim();
  if (!safe) return String(modes[0].key || "default");
  const found = modes.find((m) => String(m.key) === safe);
  if (!found) return null;
  return safe;
}

function calcPercentile(list, p) {
  if (!Array.isArray(list) || !list.length) return null;
  const sorted = list.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function compactMatchPayload(row, playerId, opponentName = "") {
  if (!row) return null;
  const winnerId = row.winner_player_id == null ? null : Number(row.winner_player_id);
  const loserId = row.loser_player_id == null ? null : Number(row.loser_player_id);
  let result = "pending";
  if (winnerId && winnerId === Number(playerId)) result = "win";
  else if (loserId && loserId === Number(playerId)) result = "loss";
  else if (row.status === "completed") result = "draw";
  return {
    matchId: Number(row.id),
    gameKey: String(row.game_key || ""),
    modeKey: String(row.mode_key || ""),
    status: String(row.status || "pending"),
    result,
    opponentName: opponentName || "",
    createdAt: Number(row.created_at || 0),
    startedAt: row.started_at == null ? null : Number(row.started_at),
    endedAt: row.ended_at == null ? null : Number(row.ended_at),
    queueWaitMs: row.queue_wait_ms == null ? null : Number(row.queue_wait_ms),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    rematchOf: row.rematch_of == null ? null : Number(row.rematch_of)
  };
}

function emitQueueUpdated(io, playerId) {
  if (!io || !playerId) return;
  io.to(`player:${playerId}`).emit("arcade:queue:updated");
}

function cleanupExpiredQueue(db, partyId, io = null) {
  const t = now();
  const rows = db
    .prepare("SELECT id, player_id FROM arcade_match_queue WHERE party_id=? AND status='queued' AND expires_at<=?")
    .all(partyId, t);
  if (!rows.length) return 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      db.prepare(
        "UPDATE arcade_match_queue SET status='expired', updated_at=? WHERE id=? AND status='queued'"
      ).run(t, row.id);
    }
  });
  tx();

  for (const row of rows) {
    emitQueueUpdated(io, Number(row.player_id));
  }
  return rows.length;
}

function getActiveQueueRow(db, playerId) {
  return db
    .prepare("SELECT * FROM arcade_match_queue WHERE player_id=? AND status='queued' ORDER BY joined_at DESC LIMIT 1")
    .get(playerId);
}

function getMatchHistory(db, playerId, limit = ARCADE_HISTORY_LIMIT) {
  const lim = clampLimit(limit, ARCADE_HISTORY_LIMIT, 1, 50);
  const rows = db.prepare(
    `SELECT m.*
     FROM arcade_match_players mp
     JOIN arcade_matches m ON m.id = mp.match_id
     WHERE mp.player_id=?
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).all(playerId, lim);

  return rows.map((row) => {
    const opponent = db.prepare(
      `SELECT p.display_name as displayName
       FROM arcade_match_players mp
       JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id=? AND mp.player_id<>?
       LIMIT 1`
    ).get(row.id, playerId);
    return compactMatchPayload(row, playerId, String(opponent?.displayName || ""));
  });
}

function buildPlayerArcadeMetrics(history) {
  const items = Array.isArray(history) ? history : [];
  const finished = items.filter((m) => m.status === "completed" || m.result === "win" || m.result === "loss");
  const wins = finished.filter((m) => m.result === "win").length;
  const queueWaitValues = items.map((m) => Number(m.queueWaitMs || 0)).filter((v) => Number.isFinite(v) && v > 0);
  return {
    matches: finished.length,
    wins,
    losses: finished.filter((m) => m.result === "loss").length,
    winRate: finished.length ? Number((wins / finished.length).toFixed(2)) : 0,
    avgQueueWaitMs: queueWaitValues.length
      ? Math.round(queueWaitValues.reduce((acc, v) => acc + v, 0) / queueWaitValues.length)
      : null
  };
}

function buildMatchmakingPayload(db, playerId, partyId) {
  cleanupExpiredQueue(db, partyId);
  const active = getActiveQueueRow(db, playerId);
  const history = getMatchHistory(db, playerId, ARCADE_HISTORY_LIMIT);
  const activeQueue = active
    ? {
      id: Number(active.id),
      gameKey: String(active.game_key || ""),
      modeKey: String(active.mode_key || ""),
      skillBand: active.skill_band == null ? null : String(active.skill_band),
      joinedAt: Number(active.joined_at || 0),
      expiresAt: Number(active.expires_at || 0),
      waitMs: Math.max(0, now() - Number(active.joined_at || now())),
      etaSec: ARCADE_QUEUE_ETA_SEC,
      rematchTargetPlayerId: active.rematch_target_player_id == null ? null : Number(active.rematch_target_player_id),
      rematchOfMatchId: active.rematch_of_match_id == null ? null : Number(active.rematch_of_match_id)
    }
    : null;
  return { activeQueue, history };
}

function findQueueOpponent(db, { partyId, playerId, gameKey, modeKey, rematchTargetPlayerId }) {
  if (rematchTargetPlayerId) {
    const exact = db.prepare(
      `SELECT *
       FROM arcade_match_queue
       WHERE party_id=? AND status='queued' AND player_id=? AND game_key=? AND mode_key=?
         AND (rematch_target_player_id IS NULL OR rematch_target_player_id=?)
       ORDER BY joined_at ASC
       LIMIT 1`
    ).get(partyId, rematchTargetPlayerId, gameKey, modeKey, playerId);
    if (exact) return exact;
  }

  return db.prepare(
    `SELECT *
     FROM arcade_match_queue
     WHERE party_id=? AND status='queued' AND player_id<>? AND game_key=? AND mode_key=?
       AND (rematch_target_player_id IS NULL OR rematch_target_player_id=?)
     ORDER BY CASE WHEN rematch_target_player_id=? THEN 0 ELSE 1 END, joined_at ASC
     LIMIT 1`
  ).get(partyId, playerId, gameKey, modeKey, playerId, playerId);
}

function createMatchFromQueues(db, {
  partyId,
  gameKey,
  modeKey,
  queueA,
  queueB,
  createdAt,
  rematchOfMatchId
}) {
  const waitBase = Math.min(Number(queueA?.joined_at || createdAt), Number(queueB?.joined_at || createdAt));
  const queueWaitMs = Math.max(0, createdAt - waitBase);

  const matchInfo = db.prepare(
    `INSERT INTO arcade_matches(
      party_id, game_key, mode_key, status, created_at, started_at, queue_wait_ms, rematch_of
    ) VALUES(?,?,?,?,?,?,?,?)`
  ).run(
    partyId,
    gameKey,
    modeKey,
    "active",
    createdAt,
    createdAt,
    queueWaitMs,
    rematchOfMatchId || null
  );
  const matchId = Number(matchInfo.lastInsertRowid);

  db.prepare(
    `INSERT INTO arcade_match_players(match_id, player_id, queue_id, joined_at, result, is_winner)
     VALUES(?,?,?,?,?,?)`
  ).run(matchId, Number(queueA.player_id), Number(queueA.id), createdAt, "pending", 0);
  db.prepare(
    `INSERT INTO arcade_match_players(match_id, player_id, queue_id, joined_at, result, is_winner)
     VALUES(?,?,?,?,?,?)`
  ).run(matchId, Number(queueB.player_id), Number(queueB.id), createdAt, "pending", 0);

  db.prepare(
    "UPDATE arcade_match_queue SET status='matched', matched_at=?, updated_at=?, match_id=? WHERE id IN (?,?)"
  ).run(createdAt, createdAt, matchId, Number(queueA.id), Number(queueB.id));

  return db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(matchId);
}

function loadMatchForPlayer(db, matchId, playerId) {
  const row = db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(matchId);
  if (!row) return null;
  const opponent = db.prepare(
    `SELECT p.display_name as displayName
     FROM arcade_match_players mp
     JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id=? AND mp.player_id<>?
     LIMIT 1`
  ).get(matchId, playerId);
  return compactMatchPayload(row, playerId, String(opponent?.displayName || ""));
}

function emitMatchFound(io, db, matchId, players) {
  if (!io) return;
  const uniquePlayers = Array.from(new Set((players || []).map((v) => Number(v)).filter(Boolean)));
  for (const playerId of uniquePlayers) {
    const payload = loadMatchForPlayer(db, matchId, playerId);
    io.to(`player:${playerId}`).emit("arcade:match:found", { match: payload });
    emitQueueUpdated(io, playerId);
  }
  io.to("dm").emit("tickets:updated");
}

function summarizeStats(values) {
  const list = (values || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v >= 0);
  if (!list.length) return { count: 0, avg: null, p50: null, p95: null };
  const sum = list.reduce((acc, v) => acc + v, 0);
  return {
    count: list.length,
    avg: Math.round(sum / list.length),
    p50: calcPercentile(list, 50),
    p95: calcPercentile(list, 95)
  };
}

function buildDmArcadeMetrics(db, partyId, days = ARCADE_METRICS_DAYS) {
  const windowDays = clampLimit(days, ARCADE_METRICS_DAYS, 1, 30);
  const since = now() - windowDays * DAY_MS;

  const queueRows = db
    .prepare("SELECT queue_wait_ms FROM arcade_matches WHERE party_id=? AND created_at>=? AND queue_wait_ms IS NOT NULL")
    .all(partyId, since);
  const durationRows = db
    .prepare("SELECT duration_ms FROM arcade_matches WHERE party_id=? AND created_at>=? AND duration_ms IS NOT NULL")
    .all(partyId, since);
  const allMatches = db
    .prepare("SELECT id, rematch_of FROM arcade_matches WHERE party_id=? AND created_at>=?")
    .all(partyId, since);

  const rematchCount = allMatches.filter((m) => m.rematch_of != null).length;
  const matchCount = allMatches.length;

  const activityRows = db.prepare(
    `SELECT player_id as playerId, COUNT(DISTINCT day_key) as d
     FROM ticket_plays
     WHERE created_at>=?
     GROUP BY player_id`
  ).all(since);
  const activePlayers = activityRows.length;
  const returningPlayers = activityRows.filter((r) => Number(r.d || 0) >= 2).length;

  return {
    windowDays,
    queueWaitMs: summarizeStats(queueRows.map((r) => r.queue_wait_ms)),
    matchCompleteMs: summarizeStats(durationRows.map((r) => r.duration_ms)),
    rematchRate: matchCount ? Number((rematchCount / matchCount).toFixed(2)) : 0,
    d1ReturnRate: activePlayers ? Number((returningPlayers / activePlayers).toFixed(2)) : 0
  };
}

function queuePlayerForMatchmaking({
  db,
  io,
  me,
  gameKey,
  modeKey,
  skillBand = "",
  rematchTargetPlayerId = null,
  rematchOfMatchId = null
}) {
  const partyId = Number(me.player.party_id);
  cleanupExpiredQueue(db, partyId, io);

  const existing = getActiveQueueRow(db, me.player.id);
  if (existing) {
    return { error: "already_in_queue", existing };
  }

  const t = now();
  const expiresAt = t + Math.max(15_000, ARCADE_QUEUE_TTL_MS);
  const info = db.prepare(
    `INSERT INTO arcade_match_queue(
      party_id, player_id, game_key, mode_key, skill_band, rematch_target_player_id,
      rematch_of_match_id, status, joined_at, expires_at, updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    partyId,
    me.player.id,
    gameKey,
    modeKey,
    skillBand || null,
    rematchTargetPlayerId || null,
    rematchOfMatchId || null,
    "queued",
    t,
    expiresAt,
    t
  );

  const queueRow = db.prepare("SELECT * FROM arcade_match_queue WHERE id=?").get(info.lastInsertRowid);
  const opponent = findQueueOpponent(db, {
    partyId,
    playerId: me.player.id,
    gameKey,
    modeKey,
    rematchTargetPlayerId
  });

  logEvent({
    partyId,
    type: "arcade.queue.join",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_queue",
    targetId: Number(queueRow.id),
    message: `Queue join ${gameKey}/${modeKey}`,
    data: {
      queueId: Number(queueRow.id),
      gameKey,
      modeKey,
      skillBand: skillBand || null,
      rematchTargetPlayerId: rematchTargetPlayerId || null
    },
    io
  });

  if (!opponent) {
    emitQueueUpdated(io, me.player.id);
    return { status: "queued", queueRow, match: null };
  }

  const nextMatch = createMatchFromQueues(db, {
    partyId,
    gameKey,
    modeKey,
    queueA: queueRow,
    queueB: opponent,
    createdAt: t,
    rematchOfMatchId: rematchOfMatchId || opponent.rematch_of_match_id || queueRow.rematch_of_match_id
  });

  const opponentPlayer = db.prepare("SELECT display_name FROM players WHERE id=?").get(opponent.player_id);
  const waitMs = Math.max(0, t - Math.min(Number(queueRow.joined_at || t), Number(opponent.joined_at || t)));
  logEvent({
    partyId,
    type: "arcade.match.found",
    actorRole: "system",
    actorName: "Matchmaker",
    targetType: "arcade_match",
    targetId: Number(nextMatch.id),
    message: `Match found ${gameKey}/${modeKey}`,
    data: {
      matchId: Number(nextMatch.id),
      gameKey,
      modeKey,
      queueWaitMs: waitMs,
      players: [me.player.id, Number(opponent.player_id)],
      rematchOf: nextMatch.rematch_of == null ? null : Number(nextMatch.rematch_of),
      opponentName: String(opponentPlayer?.display_name || "")
    },
    io
  });

  emitMatchFound(io, db, Number(nextMatch.id), [me.player.id, Number(opponent.player_id)]);
  return { status: "matched", queueRow, match: nextMatch, opponent };
}

function buildPayload(db, playerId, dayKey, rules, options = {}) {
  const partyId = Number(options.partyId || getParty().id);
  const row = db.prepare("SELECT * FROM tickets WHERE player_id=?").get(playerId);
  const historyDays = Number(process.env.DAILY_QUEST_HISTORY_DAYS || 7);
  const matchmaking = buildMatchmakingPayload(db, playerId, partyId);
  return {
    state: mapState(row),
    rules,
    catalog: GAME_CATALOG,
    usage: getUsage(db, playerId, dayKey),
    quests: getQuestStates(db, playerId, dayKey, rules),
    questHistory: getQuestHistory(db, playerId, dayKey, rules, historyDays),
    matchmaking,
    arcadeMetrics: buildPlayerArcadeMetrics(matchmaking.history)
  };
}

ticketsRouter.get("/rules", (req, res) => {
  const isDm = isDmRequest(req);
  const me = getPlayerFromToken(req);
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });
  const partyId = me?.player?.party_id ?? getParty().id;
  res.json({ rules: getEffectiveRules(partyId) });
});

ticketsRouter.get("/me", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const db = getDb();
  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const rules = getEffectiveRules(me.player.party_id);
  res.json(buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }));
});

ticketsRouter.get("/catalog", (req, res) => {
  res.json({ catalog: GAME_CATALOG });
});

ticketsRouter.get("/seed", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const gameKey = String(req.query?.gameKey || "").trim();
  if (!gameKey || !GAME_CATALOG.find((g) => g.key === gameKey)) {
    return res.status(400).json({ error: "invalid_game" });
  }
  const seed = issueSeed(me.player.id, gameKey);
  res.json({ seed, gameKey });
});

ticketsRouter.post("/matchmaking/queue", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const gameKey = String(req.body?.gameKey || "").trim();
  const modeKeyInput = String(req.body?.modeKey || "").trim();
  const skillBand = String(req.body?.skillBand || "").trim().slice(0, 24);

  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return res.status(400).json({ error: "tickets_disabled" });
  const game = rules.games?.[gameKey];
  if (!game) return res.status(400).json({ error: "invalid_game" });
  if (game.enabled === false) return res.status(400).json({ error: "game_disabled" });

  const modeKey = resolveModeKey(gameKey, modeKeyInput);
  if (!modeKey) return res.status(400).json({ error: "invalid_mode" });

  const db = getDb();
  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const queued = queuePlayerForMatchmaking({
    db,
    io: req.app.locals.io,
    me,
    gameKey,
    modeKey,
    skillBand
  });
  if (queued.error === "already_in_queue") {
    return res.status(409).json({ error: "already_in_queue" });
  }

  return res.json({
    ...buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }),
    matchmakingAction: {
      status: queued.status,
      queueId: Number(queued.queueRow?.id || 0),
      matchId: queued.match ? Number(queued.match.id) : null
    }
  });
});

ticketsRouter.post("/matchmaking/cancel", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const queueId = req.body?.queueId == null ? null : Number(req.body.queueId);
  const db = getDb();
  cleanupExpiredQueue(db, me.player.party_id, req.app.locals.io);

  const active = queueId
    ? db.prepare(
      "SELECT * FROM arcade_match_queue WHERE id=? AND player_id=? AND status='queued' LIMIT 1"
    ).get(queueId, me.player.id)
    : getActiveQueueRow(db, me.player.id);

  const dayKey = getDayKey();
  let row = ensureTicketRow(db, me.player.id);
  row = normalizeDay(db, row, dayKey);
  const rules = getEffectiveRules(me.player.party_id);

  if (!active) {
    return res.json({
      ...buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }),
      matchmakingAction: { status: "noop" }
    });
  }

  const t = now();
  db.prepare(
    "UPDATE arcade_match_queue SET status='canceled', canceled_at=?, updated_at=? WHERE id=?"
  ).run(t, t, active.id);

  emitQueueUpdated(req.app.locals.io, me.player.id);
  req.app.locals.io?.to("dm").emit("tickets:updated");
  logEvent({
    partyId: me.player.party_id,
    type: "arcade.queue.cancel",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_queue",
    targetId: Number(active.id),
    message: `Queue cancel ${active.game_key}/${active.mode_key}`,
    data: {
      queueId: Number(active.id),
      gameKey: String(active.game_key || ""),
      modeKey: String(active.mode_key || "")
    },
    io: req.app.locals.io
  });

  return res.json({
    ...buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }),
    matchmakingAction: { status: "canceled", queueId: Number(active.id) }
  });
});

ticketsRouter.get("/matches/history", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  const limit = clampLimit(req.query?.limit, ARCADE_HISTORY_LIMIT, 1, 50);
  return res.json({ items: getMatchHistory(db, me.player.id, limit) });
});

ticketsRouter.post("/matches/:matchId/rematch", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const matchId = Number(req.params?.matchId);
  if (!matchId) return res.status(400).json({ error: "invalid_match_id" });

  const db = getDb();
  const match = db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(matchId);
  if (!match) return res.status(404).json({ error: "match_not_found" });
  if (Number(match.party_id) !== Number(me.player.party_id)) return res.status(404).json({ error: "match_not_found" });

  const participantRows = db
    .prepare("SELECT player_id FROM arcade_match_players WHERE match_id=? ORDER BY player_id")
    .all(matchId);
  const playerIds = participantRows.map((r) => Number(r.player_id));
  if (!playerIds.includes(Number(me.player.id))) {
    return res.status(403).json({ error: "forbidden" });
  }
  const opponentId = playerIds.find((id) => id !== Number(me.player.id)) || null;
  if (!opponentId) return res.status(400).json({ error: "opponent_not_found" });

  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);
  const rules = getEffectiveRules(me.player.party_id);
  const game = rules.games?.[String(match.game_key || "")];
  if (!game || game.enabled === false) return res.status(400).json({ error: "game_disabled" });

  const queued = queuePlayerForMatchmaking({
    db,
    io: req.app.locals.io,
    me,
    gameKey: String(match.game_key || ""),
    modeKey: String(match.mode_key || ""),
    rematchTargetPlayerId: opponentId,
    rematchOfMatchId: matchId
  });
  if (queued.error === "already_in_queue") {
    return res.status(409).json({ error: "already_in_queue" });
  }

  logEvent({
    partyId: me.player.party_id,
    type: "arcade.match.rematch_request",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_match",
    targetId: matchId,
    message: `Rematch requested for match ${matchId}`,
    data: {
      matchId,
      gameKey: String(match.game_key || ""),
      modeKey: String(match.mode_key || ""),
      opponentId
    },
    io: req.app.locals.io
  });

  return res.json({
    ...buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }),
    matchmakingAction: {
      status: queued.status,
      queueId: Number(queued.queueRow?.id || 0),
      matchId: queued.match ? Number(queued.match.id) : null
    }
  });
});

ticketsRouter.post("/matches/:matchId/complete", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const matchId = Number(req.params?.matchId);
  if (!matchId) return res.status(400).json({ error: "invalid_match_id" });

  const db = getDb();
  const match = db.prepare("SELECT * FROM arcade_matches WHERE id=?").get(matchId);
  if (!match) return res.status(404).json({ error: "match_not_found" });

  const participants = db.prepare(
    "SELECT player_id FROM arcade_match_players WHERE match_id=? ORDER BY player_id"
  ).all(matchId).map((r) => Number(r.player_id));
  if (!participants.includes(Number(me.player.id))) return res.status(403).json({ error: "forbidden" });

  if (String(match.status) === "completed") {
    return res.json({ ok: true, match: loadMatchForPlayer(db, matchId, me.player.id) });
  }

  const winnerPlayerIdInput = req.body?.winnerPlayerId == null ? null : Number(req.body.winnerPlayerId);
  const durationMsInput = req.body?.durationMs == null ? null : Number(req.body.durationMs);
  const durationMs = durationMsInput == null ? null : clampLimit(durationMsInput, 0, 0, 24 * 60 * 60 * 1000);
  const t = now();

  let winnerPlayerId = null;
  let loserPlayerId = null;
  if (winnerPlayerIdInput != null) {
    if (!participants.includes(winnerPlayerIdInput)) return res.status(400).json({ error: "invalid_winner" });
    winnerPlayerId = winnerPlayerIdInput;
    loserPlayerId = participants.find((id) => id !== winnerPlayerId) || null;
  }

  db.prepare(
    `UPDATE arcade_matches
     SET status='completed', ended_at=?, duration_ms=?, winner_player_id=?, loser_player_id=?
     WHERE id=?`
  ).run(t, durationMs, winnerPlayerId, loserPlayerId, matchId);

  db.prepare("UPDATE arcade_match_players SET result='draw', is_winner=0 WHERE match_id=?").run(matchId);
  if (winnerPlayerId) {
    db.prepare(
      "UPDATE arcade_match_players SET result='win', is_winner=1 WHERE match_id=? AND player_id=?"
    ).run(matchId, winnerPlayerId);
  }
  if (loserPlayerId) {
    db.prepare(
      "UPDATE arcade_match_players SET result='loss', is_winner=0 WHERE match_id=? AND player_id=?"
    ).run(matchId, loserPlayerId);
  }

  for (const playerId of participants) {
    req.app.locals.io?.to(`player:${playerId}`).emit("arcade:match:state", {
      matchId,
      status: "completed",
      winnerPlayerId,
      loserPlayerId,
      durationMs
    });
    req.app.locals.io?.to(`player:${playerId}`).emit("tickets:updated");
  }
  req.app.locals.io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: Number(match.party_id),
    type: "arcade.match.completed",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "arcade_match",
    targetId: matchId,
    message: `Match ${matchId} completed`,
    data: { matchId, winnerPlayerId, loserPlayerId, durationMs },
    io: req.app.locals.io
  });

  return res.json({ ok: true, match: loadMatchForPlayer(db, matchId, me.player.id) });
});

ticketsRouter.post("/play", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const gameKey = String(req.body?.gameKey || "").trim();
  const outcome = String(req.body?.outcome || "win").trim();
  const performanceKey = String(req.body?.performance || "normal").trim();
  const seed = req.body?.seed ? String(req.body.seed) : "";
  const payload = req.body?.payload || null;
  const proof = req.body?.proof ? String(req.body.proof) : "";

  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return res.status(400).json({ error: "tickets_disabled" });
  const game = rules.games?.[gameKey];
  if (!game) return res.status(400).json({ error: "invalid_game" });
  if (game.enabled === false) return res.status(400).json({ error: "game_disabled" });
  if (!["win", "loss"].includes(outcome)) return res.status(400).json({ error: "invalid_outcome" });
  if (payload) {
    if (proof && makeProof(seed, payload) !== proof) {
      return res.status(400).json({ error: "invalid_proof" });
    }
    if (seed && !takeSeed(me.player.id, gameKey, seed)) {
      return res.status(400).json({ error: "invalid_seed" });
    }
    if (gameKey === "guess" && !validateGuessPayload({ ...payload, outcome }, seed || "")) {
      return res.status(400).json({ error: "invalid_proof" });
    }
    if (gameKey === "ttt" && !validateTttPayload({ ...payload, outcome })) {
      return res.status(400).json({ error: "invalid_proof" });
    }
  }

  const db = getDb();
  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const playsToday = db
    .prepare("SELECT COUNT(*) as c FROM ticket_plays WHERE player_id=? AND day_key=? AND game_key=?")
    .get(me.player.id, dayKey, gameKey)?.c || 0;
  if (game.dailyLimit && playsToday >= game.dailyLimit) {
    return res.status(400).json({ error: "daily_game_limit" });
  }

  const entryCost = Number(game.entryCost || 0);
  if (entryCost > 0 && row.balance < entryCost) {
    return res.status(400).json({ error: "not_enough_tickets" });
  }

  const lossPenalty = Number(game.lossPenalty || 0);
  const spendCap = Number(rules.dailySpendCap || 0);
  const currentSpent = Number(row.daily_spent || 0);
  if (spendCap > 0) {
    const projectedSpend = currentSpent + entryCost + (outcome === "loss" ? lossPenalty : 0);
    if (projectedSpend > spendCap) {
      return res.status(400).json({ error: "daily_spend_cap" });
    }
  }

  let balance = Number(row.balance || 0) - entryCost;
  let dailyEarned = Number(row.daily_earned || 0);
  let dailySpent = currentSpent + entryCost;
  let streakAfter = Number(row.streak || 0);
  let reward = 0;
  let penalty = 0;
  let baseReward = 0;
  let multiplier = 1;

  if (outcome === "win") {
    const perf = game.performance?.[performanceKey];
    if (!perf) return res.status(400).json({ error: "invalid_performance" });

    baseReward = randInt(game.rewardMin, game.rewardMax);
    streakAfter += 1;

    const streakBonusCount = Math.min(streakAfter, rules.streak.max);
    const streakMultiplier = 1 + Math.min(streakAfter - 1, rules.streak.max) * rules.streak.step;
    const perfMultiplier = Number(perf.multiplier || 1);
    multiplier = Number((streakMultiplier * perfMultiplier).toFixed(2));

    reward = Math.round(baseReward * multiplier + streakBonusCount * (rules.streak.flatBonus || 0));

    if (rules.dailyEarnCap && rules.dailyEarnCap > 0) {
      const remaining = Math.max(0, rules.dailyEarnCap - dailyEarned);
      if (reward > remaining) reward = remaining;
    }

    balance += reward;
    dailyEarned += reward;
  } else {
    penalty = lossPenalty;
    balance = Math.max(0, balance - penalty);
    dailySpent += penalty;
    streakAfter = 0;
  }

  const t = now();
  db.prepare(
    "UPDATE tickets SET balance=?, streak=?, daily_earned=?, daily_spent=?, last_played_at=?, updated_at=? WHERE player_id=?"
  ).run(balance, streakAfter, dailyEarned, dailySpent, t, t, me.player.id);

  db.prepare(
    "INSERT INTO ticket_plays(player_id, game_key, outcome, entry_cost, reward, penalty, multiplier, streak_after, day_key, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(me.player.id, gameKey, outcome, entryCost, reward, penalty, multiplier, streakAfter, dayKey, t);

  try {
    maybeGrantDailyQuest(db, me.player.id, dayKey, rules);
  } catch (e) {
    logger.error({ err: e, playerId: me.player.id, dayKey }, "daily quest reward failed");
  }

  req.app.locals.io?.to(`player:${me.player.id}`).emit("tickets:updated");
  req.app.locals.io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: me.player.party_id ?? getParty().id,
    type: "tickets.play",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "player",
    targetId: me.player.id,
    message: `Игра ${gameKey}: ${outcome} (entry ${entryCost}, reward ${reward}, penalty ${penalty})`,
    data: { gameKey, outcome, entryCost, reward, penalty, multiplier, streakAfter },
    io: req.app.locals.io
  });

  res.json({
    ...buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }),
    result: {
      gameKey,
      outcome,
      entryCost,
      reward,
      penalty,
      baseReward,
      multiplier,
      streakAfter
    }
  });
});

ticketsRouter.post("/purchase", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const itemKey = String(req.body?.itemKey || "").trim();
  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return res.status(400).json({ error: "tickets_disabled" });
  const item = rules.shop?.[itemKey];
  if (!item) return res.status(400).json({ error: "invalid_item" });
  if (item.enabled === false) return res.status(400).json({ error: "item_disabled" });

  const db = getDb();
  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const spentToday = db
    .prepare("SELECT COALESCE(SUM(qty),0) as c FROM ticket_purchases WHERE player_id=? AND day_key=? AND item_key=?")
    .get(me.player.id, dayKey, itemKey)?.c || 0;

  if (item.dailyLimit && spentToday >= item.dailyLimit) {
    return res.status(400).json({ error: "daily_item_limit" });
  }

  const price = Number(item.price || 0);
  if (price > 0 && row.balance < price) {
    return res.status(400).json({ error: "not_enough_tickets" });
  }
  const spendCap = Number(rules.dailySpendCap || 0);
  if (spendCap > 0) {
    const projectedSpend = Number(row.daily_spent || 0) + price;
    if (projectedSpend > spendCap) {
      return res.status(400).json({ error: "daily_spend_cap" });
    }
  }

  const t = now();
  const balance = Math.max(0, Number(row.balance || 0) - price);
  const dailySpent = Number(row.daily_spent || 0) + price;

  db.prepare(
    "UPDATE tickets SET balance=?, daily_spent=?, updated_at=? WHERE player_id=?"
  ).run(balance, dailySpent, t, me.player.id);

  db.prepare(
    "INSERT INTO ticket_purchases(player_id, item_key, qty, cost, day_key, created_at) VALUES(?,?,?,?,?,?)"
  ).run(me.player.id, itemKey, 1, price, dayKey, t);

  req.app.locals.io?.to(`player:${me.player.id}`).emit("tickets:updated");
  req.app.locals.io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: me.player.party_id ?? getParty().id,
    type: "tickets.purchase",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "player",
    targetId: me.player.id,
    message: `Покупка ${itemKey} за ${price}`,
    data: { itemKey, price },
    io: req.app.locals.io
  });

  res.json({
    ...buildPayload(db, me.player.id, dayKey, rules, { partyId: me.player.party_id }),
    result: { itemKey, price }
  });
});

ticketsRouter.get("/dm/metrics", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = Number(getParty().id);
  const days = clampLimit(req.query?.days, ARCADE_METRICS_DAYS, 1, 30);
  return res.json({ metrics: buildDmArcadeMetrics(db, partyId, days) });
});

ticketsRouter.get("/dm/rules", dmAuthMiddleware, (req, res) => {
  const party = getParty();
  const rules = getEffectiveRules(party.id);
  res.json({ rules });
});

ticketsRouter.put("/dm/rules", dmAuthMiddleware, (req, res) => {
  const party = getParty();
  const curSettings = getPartySettings(party.id);
  const currentOverrides = jsonParse(curSettings?.tickets_rules, {});

  const reset = !!req.body?.reset;
  const incoming = req.body?.rules && isPlainObject(req.body.rules) ? { ...req.body.rules } : {};

  const enabledInput = req.body?.enabled;
  const enabled = typeof enabledInput === "boolean" ? enabledInput : (incoming?.enabled ?? curSettings?.tickets_enabled);
  if ("enabled" in incoming) delete incoming.enabled;

  const prevRules = getEffectiveRules(party.id);
  const overrides = reset ? {} : mergeRules(currentOverrides, incoming);
  saveRulesOverride(party.id, enabled, overrides);

  req.app.locals.io?.emit("settings:updated");
  req.app.locals.io?.to("dm").emit("tickets:updated");

  const rules = getEffectiveRules(party.id);
  const prevActive = prevRules?.dailyQuest?.activeKey || "";
  const nextActive = rules?.dailyQuest?.activeKey || "";
  if (prevActive !== nextActive) {
    logEvent({
      partyId: party.id,
      type: "dailyquest.active_changed",
      actorRole: "dm",
      actorName: "DM",
      targetType: "daily_quest",
      targetId: null,
      message: `Активный daily‑quest: ${prevActive || "—"} → ${nextActive || "—"}`,
      data: { prevActive, nextActive },
      io: req.app.locals.io
    });
  }
  res.json({ rules });
});

function handleSetActiveQuest(req, res) {
  const party = getParty();
  const questKey = String(req.body?.questKey || "").trim();
  if (!questKey) return res.status(400).json({ error: "quest_key_required" });

  const rules = getEffectiveRules(party.id);
  const pool = Array.isArray(rules?.dailyQuest?.pool) ? rules.dailyQuest.pool : [];
  const nextQuest = pool.find((q) => q.key === questKey && q.enabled !== false);
  if (!nextQuest) return res.status(400).json({ error: "invalid_quest_key" });

  const curSettings = getPartySettings(party.id);
  const currentOverrides = jsonParse(curSettings?.tickets_rules, {});
  const nextOverrides = mergeRules(currentOverrides, { dailyQuest: { activeKey: questKey } });
  saveRulesOverride(party.id, curSettings?.tickets_enabled, nextOverrides);

  const prevActive = rules?.dailyQuest?.activeKey || "";
  if (prevActive !== questKey) {
    logEvent({
      partyId: party.id,
      type: "dailyquest.active_changed",
      actorRole: "dm",
      actorName: "DM",
      targetType: "daily_quest",
      targetId: null,
      message: `Активный daily‑quest: ${prevActive || "—"} → ${questKey || "—"}`,
      data: { prevActive, nextActive: questKey },
      io: req.app.locals.io
    });
  }

  req.app.locals.io?.emit("tickets:updated");
  res.json({ ok: true, activeKey: questKey });
}

ticketsRouter.post("/dm/quest/active", dmAuthMiddleware, (req, res) => handleSetActiveQuest(req, res));
ticketsRouter.post("/dm/quest/assign", dmAuthMiddleware, (req, res) => handleSetActiveQuest(req, res));

ticketsRouter.post("/dm/quest/reset", dmAuthMiddleware, (req, res) => {
  const party = getParty();
  const rules = getEffectiveRules(party.id);
  const q = getActiveQuest(rules);

  const dayKey = Number(req.body?.dayKey ?? getDayKey());
  const questKey = String(req.body?.questKey || q?.key || "").trim();
  if (!questKey) return res.status(400).json({ error: "quest_key_required" });
  if (!Number.isFinite(dayKey) || dayKey <= 0) return res.status(400).json({ error: "invalid_day_key" });

  const db = getDb();
  const r = db.prepare("DELETE FROM ticket_quests WHERE quest_key=? AND day_key=?").run(questKey, dayKey);

  req.app.locals.io?.to("dm").emit("tickets:updated");
  logEvent({
    partyId: party.id,
    type: "dailyquest.reset",
    actorRole: "dm",
    actorName: "DM",
    targetType: "daily_quest",
    targetId: null,
    message: `Сброс daily‑quest: ${questKey} (dayKey=${dayKey})`,
    data: { questKey, dayKey, deleted: r.changes || 0 },
    io: req.app.locals.io
  });
  res.json({ ok: true, questKey, dayKey, deleted: r.changes || 0 });
});

ticketsRouter.get("/dm/list", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;
  const rows = db.prepare(
    `
    SELECT p.id as playerId,
           p.display_name as displayName,
           COALESCE(t.balance, 0) as balance,
           COALESCE(t.streak, 0) as streak,
           COALESCE(t.daily_earned, 0) as dailyEarned,
           COALESCE(t.daily_spent, 0) as dailySpent,
           t.updated_at as updatedAt
    FROM players p
    LEFT JOIN tickets t ON t.player_id = p.id
    WHERE p.party_id=? AND p.banned=0
    ORDER BY p.id
  `
  ).all(partyId);
  res.json({ items: rows });
});

ticketsRouter.post("/dm/adjust", dmAuthMiddleware, (req, res) => {
  const playerId = Number(req.body?.playerId);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const delta = Number(req.body?.delta || 0);
  const set = req.body?.set != null ? Number(req.body.set) : null;
  const reason = String(req.body?.reason || "").trim();

  const db = getDb();
  let row = ensureTicketRow(db, playerId);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const nextBalance = Math.max(0, set != null ? set : Number(row.balance || 0) + delta);
  const t = now();
  db.prepare("UPDATE tickets SET balance=?, updated_at=? WHERE player_id=?").run(nextBalance, t, playerId);

  req.app.locals.io?.to(`player:${playerId}`).emit("tickets:updated");
  req.app.locals.io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: getParty().id,
    type: "tickets.adjust",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: playerId,
    message: `DM adjust tickets: ${set != null ? `set ${set}` : `delta ${delta}`}${reason ? ` (${reason})` : ""}`,
    data: { playerId, delta, set, reason },
    io: req.app.locals.io
  });

  const rules = getEffectiveRules(getParty().id);
  res.json(buildPayload(db, playerId, dayKey, rules, { partyId: getParty().id }));
});
