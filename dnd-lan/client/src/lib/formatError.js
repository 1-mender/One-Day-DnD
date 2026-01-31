import { ERROR_CODES } from "./errorCodes.js";

export function formatError(e, fallback = ERROR_CODES.REQUEST_FAILED) {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  const bodyErr = e?.body?.error;
  const directErr = e?.error;
  return bodyErr || directErr || e.message || fallback;
}
