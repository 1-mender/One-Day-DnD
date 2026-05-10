import { now } from "../../util.js";
import { DAY_MS } from "./ticketConstants.js";

export function getDayKey(t = now()) {
  return Math.floor(Number(t) / DAY_MS);
}

export function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function clampLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function calcPercentile(list, p) {
  if (!Array.isArray(list) || !list.length) return null;
  const sorted = list.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function summarizeStats(values) {
  const list = (values || []).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v >= 0);
  if (!list.length) return { count: 0, avg: null, p50: null, p95: null };
  const sum = list.reduce((acc, v) => acc + v, 0);
  return {
    count: list.length,
    avg: Math.round(sum / list.length),
    p50: calcPercentile(list, 50),
    p95: calcPercentile(list, 95)
  };
}
