import { ru } from "./ru.js";

const dictionaries = { ru };
const DEFAULT_LOCALE = "ru";

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
  const locale = DEFAULT_LOCALE;
  const table = dictionaries[locale] || dictionaries[DEFAULT_LOCALE] || {};
  const template = getByPath(table, path);
  if (typeof template !== "string") return fallback || String(path || "");
  return interpolate(template, params);
}
