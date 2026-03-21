import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty, getPartySettings } from "../db.js";
import { now, jsonParse } from "../util.js";
import { logEvent } from "../events.js";
import { GAME_CATALOG, validateGameCatalog } from "../gameCatalog.js";
import { logger } from "../logger.js";
import { getPlayerContextFromRequest, isDmRequest } from "../sessionAuth.js";
import {
  createSeedStore,
  makePlayClientProof,
  randInt,
  validateGuessPayload,
  validateMatch3Payload,
  validateScrabblePayload,
  validateTttPayload,
  validateUnoPayload
} from "../tickets/domain/playValidation.js";
import { mergeRules } from "../tickets/domain/rules.js";
import {
  ARCADE_HISTORY_LIMIT,
  ARCADE_METRICS_DAYS,
  MIN_ARCADE_PLAY_MS,
  SEED_TTL_MS
} from "../tickets/shared/ticketConstants.js";
import {
  clampLimit,
  getDayKey,
  isPlainObject
} from "../tickets/shared/ticketUtils.js";
import {
  getActiveQuest,
  maybeGrantDailyQuest
} from "../tickets/services/dailyQuestService.js";
import { getEffectiveRules, saveRulesOverride } from "../tickets/services/ticketRulesService.js";
import {
  buildTicketPayload,
  ensureTicketRow,
  normalizeDay
} from "../tickets/services/ticketStateService.js";
import {
  buildDmArcadeMetrics,
  buildMatchmakingPayload,
  cleanupExpiredQueue,
  emitQueueUpdated,
  getActiveQueueRow,
  getMatchHistory,
  loadMatchForPlayer,
  queuePlayerForMatchmaking,
  resolveModeKey
} from "../tickets/services/matchmakingService.js";

export const ticketsRouter = express.Router();

validateGameCatalog();
const { issueSeed, takeSeed } = createSeedStore({ ttlMs: SEED_TTL_MS, nowFn: now });

ticketsRouter.get("/rules", (req, res) => {
  const isDm = isDmRequest(req);
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });
  const partyId = me?.player?.party_id ?? getParty().id;
  res.json({ rules: getEffectiveRules(partyId) });
});

ticketsRouter.get("/me", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const db = getDb();
  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const rules = getEffectiveRules(me.player.party_id);
  res.json(buildTicketPayload(db, me.player.id, dayKey, rules, {
    partyId: me.player.party_id,
    buildMatchmakingPayload
  }));
});

ticketsRouter.get("/catalog", (req, res) => {
  res.json({ catalog: GAME_CATALOG });
});

ticketsRouter.get("/seed", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const gameKey = String(req.query?.gameKey || "").trim();
  if (!gameKey || !GAME_CATALOG.find((g) => g.key === gameKey)) {
    return res.status(400).json({ error: "invalid_game" });
  }
  const issued = issueSeed(me.player.id, gameKey);
  res.json({ seed: issued.seed, proof: issued.proof, gameKey });
});

ticketsRouter.post("/matchmaking/queue", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
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
    ...buildTicketPayload(db, me.player.id, dayKey, rules, {
      partyId: me.player.party_id,
      buildMatchmakingPayload
    }),
    matchmakingAction: {
      status: queued.status,
      queueId: Number(queued.queueRow?.id || 0),
      matchId: queued.match ? Number(queued.match.id) : null
    }
  });
});

ticketsRouter.post("/matchmaking/cancel", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
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
      ...buildTicketPayload(db, me.player.id, dayKey, rules, {
        partyId: me.player.party_id,
        buildMatchmakingPayload
      }),
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
    ...buildTicketPayload(db, me.player.id, dayKey, rules, {
      partyId: me.player.party_id,
      buildMatchmakingPayload
    }),
    matchmakingAction: { status: "canceled", queueId: Number(active.id) }
  });
});

ticketsRouter.get("/matches/history", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const db = getDb();
  const limit = clampLimit(req.query?.limit, ARCADE_HISTORY_LIMIT, 1, 50);
  return res.json({ items: getMatchHistory(db, me.player.id, limit) });
});

ticketsRouter.post("/matches/:matchId/rematch", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
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
    ...buildTicketPayload(db, me.player.id, dayKey, rules, {
      partyId: me.player.party_id,
      buildMatchmakingPayload
    }),
    matchmakingAction: {
      status: queued.status,
      queueId: Number(queued.queueRow?.id || 0),
      matchId: queued.match ? Number(queued.match.id) : null
    }
  });
});

