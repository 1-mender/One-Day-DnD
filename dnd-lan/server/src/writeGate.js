import { getDegradedState } from "./degraded.js";

const BLOCKED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function assertWritable(req, res, next) {
  if (!BLOCKED_METHODS.has(req.method)) return next();
  const state = getDegradedState();
  if (!state.degraded) return next();
  res.setHeader("Retry-After", "60");
  return res.status(503).json({ error: "read_only", reason: state.reason || "not_ready" });
}
