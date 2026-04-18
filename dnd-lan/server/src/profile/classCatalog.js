export const SPECIALIZATION_XP_THRESHOLD = 100;

export const CLASS_CATALOG = [
  {
    key: "warrior",
    label: "Воин",
    specializations: ["berserker", "defender", "mystic_knight"]
  },
  {
    key: "mage",
    label: "Маг",
    specializations: ["pyromancer", "cryomancer", "archmage"]
  },
  {
    key: "cleric",
    label: "Жрец",
    specializations: ["healer", "paladin", "inquisitor"]
  },
  {
    key: "archer",
    label: "Лучник",
    specializations: ["sniper", "ranger", "shadow_archer"]
  },
  {
    key: "rogue",
    label: "Вор",
    specializations: ["assassin", "bandit", "spy"]
  },
  {
    key: "druid",
    label: "Друид",
    specializations: ["grove_keeper", "wild_beast", "storm_lord"]
  },
  {
    key: "necromancer",
    label: "Некромант",
    specializations: ["bone_bearer", "vampire", "lich"]
  },
  {
    key: "sorcerer",
    label: "Чародей",
    specializations: ["wild_mage", "blood_sorcerer", "chaosist"]
  }
];

const CLASS_KEYS = new Set(CLASS_CATALOG.map((item) => item.key));

export function normalizeClassKey(value) {
  const key = String(value || "").trim();
  return CLASS_KEYS.has(key) ? key : "";
}

export function normalizeSpecializationKey(classKey, value) {
  const key = String(value || "").trim();
  const baseClass = CLASS_CATALOG.find((item) => item.key === String(classKey || ""));
  if (!baseClass) return "";
  return baseClass.specializations.includes(key) ? key : "";
}

export function canSelectSpecialization(xp) {
  return Number(xp || 0) >= SPECIALIZATION_XP_THRESHOLD;
}
