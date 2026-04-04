import { getDb, getSinglePartyId } from "../../db.js";
import { isDmRequest } from "../../sessionAuth.js";
import {
  processArcadeSessionFinish,
  processArcadeSessionMove,
  processArcadeSessionStart
} from "../services/arcadeSessionService.js";
import { processMatchmakingQueueCancel, processMatchmakingQueueJoin, processMatchRematchRequest } from "../services/matchmakingActionService.js";
import { processMatchCompletion } from "../services/matchResolutionService.js";
import { processTicketPlay } from "../services/ticketPlayService.js";
import { processTicketPurchase } from "../services/ticketPurchaseService.js";
import {
  getTicketCatalogPayload,
  getTicketMatchHistoryPayload,
  getTicketMePayload,
  getTicketRulesPayload,
  issueTicketSeedPayload
} from "../services/ticketQueryService.js";
import {
  gameStartBodySchema,
  gameStartParamsSchema,
  matchCompleteBodySchema,
  matchHistoryQuerySchema,
  matchIdParamsSchema,
  parseTicketRouteInput,
  purchaseBodySchema,
  queueCancelBodySchema,
  queueJoinBodySchema,
  sessionMoveBodySchema,
  sessionParamsSchema
} from "./ticketRouteSchemas.js";
import { createRouteInputReader } from "../../routes/routeValidation.js";

const requireValidRouteInput = createRouteInputReader(parseTicketRouteInput);

export function registerPlayerTicketRoutes(router, {
  arcadeSessions,
  auth,
  buildMatchmakingPayload,
  issueSeed,
  nowFn,
  takeSeed
}) {
  router.get("/rules", (req, res) => {
    const isDm = isDmRequest(req);
    const me = auth.resolvePlayerContext(req);
    if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });
    const partyId = me?.player?.party_id ?? getSinglePartyId();
    const result = getTicketRulesPayload({ partyId });
    return res.status(result.status).json(result.body);
  });

  router.get("/me", (req, res) => {
    const me = auth.requirePlayer(req, res);
    if (!me) return;
    const result = getTicketMePayload({
      db: getDb(),
      playerId: me.player.id,
      partyId: me.player.party_id,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });

  router.get("/catalog", (_req, res) => {
    const result = getTicketCatalogPayload();
    return res.status(result.status).json(result.body);
  });

  router.get("/seed", (req, res) => {
    const me = auth.requirePlayer(req, res);
    if (!me) return;
    void issueSeed;
    void issueTicketSeedPayload;
    return res.status(410).json({ error: "legacy_arcade_api_disabled" });
  });

  router.post("/games/:gameKey/start", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const params = requireValidRouteInput(res, gameStartParamsSchema, req.params);
    if (!params) return;
    const body = requireValidRouteInput(res, gameStartBodySchema, req.body);
    if (!body) return;
    const result = processArcadeSessionStart({
      me,
      gameKey: params.gameKey,
      body,
      startSession: arcadeSessions.startSession
    });
    return res.status(result.status).json(result.body);
  });

  router.post("/games/sessions/:sessionId/move", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const params = requireValidRouteInput(res, sessionParamsSchema, req.params);
    if (!params) return;
    const body = requireValidRouteInput(res, sessionMoveBodySchema, req.body);
    if (!body) return;
    const result = processArcadeSessionMove({
      me,
      sessionId: params.sessionId,
      body,
      moveSession: arcadeSessions.moveSession
    });
    return res.status(result.status).json(result.body);
  });

  router.post("/games/sessions/:sessionId/finish", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const params = requireValidRouteInput(res, sessionParamsSchema, req.params);
    if (!params) return;
    const result = processArcadeSessionFinish({
      db: getDb(),
      io: req.app.locals.io,
      me,
      sessionId: params.sessionId,
      finishSession: arcadeSessions.finishSession,
      nowFn,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });

  router.post("/matchmaking/queue", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const body = requireValidRouteInput(res, queueJoinBodySchema, req.body);
    if (!body) return;
    const result = processMatchmakingQueueJoin({
      db: getDb(),
      io: req.app.locals.io,
      me,
      body,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });

  router.post("/matchmaking/cancel", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const body = requireValidRouteInput(res, queueCancelBodySchema, req.body);
    if (!body) return;
    const result = processMatchmakingQueueCancel({
      db: getDb(),
      io: req.app.locals.io,
      me,
      body,
      buildMatchmakingPayload,
      nowFn
    });
    return res.status(result.status).json(result.body);
  });

  router.get("/matches/history", (req, res) => {
    const me = auth.requirePlayer(req, res);
    if (!me) return;
    const query = requireValidRouteInput(res, matchHistoryQuerySchema, req.query);
    if (!query) return;
    const result = getTicketMatchHistoryPayload({ db: getDb(), playerId: me.player.id, limit: query.limit });
    return res.status(result.status).json(result.body);
  });

  router.post("/matches/:matchId/rematch", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const params = requireValidRouteInput(res, matchIdParamsSchema, req.params);
    if (!params) return;
    const result = processMatchRematchRequest({
      db: getDb(),
      io: req.app.locals.io,
      me,
      matchId: params.matchId,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });

  router.post("/matches/:matchId/complete", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const params = requireValidRouteInput(res, matchIdParamsSchema, req.params);
    if (!params) return;
    const body = requireValidRouteInput(res, matchCompleteBodySchema, req.body);
    if (!body) return;
    const result = processMatchCompletion({
      db: getDb(),
      io: req.app.locals.io,
      me,
      matchId: params.matchId,
      body,
      nowFn
    });
    return res.status(result.status).json(result.body);
  });

  router.post("/play", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    void processTicketPlay;
    void takeSeed;
    void nowFn;
    void buildMatchmakingPayload;
    return res.status(410).json({ error: "legacy_arcade_api_disabled" });
  });

  router.post("/purchase", (req, res) => {
    const me = auth.requireWritablePlayer(req, res);
    if (!me) return;
    const body = requireValidRouteInput(res, purchaseBodySchema, req.body);
    if (!body) return;
    const result = processTicketPurchase({
      db: getDb(),
      io: req.app.locals.io,
      me,
      body,
      nowFn,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });
}
