import { ERROR_CODES } from "../lib/errorCodes.js";

function envNumber(name, fallback) {
  const raw = import.meta?.env?.[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_HTTP_TIMEOUT_MS = envNumber("VITE_HTTP_TIMEOUT_MS", 15_000);

export async function safeFetch(path, opts) {
  const { timeoutMs, signal, ...fetchOpts } = opts || {};
  const timeout = Number(timeoutMs);
  const ms = Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_HTTP_TIMEOUT_MS;
  const canAbort = typeof AbortController !== "undefined";
  const controller = canAbort ? new AbortController() : null;
  let timedOut = false;
  let timerId = null;
  let removeSignalListener = null;

  if (controller) {
    if (signal?.aborted) {
      controller.abort();
    } else if (signal && typeof signal.addEventListener === "function") {
      const onAbort = () => controller.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      removeSignalListener = () => {
        signal.removeEventListener("abort", onAbort);
      };
    }
    if (ms > 0) {
      timerId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ms);
    }
  }

  try {
    return await fetch(path, {
      ...fetchOpts,
      signal: controller?.signal || signal
    });
  } catch (e) {
    if (timedOut) {
      const err = new Error(ERROR_CODES.REQUEST_TIMEOUT);
      err.status = 0;
      err.body = { error: ERROR_CODES.REQUEST_TIMEOUT };
      err.cause = e;
      throw err;
    }
    const err = new Error(ERROR_CODES.OFFLINE);
    err.status = 0;
    err.body = { error: ERROR_CODES.OFFLINE };
    err.cause = e;
    throw err;
  } finally {
    if (timerId) clearTimeout(timerId);
    removeSignalListener?.();
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
  const res = await safeFetch(path, {
    credentials: "include",
    timeoutMs: DEFAULT_HTTP_TIMEOUT_MS
  });
  if (!res.ok) {
    const body = await parseBody(res);
    throw makeError(body?.error || fallbackError, res, body);
  }
  return await res.blob();
}
