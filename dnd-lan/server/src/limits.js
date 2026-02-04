function numEnv(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export const LIMITS = {
  playerName: numEnv("PLAYER_NAME_MAX_LEN", 40),
  joinCode: numEnv("JOIN_CODE_MAX_LEN", 32),
  userAgent: numEnv("USER_AGENT_MAX_LEN", 256)
};
