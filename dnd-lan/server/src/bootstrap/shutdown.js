const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10_000);

export function registerShutdown({
  app,
  io,
  httpServer,
  closeDb,
  stopAutoBackups,
  intervals = {},
  logger
}) {
  let shuttingDown = false;

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutdown started");

    if (intervals.idleSweepInterval) clearInterval(intervals.idleSweepInterval);
    if (app.locals.cleanupInterval) clearInterval(app.locals.cleanupInterval);
    if (intervals.readinessInterval) clearInterval(intervals.readinessInterval);
    stopAutoBackups();

    const forceExitTimer = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "forced shutdown after timeout");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    io.close(() => {
      httpServer.close(() => {
        clearTimeout(forceExitTimer);
        try {
          closeDb();
        } catch (error) {
          logger.error({ err: error }, "failed to close DB");
        }
        process.exit(0);
      });
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return { shutdown };
}
