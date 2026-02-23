import { ERROR_CODES, ERROR_MESSAGES_RU } from "./errorCodes.js";

const CODE_RE = /^[a-z0-9_]+$/;
const CYRILLIC_RE = /[А-Яа-яЁё]/;

function normalize(raw) {
  if (raw == null) return "";
  return String(raw).trim();
}

function isCodeLike(raw) {
  return CODE_RE.test(String(raw || "").toLowerCase());
}

function resolveKnownMessage(raw) {
  const normalized = normalize(raw);
  if (!normalized) return "";
  const code = normalized.toLowerCase();
  if (ERROR_MESSAGES_RU[code]) return ERROR_MESSAGES_RU[code];

  const lowered = code;
  if (lowered.includes("failed to fetch") || lowered.includes("networkerror")) {
    return ERROR_MESSAGES_RU[ERROR_CODES.OFFLINE];
  }
  if (lowered === "aborterror" || lowered.includes("timeout")) {
    return ERROR_MESSAGES_RU[ERROR_CODES.REQUEST_FAILED];
  }
  if (isCodeLike(code)) return "";
  if (CYRILLIC_RE.test(normalized)) return normalized;
  return "";
}

export function formatError(error, fallback = ERROR_CODES.REQUEST_FAILED) {
  const bodyError = error?.body?.error;
  const directError = error?.error;
  const messageError = error?.message;
  const fallbackValue = normalize(fallback);

  const variants = [
    error,
    bodyError,
    directError,
    messageError
  ];
  if (fallbackValue) variants.push(fallbackValue);

  for (const variant of variants) {
    const message = resolveKnownMessage(variant);
    if (message) return message;
  }

  if (!fallbackValue) return "";
  return ERROR_MESSAGES_RU[ERROR_CODES.REQUEST_FAILED];
}
