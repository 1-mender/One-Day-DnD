import { ru } from "./ru.js";

const dictionaries = { ru };
const DEFAULT_LOCALE = "ru";
const LOCALE_STORAGE_KEY = "dnd_locale";

function normalizeLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (dictionaries[raw]) return raw;
  const short = raw.slice(0, 2);
  if (dictionaries[short]) return short;
  return "";
}

function resolveStoredLocale() {
  try {
    const store = globalThis.localStorage;
    if (!store) return "";
    return normalizeLocale(store.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return "";
  }
}

function resolveNavigatorLocale() {
  try {
    const langs = Array.isArray(globalThis.navigator?.languages) && globalThis.navigator.languages.length
      ? globalThis.navigator.languages
      : [globalThis.navigator?.language];
    for (const lang of langs) {
      const normalized = normalizeLocale(lang);
      if (normalized) return normalized;
    }
  } catch {
    // ignore
  }
  return "";
}

function resolveLocale() {
  return resolveStoredLocale() || resolveNavigatorLocale() || DEFAULT_LOCALE;
}

function getByPath(obj, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function interpolate(message, params) {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in params)) return "";
    return String(params[key] ?? "");
  });
}

export function t(path, params, fallback = "") {
  const locale = resolveLocale();
  const table = dictionaries[locale] || dictionaries[DEFAULT_LOCALE] || {};
  const template = getByPath(table, path);
  if (typeof template !== "string") return fallback || String(path || "");
  return interpolate(template, params);
}
