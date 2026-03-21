import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now } from "../util.js";
import { GAME_CATALOG, validateGameCatalog } from "../gameCatalog.js";
import { getPlayerContextFromRequest, isDmRequest } from "../sessionAuth.js";
import { createSeedStore } from "../tickets/domain/playValidation.js";
import {
  ARCADE_HISTORY_LIMIT,
  ARCADE_METRICS_DAYS,
  SEED_TTL_MS
} from "../tickets/shared/ticketConstants.js";
import {
  clampLimit,
  getDayKey
} from "../tickets/shared/ticketUtils.js";
import { getEffectiveRules } from "../tickets/services/ticketRulesService.js";
import {
  buildTicketPayload,
  ensureTicketRow,
  normalizeDay
} from "../tickets/services/ticketStateService.js";
import {
  buildDmArcadeMetrics,
  buildMatchmakingPayload,
  getMatchHistory,
} from "../tickets/services/matchmakingService.js";
import {
  processMatchmakingQueueCancel,
  processMatchmakingQueueJoin,
  processMatchRematchRequest
} from "../tickets/services/matchmakingActionService.js";
import { processMatchCompletion } from "../tickets/services/matchResolutionService.js";
import { processTicketPlay } from "../tickets/services/ticketPlayService.js";
import { processTicketPurchase } from "../tickets/services/ticketPurchaseService.js";
import {
  adjustPlayerTickets,
  listDmTickets,
  resetDailyQuest,
  setActiveDailyQuest,
  updateDmRules
} from "../tickets/services/ticketAdminService.js";

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
  const result = processMatchmakingQueueJoin({
    db: getDb(),
    io: req.app.locals.io,
    me,
    body: req.body,
    buildMatchmakingPayload
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/matchmaking/cancel", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const result = processMatchmakingQueueCancel({
    db: getDb(),
    io: req.app.locals.io,
    me,
    body: req.body,
    buildMatchmakingPayload,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
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
  const result = processMatchRematchRequest({
    db: getDb(),
    io: req.app.locals.io,
    me,
    matchId: req.params?.matchId,
    buildMatchmakingPayload
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/matches/:matchId/complete", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const result = processMatchCompletion({
    db: getDb(),
    io: req.app.locals.io,
    me,
    matchId: req.params?.matchId,
    body: req.body,
    nowFn: now
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/play", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const result = processTicketPlay({
    db: getDb(),
    io: req.app.locals.io,
    me,
    body: req.body,
    takeSeed,
    nowFn: now,
    buildMatchmakingPayload
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/purchase", (req, res) => {
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!me) return res.status(401).json({ error: "not_authenticated" });
  const result = processTicketPurchase({
    db: getDb(),
    io: req.app.locals.io,
    me,
    body: req.body,
    nowFn: now,
    buildMatchmakingPayload
  });
  return res.status(result.status).json(result.body);
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
  const result = updateDmRules({ party: getParty(), body: req.body, io: req.app.locals.io });
  return res.status(result.status).json(result.body);
});
ticketsRouter.post("/dm/quest/active", dmAuthMiddleware, (req, res) => {
  const result = setActiveDailyQuest({ party: getParty(), body: req.body, io: req.app.locals.io });
  return res.status(result.status).json(result.body);
});
ticketsRouter.post("/dm/quest/assign", dmAuthMiddleware, (req, res) => {
  const result = setActiveDailyQuest({ party: getParty(), body: req.body, io: req.app.locals.io });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/dm/quest/reset", dmAuthMiddleware, (req, res) => {
  const result = resetDailyQuest({ db: getDb(), party: getParty(), body: req.body, io: req.app.locals.io });
  return res.status(result.status).json(result.body);
});

ticketsRouter.get("/dm/list", dmAuthMiddleware, (req, res) => {
  const result = listDmTickets({ db: getDb(), partyId: getParty().id });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/dm/adjust", dmAuthMiddleware, (req, res) => {
  const result = adjustPlayerTickets({
    db: getDb(),
    party: getParty(),
    body: req.body,
    io: req.app.locals.io,
    buildMatchmakingPayload
  });
  return res.status(result.status).json(result.body);
});

