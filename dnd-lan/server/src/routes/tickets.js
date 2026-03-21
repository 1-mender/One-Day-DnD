import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now } from "../util.js";
import { GAME_CATALOG, validateGameCatalog } from "../gameCatalog.js";
import { getPlayerContextFromRequest, isDmRequest } from "../sessionAuth.js";
import { createSeedStore } from "../tickets/domain/playValidation.js";
import {
  SEED_TTL_MS
} from "../tickets/shared/ticketConstants.js";
import { buildMatchmakingPayload } from "../tickets/services/matchmakingService.js";
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
import {
  getDmTicketMetricsPayload,
  getTicketCatalogPayload,
  getTicketMatchHistoryPayload,
  getTicketMePayload,
  getTicketRulesPayload,
  issueTicketSeedPayload
} from "../tickets/services/ticketQueryService.js";

export const ticketsRouter = express.Router();

validateGameCatalog();
const { issueSeed, takeSeed } = createSeedStore({ ttlMs: SEED_TTL_MS, nowFn: now });

function resolvePlayerContext(req) {
  return getPlayerContextFromRequest(req, { at: Date.now() });
}

function requirePlayer(req, res) {
  const me = resolvePlayerContext(req);
  if (!me) {
    res.status(401).json({ error: "not_authenticated" });
    return null;
  }
  return me;
}

ticketsRouter.get("/rules", (req, res) => {
  const isDm = isDmRequest(req);
  const me = resolvePlayerContext(req);
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });
  const partyId = me?.player?.party_id ?? getParty().id;
  const result = getTicketRulesPayload({ partyId });
  return res.status(result.status).json(result.body);
});

ticketsRouter.get("/me", (req, res) => {
  const me = requirePlayer(req, res);
  if (!me) return;
  const result = getTicketMePayload({
    db: getDb(),
    playerId: me.player.id,
    partyId: me.player.party_id,
    buildMatchmakingPayload
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.get("/catalog", (req, res) => {
  const result = getTicketCatalogPayload();
  return res.status(result.status).json(result.body);
});

ticketsRouter.get("/seed", (req, res) => {
  const me = requirePlayer(req, res);
  if (!me) return;
  const result = issueTicketSeedPayload({
    playerId: me.player.id,
    gameKey: req.query?.gameKey,
    issueSeedFn: issueSeed
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/matchmaking/queue", (req, res) => {
  const me = requirePlayer(req, res);
  if (!me) return;
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
  const me = requirePlayer(req, res);
  if (!me) return;
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
  const me = requirePlayer(req, res);
  if (!me) return;
  const result = getTicketMatchHistoryPayload({ db: getDb(), playerId: me.player.id, limit: req.query?.limit });
  return res.status(result.status).json(result.body);
});

ticketsRouter.post("/matches/:matchId/rematch", (req, res) => {
  const me = requirePlayer(req, res);
  if (!me) return;
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
  const me = requirePlayer(req, res);
  if (!me) return;
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
  const me = requirePlayer(req, res);
  if (!me) return;
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
  const me = requirePlayer(req, res);
  if (!me) return;
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
  const result = getDmTicketMetricsPayload({
    db: getDb(),
    partyId: Number(getParty().id),
    days: req.query?.days
  });
  return res.status(result.status).json(result.body);
});

ticketsRouter.get("/dm/rules", dmAuthMiddleware, (req, res) => {
  const result = getTicketRulesPayload({ partyId: getParty().id });
  return res.status(result.status).json(result.body);
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

