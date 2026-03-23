import express from "express";

import { GAME_CATALOG, validateGameCatalog } from "../gameCatalog.js";
import { now } from "../util.js";
import { createSeedStore } from "../tickets/domain/playValidation.js";
import { SEED_TTL_MS } from "../tickets/shared/ticketConstants.js";
import { buildMatchmakingPayload } from "../tickets/services/matchmakingService.js";
import { createTicketRouteAuth } from "../tickets/ticketRouteAuth.js";
import { registerDmTicketRoutes } from "../tickets/routes/dmTicketRoutes.js";
import { registerPlayerTicketRoutes } from "../tickets/routes/playerTicketRoutes.js";

export const ticketsRouter = express.Router();

validateGameCatalog(GAME_CATALOG);

const auth = createTicketRouteAuth({ nowFn: Date.now });
const { issueSeed, takeSeed } = createSeedStore({ ttlMs: SEED_TTL_MS, nowFn: now });

registerPlayerTicketRoutes(ticketsRouter, {
  auth,
  buildMatchmakingPayload,
  issueSeed,
  nowFn: now,
  takeSeed
});

registerDmTicketRoutes(ticketsRouter, {
  buildMatchmakingPayload
});
