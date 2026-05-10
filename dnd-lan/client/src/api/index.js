import { authApi } from "./auth.js";
import { backupApi } from "./backup.js";
import { bestiaryApi } from "./bestiary.js";
import { eventsApi } from "./events.js";
import { infoBlocksApi } from "./infoBlocks.js";
import { inventoryApi } from "./inventory.js";
import { liveActivityApi } from "./liveActivity.js";
import { mapApi, mapAdminApi } from "./map.js";
import { partyApi } from "./party.js";
import { playersApi } from "./players.js";
import { profileApi } from "./profile.js";
import { storage } from "./storage.js";
import { systemApi } from "./system.js";
import { ticketsApi } from "./tickets.js";

export const api = {
  ...systemApi,
  ...authApi,
  ...partyApi,
  ...playersApi,
  ...profileApi,
  ...inventoryApi,
  ...liveActivityApi,
  ...mapApi,
  ...mapAdminApi,
  ...bestiaryApi,
  ...eventsApi,
  ...infoBlocksApi,
  ...ticketsApi,
  ...backupApi
};

export { storage };
