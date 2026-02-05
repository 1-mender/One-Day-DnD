import fs from "node:fs";

export function registerHealthRoutes(app, { getDb, uploadsDir }) {
  app.get("/healthz", (_req, res) => {
    return res.status(200).json({ ok: true, uptimeSec: Math.round(process.uptime()) });
  });

  app.get("/readyz", (_req, res) => {
    try {
      const db = getDb();
      db.prepare("SELECT 1 AS ok").get();
      fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("readiness check failed:", error);
      return res.status(503).json({ ok: false, error: "not_ready" });
    }
  });
}
