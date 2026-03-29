export function resolveArcadeModeRules(gameRules, modeKey) {
  const base = gameRules && typeof gameRules === "object" ? gameRules : {};
  const safeModeKey = String(modeKey || "").trim();
  if (!safeModeKey) return { ...base };
  const override = base.modeOverrides?.[safeModeKey];
  if (!override || typeof override !== "object") return { ...base };
  return {
    ...base,
    ...override,
    ui: {
      ...(base.ui || {}),
      ...(override.ui || {})
    }
  };
}

export function formatArcadeModeMeta(game, mode, rulesForMode) {
  const parts = [];
  if (mode?.summary) parts.push(String(mode.summary).trim());
  const entryCost = Number(rulesForMode?.entryCost || 0);
  const rewardMin = Number(rulesForMode?.rewardMin || 0);
  const rewardMax = Number(rulesForMode?.rewardMax || 0);
  const dailyLimit = Number(rulesForMode?.dailyLimit || 0);
  const meta = [];
  meta.push(entryCost > 0 ? `вход ${entryCost}` : "вход бесплатно");
  if (rewardMax > 0) meta.push(`награда ${rewardMin}-${rewardMax}`);
  if (dailyLimit > 0) meta.push(`лимит ${dailyLimit}/день`);
  if (meta.length) parts.push(meta.join(" • "));
  return parts.filter(Boolean).join(" ");
}
