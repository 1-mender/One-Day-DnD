import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getLanIPv4 } from "../ip.js";
import { dbHasDm, getPartySettings, getSingleParty } from "../db.js";
import { LIMITS } from "../limits.js";
import { getRuntimeMetricsSnapshot } from "../runtimeMetrics.js";
import { MAP_ALLOWED_MIMES, MAP_UPLOAD_MAX_BYTES } from "./map.js";

export const serverInfoRouter = express.Router();

serverInfoRouter.get("/info", (req, res) => {
  const ips = getLanIPv4();
  const port = Number(process.env.PORT || 3000);
  const party = getSingleParty();
  const settings = getPartySettings(party.id);
  res.json({
    hasDm: dbHasDm(),
    ips,
    port,
    urls: ips.map((ip) => `http://${ip}:${port}`),
    party: { id: party.id, name: party.name, joinCodeEnabled: !!party.join_code },
    settings: {
      bestiaryEnabled: !!settings.bestiary_enabled,
      ticketsEnabled: settings.tickets_enabled == null ? true : !!settings.tickets_enabled,
      inventoryWeightLimit: LIMITS.inventoryWeight || 0,
      mapUpload: {
        maxBytes: MAP_UPLOAD_MAX_BYTES,
        maxMegabytes: Number((MAP_UPLOAD_MAX_BYTES / (1024 * 1024)).toFixed(1)),
        allowedMimeTypes: MAP_ALLOWED_MIMES
      }
    }
  });
});

serverInfoRouter.get("/metrics", dmAuthMiddleware, (req, res) => {
  res.json(getRuntimeMetricsSnapshot());
});
