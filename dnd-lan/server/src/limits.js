function numEnv(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function inventoryWeightBase() {
  const raw = process.env.INVENTORY_WEIGHT_LIMIT;
  if (raw == null || raw === "") return 50;
  const num = Number(raw);
  if (Number.isFinite(num) && num > 0) return num;
  if (Number.isFinite(num) && num <= 0) return 0;
  return 50;
}

export const LIMITS = {
  playerName: numEnv("PLAYER_NAME_MAX_LEN", 40),
  joinCode: numEnv("JOIN_CODE_MAX_LEN", 32),
  userAgent: numEnv("USER_AGENT_MAX_LEN", 256),
  inventoryWeight: inventoryWeightBase()
};
