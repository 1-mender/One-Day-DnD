import { checkReadiness } from "./readiness.js";
import { logger } from "./logger.js";

const READYZ_ERROR_LOG_INTERVAL_MS = Number(process.env.READYZ_ERROR_LOG_INTERVAL_MS || 60_000);
let lastReadyzErrorKey = "";
let lastReadyzErrorAt = 0;

function toReadyzErrorKey(error) {
  return String(error?.code || error?.message || "not_ready");
}

function shouldLogReadyzFailure(error) {
  const key = toReadyzErrorKey(error);
  const currentTime = Date.now();
  const shouldLog = key !== lastReadyzErrorKey || currentTime - lastReadyzErrorAt >= READYZ_ERROR_LOG_INTERVAL_MS;
  if (shouldLog) {
    lastReadyzErrorKey = key;
    lastReadyzErrorAt = currentTime;
  }
  return shouldLog;
}

export function resetReadyzLogStateForTest() {
  lastReadyzErrorKey = "";
  lastReadyzErrorAt = 0;
}

export function registerHealthRoutes(app, { getDb, uploadsDir }) {
  app.get("/healthz", (_req, res) => {
    return res.status(200).json({ ok: true, uptimeSec: Math.round(process.uptime()) });
  });

  app.get("/readyz", (_req, res) => {
    const out = checkReadiness({ getDb, uploadsDir });
    if (out.ok) {
      resetReadyzLogStateForTest();
      return res.status(200).json({ ok: true });
    }
    if (shouldLogReadyzFailure(out.error)) {
      logger.error({ err: out.error }, "readiness check failed");
    }
    return res.status(503).json({ ok: false, error: "not_ready" });
  });
}
