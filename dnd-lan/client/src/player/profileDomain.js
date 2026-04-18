export const EMPTY_PROFILE_DRAFT = {
  characterName: "",
  classRole: "",
  level: "",
  stats: {},
  bio: "",
  avatarUrl: ""
};

export const PUBLIC_PROFILE_FIELD_OPTIONS = [
  { key: "classRole", label: "Класс / роль" },
  { key: "level", label: "Уровень" },
  { key: "race", label: "Раса" },
  { key: "publicBlurb", label: "Публичное описание" }
];

export const PUBLIC_PROFILE_FIELD_KEYS = PUBLIC_PROFILE_FIELD_OPTIONS.map((option) => option.key);

export const PROFILE_PRESETS = [
  {
    key: "ranger",
    title: "Следопыт",
    subtitle: "Лесной разведчик и охотник",
    statsLabel: "DEX 16 • WIS 14 • CON 12",
    data: {
      characterName: "Лира Туман",
      classRole: "Следопыт",
      level: 3,
      stats: { str: 10, dex: 16, con: 12, int: 12, wis: 14, cha: 10 },
      bio: "Лесная проводница, читает следы и охраняет тропы. Ищет потерянный артефакт рода."
    }
  },
  {
    key: "warrior",
    title: "Воин",
    subtitle: "Ветеран и защитник отряда",
    statsLabel: "STR 16 • CON 14 • CHA 12",
    data: {
      characterName: "Бран Утес",
      classRole: "Воин",
      level: 2,
      stats: { str: 16, dex: 11, con: 14, int: 10, wis: 11, cha: 12 },
      bio: "Служил в гарнизоне, привык держать строй. Хочет вернуть честь семьи."
    }
  },
  {
    key: "mage",
    title: "Маг",
    subtitle: "Учёный и мастер ритуалов",
    statsLabel: "INT 16 • WIS 13 • DEX 12",
    data: {
      characterName: "Эмрис Клинокниг",
      classRole: "Маг",
      level: 3,
      stats: { str: 8, dex: 12, con: 11, int: 16, wis: 13, cha: 10 },
      bio: "Исследователь древних руин. Считает, что каждый артефакт — ключ к новой школе магии."
    }
  },
  {
    key: "rogue",
    title: "Разбойник",
    subtitle: "Незаметный и дерзкий",
    statsLabel: "DEX 16 • CHA 13 • INT 12",
    data: {
      characterName: "Ника Лис",
      classRole: "Разбойник",
      level: 2,
      stats: { str: 9, dex: 16, con: 11, int: 12, wis: 10, cha: 13 },
      bio: "Городская легенда: вскрывает любые замки. Работает ради свободы — и долга."
    }
  },
  {
    key: "cleric",
    title: "Жрец",
    subtitle: "Поддержка и духовный щит",
    statsLabel: "WIS 16 • CON 12 • STR 11",
    data: {
      characterName: "Сора Нимб",
      classRole: "Жрец",
      level: 3,
      stats: { str: 11, dex: 10, con: 12, int: 11, wis: 16, cha: 12 },
      bio: "Несёт свет и исцеление. Ищет знамение, чтобы изменить судьбу общины."
    }
  }
];

export const PRESET_HINT = "Шаблон заполнит имя, класс, уровень, статы и био. Можно потом поправить.";
const PRESET_STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha", "vit"];

export const RACE_OPTIONS = [
  { value: "human", label: "Человек" },
  { value: "elf", label: "Эльф" },
  { value: "half_elf", label: "Полуэльф" },
  { value: "dwarf", label: "Дворф" },
  { value: "halfling", label: "Полурослик" },
  { value: "gnome", label: "Гном" },
  { value: "orc", label: "Орк" },
  { value: "half_orc", label: "Полуорк" },
  { value: "dragonborn", label: "Драконорожденный" },
  { value: "tiefling", label: "Тифлинг" },
  { value: "goliath", label: "Голиаф" }
];

const DEFAULT_RACE = "human";

