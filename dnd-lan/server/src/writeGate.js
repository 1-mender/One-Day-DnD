import { getDegradedState } from "./degraded.js";

const BLOCKED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEGRADED_WRITE_BYPASS = new Set(["POST /api/backup/import"]);

function normalizePathname(pathname) {
  const raw = String(pathname || "/");
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed || "/";
}

function isBypassedWrite(req) {
  const normalizedPath = normalizePathname(req.path);
  return DEGRADED_WRITE_BYPASS.has(`${req.method} ${normalizedPath}`);
}

export function assertWritable(req, res, next) {
  if (!BLOCKED_METHODS.has(req.method) || isBypassedWrite(req)) return next();
  const state = getDegradedState();
  if (!state.degraded) return next();
  res.setHeader("Retry-After", "60");
  return res.status(503).json({ error: "read_only", reason: state.reason || "not_ready" });
}
