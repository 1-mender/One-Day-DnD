import { LIMITS } from "./limits.js";
import { jsonParse } from "./util.js";

const DEFAULT_RACE = "human";

const RACE_ALIASES = {
  "human": "human",
  "человек": "human",
  "elf": "elf",
  "эльф": "elf",
  "half_elf": "half_elf",
  "полуэльф": "half_elf",
  "полу_эльф": "half_elf",
  "dwarf": "dwarf",
  "дварф": "dwarf",
  "дворф": "dwarf",
  "halfling": "halfling",
  "полурослик": "halfling",
  "хоббит": "halfling",
  "gnome": "gnome",
  "гном": "gnome",
  "orc": "orc",
  "орк": "orc",
  "half_orc": "half_orc",
  "полуорк": "half_orc",
  "полу_орк": "half_orc",
  "dragonborn": "dragonborn",
  "драконорожденный": "dragonborn",
  "драконорождённый": "dragonborn",
  "tiefling": "tiefling",
  "тифлинг": "tiefling",
  "goliath": "goliath",
  "голиаф": "goliath"
};

const RACE_BONUS = {
  "human": 0,
  "elf": 0,
  "half_elf": 0,
  "dwarf": 5,
  "halfling": -5,
  "gnome": -5,
  "orc": 5,
  "half_orc": 5,
  "dragonborn": 5,
  "tiefling": 0,
  "goliath": 10
};

function normalizeRace(raw) {
  const key = String(raw || "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (!key) return DEFAULT_RACE;
  return RACE_ALIASES[key] || key;
}

function getRaceBonus(raceKey) {
  const key = normalizeRace(raceKey);
  return Number(RACE_BONUS[key] ?? RACE_BONUS[DEFAULT_RACE] ?? 0);
}

export function getInventoryLimitFromStats(stats, baseLimit = LIMITS.inventoryWeight) {
  const base = Number(baseLimit || 0);
  const race = normalizeRace(stats?.race);
  const bonus = getRaceBonus(race);
  const limit = base > 0 ? Math.max(0, base + bonus) : 0;
  return { base, race, bonus, limit };
}

export function getInventoryLimitForPlayer(db, playerId) {
  const row = db.prepare("SELECT stats FROM character_profiles WHERE player_id=?").get(playerId);
  const stats = jsonParse(row?.stats, {});
  return getInventoryLimitFromStats(stats);
}