const RACE_ALIASES = {
  human: "human",
  "человек": "human",
  elf: "elf",
  "эльф": "elf",
  half_elf: "half_elf",
  "полуэльф": "half_elf",
  "полу_эльф": "half_elf",
  dwarf: "dwarf",
  "дварф": "dwarf",
  "дворф": "dwarf",
  halfling: "halfling",
  "полурослик": "halfling",
  "хоббит": "halfling",
  gnome: "gnome",
  "гном": "gnome",
  orc: "orc",
  "орк": "orc",
  half_orc: "half_orc",
  "полуорк": "half_orc",
  "полу_орк": "half_orc",
  dragonborn: "dragonborn",
  "драконорожденный": "dragonborn",
  "драконорождённый": "dragonborn",
  tiefling: "tiefling",
  "тифлинг": "tiefling",
  goliath: "goliath",
  "голиаф": "goliath"
};

const RACE_BONUS = {
  human: 0,
  elf: 0,
  half_elf: 0,
  dwarf: 5,
  halfling: -5,
  gnome: -5,
  orc: 5,
  half_orc: 5,
  dragonborn: 5,
  tiefling: 0,
  goliath: 10
};

export function normalizeRace(raw) {
  const key = String(raw || "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (!key) return DEFAULT_RACE;
  return RACE_ALIASES[key] || key;
}

export function getRaceValue(stats) {
  return normalizeRace(stats?.race);
}

export function getRaceLabel(race) {
  const key = normalizeRace(race);
  return RACE_OPTIONS.find((opt) => opt.value === key)?.label || "Человек";
}

export function getRaceBonus(race) {
  const key = normalizeRace(race);
  return Number(RACE_BONUS[key] ?? RACE_BONUS[DEFAULT_RACE] ?? 0);
}

export function formatRaceBonus(bonus) {
  const value = Number(bonus) || 0;
  return value > 0 ? `+${value}` : String(value);
}

export function setRaceInStats(stats, race) {
  const next = { ...(stats || {}) };
  if (!race) {
    delete next.race;
    return next;
  }
  next.race = normalizeRace(race);
  return next;
}

export function diffProfile(current, next) {
  const out = {};
  if (String(current.characterName || "") !== String(next.characterName || "")) out.characterName = next.characterName || "";
  if (String(current.classRole || "") !== String(next.classRole || "")) out.classRole = next.classRole || "";
  const curLevel = current.level == null ? "" : String(current.level);
  const nextLevel = next.level == null ? "" : String(next.level);
  if (curLevel !== nextLevel) out.level = next.level === "" ? null : Number(next.level);
  if (JSON.stringify(current.stats || {}) !== JSON.stringify(next.stats || {})) out.stats = next.stats || {};
  if (String(current.bio || "") !== String(next.bio || "")) out.bio = next.bio || "";
  if (String(current.avatarUrl || "") !== String(next.avatarUrl || "")) out.avatarUrl = next.avatarUrl || "";
  return out;
}

export function mergePreset(prev, preset) {
  const data = preset?.data || {};
  return {
    ...prev,
    ...data,
    stats: { ...(data.stats || {}), race: data?.stats?.race ?? prev?.stats?.race }
  };
}

export function mergePresets(globalPresets, allowGlobal, hideLocal) {
  const list = [];
  if (allowGlobal && Array.isArray(globalPresets)) {
    list.push(...globalPresets.map((preset) => ({ ...preset, source: "dm" })));
  }
  if (!hideLocal) {
    list.push(...PROFILE_PRESETS.map((preset) => ({ ...preset, source: "local" })));
  }
  return list;
}

export function getPresetStatsLabel(preset) {
  if (preset?.statsLabel) return preset.statsLabel;
  return buildStatsLabel(preset?.data?.stats || preset?.stats || {});
}

function buildStatsLabel(stats) {
  if (!stats || typeof stats !== "object") return "";
  const ordered = [];
  for (const key of PRESET_STAT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(stats, key)) ordered.push([key, stats[key]]);
  }
  for (const key of Object.keys(stats)) {
    if (PRESET_STAT_KEYS.includes(key)) continue;
    ordered.push([key, stats[key]]);
  }
  return ordered
    .slice(0, 3)
    .map(([k, v]) => `${String(k).toUpperCase()} ${v}`)
    .join(" • ");
}

const changeLabels = {
  characterName: "Имя",
  classRole: "Класс/роль",
  level: "Уровень",
  stats: "Статы",
  bio: "Биография",
  avatarUrl: "Аватар"
};

export function formatChangeFields(changes) {
  const keys = Object.keys(changes || {});
  if (!keys.length) return "—";
  return keys.map((k) => changeLabels[k] || k).join(", ");
}