ticketsRouter.post("/matches/:matchId/complete", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
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
  const outcomeInputRaw = String(req.body?.outcome || "").trim().toLowerCase();
  const durationMsInput = req.body?.durationMs == null ? null : Number(req.body.durationMs);
  const durationMs = durationMsInput == null ? null : clampLimit(durationMsInput, 0, 0, 24 * 60 * 60 * 1000);
  const currentDurationMs = match.duration_ms == null ? null : Number(match.duration_ms);
  const mergedDurationMs = durationMs == null
    ? currentDurationMs
    : (currentDurationMs == null ? durationMs : Math.max(currentDurationMs, durationMs));
  const t = now();

  if (winnerPlayerIdInput != null) {
    return res.status(403).json({ error: "winner_locked" });
  }
  if (!["win", "loss", "draw"].includes(outcomeInputRaw)) {
    return res.status(400).json({ error: "invalid_outcome" });
  }

  const selfRow = db.prepare(
    "SELECT player_id, result FROM arcade_match_players WHERE match_id=? AND player_id=?"
  ).get(matchId, me.player.id);
  if (!selfRow) return res.status(403).json({ error: "forbidden" });

  if (selfRow.result !== "pending" && String(selfRow.result) !== outcomeInputRaw) {
    return res.status(409).json({ error: "already_submitted" });
  }
  if (selfRow.result === "pending") {
    db.prepare(
      "UPDATE arcade_match_players SET result=?, is_winner=? WHERE match_id=? AND player_id=?"
    ).run(outcomeInputRaw, outcomeInputRaw === "win" ? 1 : 0, matchId, me.player.id);
  }
  if (durationMs != null) {
    db.prepare("UPDATE arcade_matches SET duration_ms=? WHERE id=?").run(mergedDurationMs, matchId);
  }

  const results = db.prepare(
    "SELECT player_id, result FROM arcade_match_players WHERE match_id=? ORDER BY player_id"
  ).all(matchId).map((row) => ({ playerId: Number(row.player_id), result: String(row.result || "pending") }));
  const pendingCount = results.filter((row) => row.result === "pending").length;
  if (pendingCount > 0) {
    return res.json({
      ok: true,
      awaitingOpponent: true,
      match: loadMatchForPlayer(db, matchId, me.player.id)
    });
  }

  const wins = results.filter((row) => row.result === "win");
  const losses = results.filter((row) => row.result === "loss");
  let winnerPlayerId = null;
  let loserPlayerId = null;
  let resolution = "draw";
  if (participants.length === 2 && wins.length === 1 && losses.length === 1) {
    winnerPlayerId = Number(wins[0].playerId);
    loserPlayerId = Number(losses[0].playerId);
    resolution = "win_loss";
  } else if (wins.length === 0 && losses.length === 0) {
    winnerPlayerId = null;
    loserPlayerId = null;
    resolution = "draw";
  } else {
    resolution = "conflict_draw";
    db.prepare("UPDATE arcade_match_players SET result='draw', is_winner=0 WHERE match_id=?").run(matchId);
  }

  db.prepare(
    `UPDATE arcade_matches
     SET status='completed', ended_at=?, duration_ms=?, winner_player_id=?, loser_player_id=?
     WHERE id=?`
  ).run(t, mergedDurationMs, winnerPlayerId, loserPlayerId, matchId);

  for (const playerId of participants) {
    req.app.locals.io?.to(`player:${playerId}`).emit("arcade:match:state", {
      matchId,
      status: "completed",
      winnerPlayerId,
      loserPlayerId,
      durationMs: mergedDurationMs
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
    data: { matchId, winnerPlayerId, loserPlayerId, durationMs: mergedDurationMs, resolution },
    io: req.app.locals.io
  });

  return res.json({ ok: true, match: loadMatchForPlayer(db, matchId, me.player.id) });
});

