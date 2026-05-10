import { now } from "../../util.js";
import { GAME_CATALOG } from "../../gameCatalog.js";
import { getQuestHistory, getQuestStates } from "./dailyQuestService.js";
import { getDayKey } from "../shared/ticketUtils.js";

export function ensureTicketRow(db, playerId) {
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

export function normalizeDay(db, row, dayKey) {
  if (row.day_key === dayKey) return row;
  const t = now();
  db.prepare(
    "UPDATE tickets SET daily_earned=0, daily_spent=0, day_key=?, streak=0, updated_at=? WHERE player_id=?"
  ).run(dayKey, t, row.player_id);
  return db.prepare("SELECT * FROM tickets WHERE player_id=?").get(row.player_id);
}

export function mapTicketState(row) {
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

export function getTicketUsage(db, playerId, dayKey) {
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

export function buildPlayerArcadeMetrics(history) {
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

export function buildTicketPayload(db, playerId, dayKey, rules, options = {}) {
  const row = db.prepare("SELECT * FROM tickets WHERE player_id=?").get(playerId);
  const historyDays = Number(process.env.DAILY_QUEST_HISTORY_DAYS || 7);
  const matchmaking = options.buildMatchmakingPayload
    ? options.buildMatchmakingPayload(db, playerId, Number(options.partyId || 0))
    : { activeQueue: null, history: [] };

  return {
    state: mapTicketState(row),
    rules,
    catalog: GAME_CATALOG,
    usage: getTicketUsage(db, playerId, dayKey),
    quests: getQuestStates(db, playerId, dayKey, rules),
    questHistory: getQuestHistory(db, playerId, dayKey, rules, historyDays),
    matchmaking,
    arcadeMetrics: buildPlayerArcadeMetrics(matchmaking.history)
  };
}
