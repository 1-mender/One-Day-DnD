export function formatError(e) {
  if (!e) return "unknown_error";
  const bodyErr = e?.body?.error;
  return bodyErr || e.message || "request_failed";
}