ticketsRouter.post("/play", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  const gameKey = String(req.body?.gameKey || "").trim();
  const outcome = String(req.body?.outcome || "").trim().toLowerCase();
  const performanceKey = String(req.body?.performance || "normal").trim();
  const seed = req.body?.seed ? String(req.body.seed) : "";
  const payload = req.body?.payload;
  const proof = req.body?.proof ? String(req.body.proof) : "";
  const clientProof = req.body?.clientProof ? String(req.body.clientProof) : "";

  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return res.status(400).json({ error: "tickets_disabled" });
  const game = rules.games?.[gameKey];
  if (!game) return res.status(400).json({ error: "invalid_game" });
  if (game.enabled === false) return res.status(400).json({ error: "game_disabled" });
  if (!["win", "loss"].includes(outcome)) return res.status(400).json({ error: "invalid_outcome" });
  if (outcome === "loss" && performanceKey !== "normal") return res.status(400).json({ error: "invalid_proof" });
  if (!isPlainObject(payload)) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  if (!seed || !proof) {
    return res.status(400).json({ error: "invalid_seed" });
  }
  const seedTicket = takeSeed(me.player.id, gameKey, seed, proof);
  if (!seedTicket) {
    return res.status(400).json({ error: "invalid_seed" });
  }
  const expectedClientProof = makePlayClientProof(seed, {
    gameKey,
    outcome,
    performance: performanceKey,
    payload
  });
  if (!clientProof || clientProof !== expectedClientProof) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  const elapsedMs = Math.max(0, now() - Number(seedTicket?.issuedAt || 0));
  const minPlayMs = Number(MIN_ARCADE_PLAY_MS[gameKey] || 0);
  if (outcome === "win" && minPlayMs > 0 && elapsedMs < minPlayMs) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  if (gameKey === "guess" && !validateGuessPayload({ ...payload, outcome }, seed || "")) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  if (gameKey === "ttt" && !validateTttPayload({ ...payload, outcome })) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  if (gameKey === "match3" && !validateMatch3Payload(payload, outcome, performanceKey)) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  if (gameKey === "uno" && !validateUnoPayload(payload, outcome, performanceKey)) {
    return res.status(400).json({ error: "invalid_proof" });
  }
  if (gameKey === "scrabble" && !validateScrabblePayload(payload, outcome, performanceKey)) {
    return res.status(400).json({ error: "invalid_proof" });
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
    message: `Game ${gameKey}: ${outcome} (entry ${entryCost}, reward ${reward}, penalty ${penalty})`,
    data: { gameKey, outcome, entryCost, reward, penalty, multiplier, streakAfter },
    io: req.app.locals.io
  });

  res.json({
    ...buildTicketPayload(db, me.player.id, dayKey, rules, {
      partyId: me.player.party_id,
      buildMatchmakingPayload
    }),
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
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
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
    message: `Purchase ${itemKey} for ${price}`,
    data: { itemKey, price },
    io: req.app.locals.io
  });

  res.json({
    ...buildTicketPayload(db, me.player.id, dayKey, rules, {
      partyId: me.player.party_id,
      buildMatchmakingPayload
    }),
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
      message: `Active daily quest: ${prevActive || "-"} -> ${nextActive || "-"}`,
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
      message: `Active daily quest: ${prevActive || "-"} -> ${questKey || "-"}`,
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
  const r = db.prepare(
    `DELETE FROM ticket_quests
     WHERE quest_key=? AND day_key=?
       AND player_id IN (SELECT id FROM players WHERE party_id=?)`
  ).run(questKey, dayKey, party.id);

  req.app.locals.io?.to("dm").emit("tickets:updated");
  logEvent({
    partyId: party.id,
    type: "dailyquest.reset",
    actorRole: "dm",
    actorName: "DM",
    targetType: "daily_quest",
    targetId: null,
    message: `Reset daily quest: ${questKey} (dayKey=${dayKey})`,
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
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=?").get(playerId);
  if (!player) return res.status(404).json({ error: "player_not_found" });
  let row = ensureTicketRow(db, playerId);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const nextBalance = Math.max(0, set != null ? set : Number(row.balance || 0) + delta);
  const t = now();
  db.prepare("UPDATE tickets SET balance=?, updated_at=? WHERE player_id=?").run(nextBalance, t, playerId);

  req.app.locals.io?.to(`player:${playerId}`).emit("tickets:updated");
  req.app.locals.io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: player.party_id,
    type: "tickets.adjust",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player",
    targetId: playerId,
    message: `DM adjust tickets: ${set != null ? `set ${set}` : `delta ${delta}`}${reason ? ` (${reason})` : ""}`,
    data: { playerId, delta, set, reason },
    io: req.app.locals.io
  });

  const rules = getEffectiveRules(player.party_id);
  res.json(buildTicketPayload(db, playerId, dayKey, rules, {
    partyId: player.party_id,
    buildMatchmakingPayload
  }));
});

