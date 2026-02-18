function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function mergeRules(base, override) {
  if (!isPlainObject(override)) return { ...base };
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(base?.[k])) out[k] = mergeRules(base[k], v);
    else out[k] = v;
  }
  return out;
}

function clampInt(value, min = 0, max = 999) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampFloat(value, min = 0, max = 10) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function normalizeRules(rules) {
  const out = { ...rules };
  out.enabled = out.enabled !== false;
  out.dailyEarnCap = clampInt(out.dailyEarnCap, 0, 9999);
  out.dailySpendCap = clampInt(out.dailySpendCap, 0, 9999);

  const streak = out.streak || {};
  out.streak = {
    max: clampInt(streak.max, 0, 10),
    step: clampFloat(streak.step, 0, 2),
    flatBonus: clampInt(streak.flatBonus, 0, 10)
  };

  const games = { ...(out.games || {}) };
  for (const [key, g] of Object.entries(games)) {
    const cur = g || {};
    const rewardMin = clampInt(cur.rewardMin, 0, 999);
    const rewardMax = clampInt(cur.rewardMax, rewardMin, 999);
    const uiRaw = cur.ui && typeof cur.ui === "object" ? cur.ui : {};
    const ui = {
      difficulty: typeof uiRaw.difficulty === "string" ? uiRaw.difficulty.slice(0, 40) : "",
      risk: typeof uiRaw.risk === "string" ? uiRaw.risk.slice(0, 40) : "",
      time: typeof uiRaw.time === "string" ? uiRaw.time.slice(0, 40) : ""
    };
    games[key] = {
      ...cur,
      enabled: cur.enabled !== false,
      entryCost: clampInt(cur.entryCost, 0, 999),
      rewardMin,
      rewardMax,
      lossPenalty: clampInt(cur.lossPenalty, 0, 999),
      dailyLimit: clampInt(cur.dailyLimit, 0, 999),
      ui
    };
  }
  out.games = games;

  const shop = { ...(out.shop || {}) };
  for (const [key, s] of Object.entries(shop)) {
    const cur = s || {};
    shop[key] = {
      ...cur,
      enabled: cur.enabled !== false,
      price: clampInt(cur.price, 0, 999),
      dailyLimit: clampInt(cur.dailyLimit, 0, 999)
    };
  }
  out.shop = shop;

  const autoBalance = out.autoBalance || {};
  out.autoBalance = {
    enabled: autoBalance.enabled === true,
    windowDays: clampInt(autoBalance.windowDays, 1, 60),
    targetWinRate: clampFloat(autoBalance.targetWinRate, 0.05, 0.95),
    rewardStep: clampInt(autoBalance.rewardStep, 0, 5),
    penaltyStep: clampInt(autoBalance.penaltyStep, 0, 5),
    minPlays: clampInt(autoBalance.minPlays, 0, 9999)
  };

  const q = out.dailyQuest && typeof out.dailyQuest === "object" ? out.dailyQuest : {};
  const poolRaw = Array.isArray(q.pool) ? q.pool : [];
  const pool = [];
  const seen = new Set();
  for (const item of poolRaw) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.key || "").trim().slice(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pool.push({
      key,
      enabled: item.enabled !== false,
      title: String(item.title || key).slice(0, 80),
      description: String(item.description || "").slice(0, 160),
      goal: clampInt(item.goal, 1, 999),
      reward: clampInt(item.reward, 0, 999)
    });
  }
  if (!pool.length) {
    pool.push({
      key: "daily_mix",
      enabled: true,
      title: "Daily quest",
      description: "Play mini-games",
      goal: 2,
      reward: 2
    });
  }
  const activeKey = String(q.activeKey || pool[0].key);
  out.dailyQuest = {
    enabled: q.enabled !== false,
    activeKey: pool.some((it) => it.key === activeKey) ? activeKey : pool[0].key,
    pool
  };

  return out;
}
