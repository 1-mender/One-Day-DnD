import http from "node:http";

import { stopAutoBackups } from "./backup.js";
import { createApp, finalizeApp } from "./bootstrap/app.js";
import { setupHealth } from "./bootstrap/health.js";
import { startBackgroundJobs } from "./bootstrap/jobs.js";
import { registerShutdown } from "./bootstrap/shutdown.js";
import { runStartup } from "./bootstrap/startup.js";
import { closeDb, getDb } from "./db.js";
import { logger } from "./logger.js";
import { createSocketServer } from "./sockets.js";

const PORT = Number(process.env.PORT || 3000);

runStartup();

const app = createApp();
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);
app.locals.io = io;

const { readinessInterval } = setupHealth(app, { getDb });
finalizeApp(app);
const { idleSweepInterval } = startBackgroundJobs({ app, io, getDb, logger });

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info({ port: PORT }, "LAN server listening on 0.0.0.0");
  logger.info({ port: PORT, url: `http://localhost:${PORT}/dm` }, "DM available");
});

registerShutdown({
  app,
  io,
  httpServer,
  closeDb,
  stopAutoBackups,
  intervals: { idleSweepInterval, readinessInterval },
  logger
});
