const STORAGE_KEY = "dnd_nav_usage_v1";
const RETENTION_DAYS = 30;
const DECISION_WINDOW_DAYS = 14;

const ROUTE_KEYS = [
  "/app/players",
  "/app/profile",
  "/app/inventory",
  "/app/arcade",
  "/app/transfers",
  "/app/notes",
  "/app/shop",
  "/app/bestiary"
];

function getStore() {
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function dayKeyAt(timestampMs) {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function normalizeRoute(pathname) {
  const path = String(pathname || "");
  return ROUTE_KEYS.find((route) => path === route || path.startsWith(`${route}/`)) || "";
}

function parseMetrics(raw) {
  if (!raw || typeof raw !== "string") return { days: {} };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { days: {} };
    if (!parsed.days || typeof parsed.days !== "object" || Array.isArray(parsed.days)) return { days: {} };
    return parsed;
  } catch {
    return { days: {} };
  }
}

function serializeMetrics(metrics) {
  try {
    return JSON.stringify(metrics);
  } catch {
    return "";
  }
}

function trimMetrics(metrics, now = Date.now(), retentionDays = RETENTION_DAYS) {
  const out = { days: {} };
  const minTimestamp = now - retentionDays * 24 * 60 * 60 * 1000;
  Object.entries(metrics.days || {}).forEach(([day, dayMap]) => {
    const dayTimestamp = Date.parse(`${day}T00:00:00.000Z`);
    if (!Number.isFinite(dayTimestamp) || dayTimestamp < minTimestamp) return;
    if (!dayMap || typeof dayMap !== "object" || Array.isArray(dayMap)) return;
    const filtered = {};
    Object.entries(dayMap).forEach(([route, count]) => {
      if (!ROUTE_KEYS.includes(route)) return;
      const normalized = Math.max(0, Number(count) || 0);
      if (normalized > 0) filtered[route] = normalized;
    });
    if (Object.keys(filtered).length) out.days[day] = filtered;
  });
  return out;
}

function summarize(metrics, now = Date.now(), windowDays = DECISION_WINDOW_DAYS) {
  const result = {
    total: 0,
    routes: Object.fromEntries(ROUTE_KEYS.map((route) => [route, 0]))
  };
  const minTimestamp = now - windowDays * 24 * 60 * 60 * 1000;
  Object.entries(metrics.days || {}).forEach(([day, dayMap]) => {
    const dayTimestamp = Date.parse(`${day}T00:00:00.000Z`);
    if (!Number.isFinite(dayTimestamp) || dayTimestamp < minTimestamp) return;
    Object.entries(dayMap || {}).forEach(([route, count]) => {
      if (!ROUTE_KEYS.includes(route)) return;
      const n = Math.max(0, Number(count) || 0);
      if (!n) return;
      result.routes[route] += n;
      result.total += n;
    });
  });
  return result;
}

export function decideTransfersPromotion(summary) {
  const total = Math.max(0, Number(summary?.total) || 0);
  const transfersCount = Math.max(0, Number(summary?.routes?.["/app/transfers"]) || 0);
  const arcadeCount = Math.max(0, Number(summary?.routes?.["/app/arcade"]) || 0);
  const share = total > 0 ? transfersCount / total : 0;
  const hasEnoughData = total >= 30;
  const hasEnoughTransferSamples = transfersCount >= 8;
  const promoteTransfers = hasEnoughData && hasEnoughTransferSamples && (share >= 0.18 || transfersCount > arcadeCount);

  return {
    promoteTransfers,
    total,
    transfersCount,
    arcadeCount,
    share
  };
}

export function trackNavUsage(pathname, now = Date.now()) {
  const route = normalizeRoute(pathname);
  const store = getStore();
  const raw = store?.getItem(STORAGE_KEY) || "";
  let metrics = trimMetrics(parseMetrics(raw), now);

  if (route) {
    const day = dayKeyAt(now);
    const dayMap = metrics.days[day] || {};
    dayMap[route] = Math.max(0, Number(dayMap[route]) || 0) + 1;
    metrics.days[day] = dayMap;
  }

  const serialized = serializeMetrics(metrics);
  if (serialized && store) {
    try {
      store.setItem(STORAGE_KEY, serialized);
    } catch {
      // ignore storage write errors
    }
  }

  const summary = summarize(metrics, now, DECISION_WINDOW_DAYS);
  const decision = decideTransfersPromotion(summary);
  return { route, summary, decision };
}

export function getNavUsageSummary(now = Date.now()) {
  const store = getStore();
  const raw = store?.getItem(STORAGE_KEY) || "";
  const metrics = trimMetrics(parseMetrics(raw), now);
  const summary = summarize(metrics, now, DECISION_WINDOW_DAYS);
  const decision = decideTransfersPromotion(summary);
  return { summary, decision };
}

export const navUsageTestUtils = {
  STORAGE_KEY,
  ROUTE_KEYS,
  dayKeyAt,
  normalizeRoute,
  parseMetrics,
  trimMetrics,
  summarize
};
