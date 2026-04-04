import { dmAuthMiddleware } from "../../auth.js";
import { getDb, getSingleParty, getSinglePartyId } from "../../db.js";
import {
  adjustPlayerTickets,
  listDmTickets,
  resetDailyQuest,
  setActiveDailyQuest,
  updateDmRules
} from "../services/ticketAdminService.js";
import { getDmTicketMetricsPayload, getTicketRulesPayload } from "../services/ticketQueryService.js";
import {
  dmAdjustBodySchema,
  dmMetricsQuerySchema,
  dmQuestBodySchema,
  dmQuestResetBodySchema,
  dmRulesBodySchema,
  parseTicketRouteInput
} from "./dmTicketRouteSchemas.js";
import { createRouteInputReader } from "../../routes/routeValidation.js";

const requireValidRouteInput = createRouteInputReader(parseTicketRouteInput);

export function registerDmTicketRoutes(router, { buildMatchmakingPayload }) {
  router.get("/dm/metrics", dmAuthMiddleware, (req, res) => {
    const query = requireValidRouteInput(res, dmMetricsQuerySchema, req.query);
    if (!query) return;
    const result = getDmTicketMetricsPayload({
      db: getDb(),
      partyId: Number(getSinglePartyId()),
      days: query.days
    });
    return res.status(result.status).json(result.body);
  });

  router.get("/dm/rules", dmAuthMiddleware, (_req, res) => {
    const result = getTicketRulesPayload({ partyId: getSinglePartyId() });
    return res.status(result.status).json(result.body);
  });

  router.put("/dm/rules", dmAuthMiddleware, (req, res) => {
    const body = requireValidRouteInput(res, dmRulesBodySchema, req.body);
    if (!body) return;
    const result = updateDmRules({ party: getSingleParty(), body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/quest/active", dmAuthMiddleware, (req, res) => {
    const body = requireValidRouteInput(res, dmQuestBodySchema, req.body);
    if (!body) return;
    const result = setActiveDailyQuest({ party: getSingleParty(), body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/quest/assign", dmAuthMiddleware, (req, res) => {
    const body = requireValidRouteInput(res, dmQuestBodySchema, req.body);
    if (!body) return;
    const result = setActiveDailyQuest({ party: getSingleParty(), body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/quest/reset", dmAuthMiddleware, (req, res) => {
    const body = requireValidRouteInput(res, dmQuestResetBodySchema, req.body);
    if (!body) return;
    const result = resetDailyQuest({ db: getDb(), party: getSingleParty(), body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.get("/dm/list", dmAuthMiddleware, (_req, res) => {
    const result = listDmTickets({ db: getDb(), partyId: getSinglePartyId() });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/adjust", dmAuthMiddleware, (req, res) => {
    const body = requireValidRouteInput(res, dmAdjustBodySchema, req.body);
    if (!body) return;
    const result = adjustPlayerTickets({
      db: getDb(),
      party: getSingleParty(),
      body,
      io: req.app.locals.io,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });
}
