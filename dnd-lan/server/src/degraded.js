import { logger } from "./logger.js";

let degraded = false;
let degradedReason = null;
let degradedSince = null;

export function getDegradedState() {
  return {
    degraded,
    reason: degradedReason,
    since: degradedSince
  };
}

export function setDegraded(reason, io) {
  const nextReason = String(reason || "not_ready");
  if (degraded && degradedReason === nextReason) return;
  degraded = true;
  degradedReason = nextReason;
  degradedSince = Date.now();
  logger.warn({ reason: nextReason, since: degradedSince }, "system degraded");
  if (io) io.emit("system:degraded", { ok: false, reason: nextReason, since: degradedSince });
}

export function clearDegraded(io) {
  if (!degraded) return;
  degraded = false;
  degradedReason = null;
  degradedSince = null;
  logger.info("system recovered from degraded state");
  if (io) io.emit("system:degraded", { ok: true });
}
