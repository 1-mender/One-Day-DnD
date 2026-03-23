import { ERROR_CODES } from "../lib/errorCodes.js";
import { makeError, parseBody, requestBlob, safeFetch } from "./http.js";
import { storage } from "./storage.js";

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_HTTP_WRITE_TIMEOUT_MS = 20_000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 60_000;

export async function request(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const token = storage.getPlayerToken();
  if (token) headers["x-player-token"] = token;
  const method = String(opts.method || "GET").toUpperCase();
  const defaultTimeout = method === "GET" || method === "HEAD"
    ? DEFAULT_HTTP_TIMEOUT_MS
    : DEFAULT_HTTP_WRITE_TIMEOUT_MS;
  const timeoutMs = Number.isFinite(Number(opts.timeoutMs)) && Number(opts.timeoutMs) > 0
    ? Number(opts.timeoutMs)
    : defaultTimeout;

  const res = await safeFetch(path, {
    ...opts,
    headers,
    credentials: "include",
    timeoutMs
  });
  const body = await parseBody(res);
  if (!res.ok) throw makeError(body?.error || ERROR_CODES.REQUEST_FAILED, res, body);
  return body;
}

export async function uploadForm(path, formData, fallbackError) {
  const headers = {};
  const token = storage.getPlayerToken();
  if (token) headers["x-player-token"] = token;
  const res = await safeFetch(path, {
    method: "POST",
    body: formData,
    headers,
    credentials: "include",
    timeoutMs: DEFAULT_UPLOAD_TIMEOUT_MS
  });
  const body = await parseBody(res);
  if (!res.ok) throw makeError(body?.error || fallbackError, res, body);
  return body;
}

export async function upload(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  return uploadForm(path, fd, ERROR_CODES.UPLOAD_FAILED);
}

export { ERROR_CODES, requestBlob };
