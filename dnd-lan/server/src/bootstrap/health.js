import { clearDegraded, setDegraded } from "../degraded.js";
import { registerHealthRoutes } from "../health.js";
import { uploadsDir } from "../paths.js";
import { checkReadiness } from "../readiness.js";

const READINESS_CHECK_EVERY_MS = Number(process.env.READINESS_CHECK_EVERY_MS || 10_000);

export function setupHealth(app, { getDb }) {
  registerHealthRoutes(app, { getDb, uploadsDir });

  const runReadinessCheck = () => {
    const out = checkReadiness({ getDb, uploadsDir });
    if (out.ok) {
      clearDegraded(app.locals.io);
    } else {
      setDegraded(out.error?.message || "not_ready", app.locals.io);
    }
  };

  const readinessInterval = setInterval(runReadinessCheck, READINESS_CHECK_EVERY_MS);
  runReadinessCheck();

  return { readinessInterval, runReadinessCheck };
}
