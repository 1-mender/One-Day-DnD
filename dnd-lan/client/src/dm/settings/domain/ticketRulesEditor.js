export function buildGeneralChanges(ticketCur, ticketBase) {
  return {
    enabled: (ticketCur?.enabled ?? true) !== (ticketBase?.enabled ?? true),
    dailyEarnCap: (ticketCur?.dailyEarnCap ?? 0) !== (ticketBase?.dailyEarnCap ?? 0),
    streakMax: (ticketCur?.streak?.max ?? 0) !== (ticketBase?.streak?.max ?? 0),
    streakStep: (ticketCur?.streak?.step ?? 0) !== (ticketBase?.streak?.step ?? 0),
    streakFlatBonus: (ticketCur?.streak?.flatBonus ?? 0) !== (ticketBase?.streak?.flatBonus ?? 0)
  };
}

export function isDailyQuestChanged(ticketCur, ticketBase) {
  return JSON.stringify(ticketCur?.dailyQuest || {}) !== JSON.stringify(ticketBase?.dailyQuest || {});
}

export function isGameChanged(ticketBase, key, gameRule) {
  const base = ticketBase?.games?.[key] || {};
  const ui = gameRule?.ui || {};
  const baseUi = base?.ui || {};
  return (
    (gameRule?.enabled ?? true) !== (base.enabled ?? true) ||
    (gameRule?.entryCost ?? 0) !== (base.entryCost ?? 0) ||
    (gameRule?.rewardMin ?? 0) !== (base.rewardMin ?? 0) ||
    (gameRule?.rewardMax ?? 0) !== (base.rewardMax ?? 0) ||
    (gameRule?.lossPenalty ?? 0) !== (base.lossPenalty ?? 0) ||
    (gameRule?.dailyLimit ?? 0) !== (base.dailyLimit ?? 0) ||
    String(ui.difficulty ?? "") !== String(baseUi.difficulty ?? "") ||
    String(ui.risk ?? "") !== String(baseUi.risk ?? "") ||
    String(ui.time ?? "") !== String(baseUi.time ?? "")
  );
}

export function isShopChanged(ticketBase, key, shopRule) {
  const base = ticketBase?.shop?.[key] || {};
  return (
    (shopRule?.enabled ?? true) !== (base.enabled ?? true) ||
    (shopRule?.price ?? 0) !== (base.price ?? 0) ||
    (shopRule?.dailyLimit ?? 0) !== (base.dailyLimit ?? 0)
  );
}

export function applyTicketRulesPatch(prev, patch) {
  const next = { ...(prev || {}) };
  if (patch?.streak && typeof patch.streak === "object") {
    next.streak = { ...(next.streak || {}), ...patch.streak };
    const rest = { ...patch };
    delete rest.streak;
    return { ...next, ...rest };
  }
  if (patch?.dailyQuest && typeof patch.dailyQuest === "object") {
    next.dailyQuest = { ...(next.dailyQuest || {}), ...patch.dailyQuest };
    const rest = { ...patch };
    delete rest.dailyQuest;
    return { ...next, ...rest };
  }
  return { ...next, ...(patch || {}) };
}

export function applyTicketGamePatch(prev, key, patch) {
  const next = { ...(prev || {}) };
  const games = { ...(next.games || {}) };
  const current = { ...(games[key] || {}) };
  if (patch?.ui && typeof patch.ui === "object") {
    current.ui = { ...(current.ui || {}), ...patch.ui };
    const rest = { ...(patch || {}) };
    delete rest.ui;
    games[key] = { ...current, ...rest };
  } else {
    games[key] = { ...current, ...(patch || {}) };
  }
  next.games = games;
  return next;
}

export function applyTicketShopPatch(prev, key, patch) {
  const next = { ...(prev || {}) };
  const shop = { ...(next.shop || {}) };
  shop[key] = { ...(shop[key] || {}), ...(patch || {}) };
  next.shop = shop;
  return next;
}

export function createDailyQuestDraft() {
  const key = `dq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    key,
    enabled: true,
    title: "РќРѕРІС‹Р№ РєРІРµСЃС‚",
    description: "",
    goal: 2,
    reward: 2
  };
}
