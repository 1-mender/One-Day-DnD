import express from "express";
import { dmAuthMiddleware, getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb, getParty, getPartySettings, setPartySettings } from "../db.js";
import { now, jsonParse } from "../util.js";
import { logEvent } from "../events.js";

export const ticketsRouter = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

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
  dailyQuest: {
    enabled: true,
    activeKey: DEFAULT_DAILY_QUEST.key,
    pool: [DEFAULT_DAILY_QUEST]
  }
};

function getDayKey(t = now()) {
  return Math.floor(Number(t) / DAY_MS);
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
  return normalizeRules(merged);
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

function buildPayload(db, playerId, dayKey, rules) {
  const row = db.prepare("SELECT * FROM tickets WHERE player_id=?").get(playerId);
  return {
    state: mapState(row),
    rules,
    usage: getUsage(db, playerId, dayKey),
    quests: getQuestStates(db, playerId, dayKey, rules)
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
  res.json(buildPayload(db, me.player.id, dayKey, rules));
});

ticketsRouter.post("/play", (req, res) => {
  const me = getPlayerFromToken(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const gameKey = String(req.body?.gameKey || "").trim();
  const outcome = String(req.body?.outcome || "win").trim();
  const performanceKey = String(req.body?.performance || "normal").trim();

  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return res.status(400).json({ error: "tickets_disabled" });
  const game = rules.games?.[gameKey];
  if (!game) return res.status(400).json({ error: "invalid_game" });
  if (game.enabled === false) return res.status(400).json({ error: "game_disabled" });
  if (!["win", "loss"].includes(outcome)) return res.status(400).json({ error: "invalid_outcome" });

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
    console.error("daily quest reward failed:", e);
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
    ...buildPayload(db, me.player.id, dayKey, rules),
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
    ...buildPayload(db, me.player.id, dayKey, rules),
    result: { itemKey, price }
  });
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

  const overrides = reset ? {} : mergeRules(currentOverrides, incoming);
  saveRulesOverride(party.id, enabled, overrides);

  req.app.locals.io?.emit("settings:updated");
  req.app.locals.io?.to("dm").emit("tickets:updated");

  const rules = getEffectiveRules(party.id);
  res.json({ rules });
});

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
  res.json(buildPayload(db, playerId, dayKey, rules));
});
