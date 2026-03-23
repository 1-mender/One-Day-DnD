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

export function registerDmTicketRoutes(router, { buildMatchmakingPayload }) {
  router.get("/dm/metrics", dmAuthMiddleware, (req, res) => {
    const result = getDmTicketMetricsPayload({
      db: getDb(),
      partyId: Number(getSinglePartyId()),
      days: req.query?.days
    });
    return res.status(result.status).json(result.body);
  });

  router.get("/dm/rules", dmAuthMiddleware, (_req, res) => {
    const result = getTicketRulesPayload({ partyId: getSinglePartyId() });
    return res.status(result.status).json(result.body);
  });

  router.put("/dm/rules", dmAuthMiddleware, (req, res) => {
    const result = updateDmRules({ party: getSingleParty(), body: req.body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/quest/active", dmAuthMiddleware, (req, res) => {
    const result = setActiveDailyQuest({ party: getSingleParty(), body: req.body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/quest/assign", dmAuthMiddleware, (req, res) => {
    const result = setActiveDailyQuest({ party: getSingleParty(), body: req.body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/quest/reset", dmAuthMiddleware, (req, res) => {
    const result = resetDailyQuest({ db: getDb(), party: getSingleParty(), body: req.body, io: req.app.locals.io });
    return res.status(result.status).json(result.body);
  });

  router.get("/dm/list", dmAuthMiddleware, (_req, res) => {
    const result = listDmTickets({ db: getDb(), partyId: getSinglePartyId() });
    return res.status(result.status).json(result.body);
  });

  router.post("/dm/adjust", dmAuthMiddleware, (req, res) => {
    const result = adjustPlayerTickets({
      db: getDb(),
      party: getSingleParty(),
      body: req.body,
      io: req.app.locals.io,
      buildMatchmakingPayload
    });
    return res.status(result.status).json(result.body);
  });
}
