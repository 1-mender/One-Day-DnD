import { ERROR_CODES } from "../lib/errorCodes.js";

export async function safeFetch(path, opts) {
  try {
    return await fetch(path, opts);
  } catch (e) {
    const err = new Error(ERROR_CODES.OFFLINE);
    err.status = 0;
    err.body = { error: ERROR_CODES.OFFLINE };
    err.cause = e;
    throw err;
  }
}

export async function parseBody(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json().catch(() => ({}));
  return await res.text().catch(() => "");
}

export function makeError(message, res, body) {
  const err = new Error(message);
  err.status = res?.status ?? 0;
  err.body = body;
  return err;
}

export async function requestBlob(path, fallbackError = ERROR_CODES.REQUEST_FAILED) {
  const res = await safeFetch(path, { credentials: "include" });
  if (!res.ok) {
    const body = await parseBody(res);
    throw makeError(body?.error || fallbackError, res, body);
  }
  return await res.blob();
}
