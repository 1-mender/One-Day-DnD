import { LIMITS } from "./limits.js";
import { jsonParse } from "./util.js";
import { getRaceProfile } from "../../shared/raceCatalog.js";
import { getProfileOriginMeta } from "../../shared/profileCatalogs.js";

export function getInventoryLimitFromStats(stats, baseLimit = LIMITS.inventoryWeight) {
  const base = Number(baseLimit || 0);
  const customOrigin = getProfileOriginMeta(stats);
  if (customOrigin?.name) {
    const bonus = Number(customOrigin.carryBonus || 0);
    const limit = base > 0 ? Math.max(0, base + bonus) : 0;
    return {
      base,
      race: customOrigin.key || "custom_origin",
      raceVariant: "",
      bonus,
      limit
    };
  }
  const raceProfile = getRaceProfile(stats);
  const race = raceProfile.raceKey;
  const raceVariant = raceProfile.variantKey;
  const bonus = raceProfile.carryBonus;
  const limit = base > 0 ? Math.max(0, base + bonus) : 0;
  return { base, race, raceVariant, bonus, limit };
}

export function getInventoryLimitForPlayer(db, playerId) {
  const row = db.prepare("SELECT stats FROM character_profiles WHERE player_id=?").get(playerId);
  const stats = jsonParse(row?.stats, {});
  return getInventoryLimitFromStats(stats);
}
