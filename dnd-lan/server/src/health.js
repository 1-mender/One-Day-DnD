import { checkReadiness } from "./readiness.js";
import { logger } from "./logger.js";

export function registerHealthRoutes(app, { getDb, uploadsDir }) {
  app.get("/healthz", (_req, res) => {
    return res.status(200).json({ ok: true, uptimeSec: Math.round(process.uptime()) });
  });

  app.get("/readyz", (_req, res) => {
    const out = checkReadiness({ getDb, uploadsDir });
    if (out.ok) return res.status(200).json({ ok: true });
    logger.error({ err: out.error }, "readiness check failed");
    return res.status(503).json({ ok: false, error: "not_ready" });
  });
}
