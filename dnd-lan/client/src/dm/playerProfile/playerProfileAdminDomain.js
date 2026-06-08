import {
  getRaceValue,
  getRaceVariantValue,
  setRaceInStats,
  setRaceVariantInStats
} from "../../../../shared/raceCatalog.js";

export const DM_PROFILE_EDITABLE_OPTIONS = [
  { key: "characterName", label: "Имя персонажа" },
  { key: "classRole", label: "Роль / архетип" },
  { key: "level", label: "Уровень" },
  { key: "reputation", label: "Репутация" },
  { key: "stats", label: "Статы" },
  { key: "bio", label: "Биография" },
  { key: "avatarUrl", label: "Аватар" }
];

export const DM_PROFILE_PUBLIC_OPTIONS = [
  { key: "classPath", label: "Класс и ветка" },
  { key: "classRole", label: "Роль / архетип" },
  { key: "level", label: "Уровень" },
  { key: "reputation", label: "Репутация" },
  { key: "race", label: "Происхождение / вид" },
  { key: "publicBlurb", label: "Публичное описание" }
];

export const DM_PROFILE_ACCESS_PRESETS = [
  {
    key: "dm_only",
    label: "Только DM",
    summary: "Игрок не редактирует лист и не отправляет запросы.",
    publicFields: ["classRole", "level"],
    editableFields: [],
    allowRequests: false
  },
  {
    key: "journal",
    label: "Личный журнал",
    summary: "Игрок правит историю и аватар, остальное остаётся у мастера.",
    publicFields: ["classRole", "level", "publicBlurb"],
    editableFields: ["bio", "avatarUrl"],
    allowRequests: true
  },
  {
    key: "shared",
    label: "Совместный лист",
    summary: "Игрок поддерживает анкету, мастер контролирует путь и прогрессию.",
    publicFields: ["classRole", "level", "reputation", "publicBlurb"],
    editableFields: ["characterName", "classRole", "level", "reputation", "stats", "bio", "avatarUrl"],
    allowRequests: true
  },
  {
    key: "party_open",
    label: "Открыт группе",
    summary: "Карточка видна группе шире, но редактирование остаётся выборочным.",
    publicFields: ["classPath", "classRole", "level", "reputation", "race", "publicBlurb"],
    editableFields: ["characterName", "classRole", "bio", "avatarUrl"],
    allowRequests: true
  }
];

export const DM_PROFILE_FIELD_LABELS = {
  characterName: "Имя",
  classRole: "Роль/архетип",
  classPath: "Класс и ветка",
  level: "Уровень",
  reputation: "Репутация",
  classKey: "Класс",
  specializationKey: "Специализация",
  xp: "Опыт",
  stats: "Статы",
  bio: "Биография",
  avatarUrl: "Аватар"
};

export const EMPTY_DM_PROFILE_FORM = {
  characterName: "",
  classRole: "",
  level: "",
  reputation: 0,
  classKey: "",
  specializationKey: "",
  xp: 0,
  xpLog: [],
  stats: {},
  bio: "",
  avatarUrl: "",
  publicFields: [],
  publicBlurb: "",
  editableFields: [],
  allowRequests: false
};

export const DM_STAT_PRESETS = [
  { key: "commoner", label: "10-10-10-10-10-10", stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  { key: "standard", label: "15-14-13-12-10-8", stats: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } },
  { key: "hero", label: "16-14-13-12-10-8", stats: { str: 16, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }
];

const FANTASY_STAT_KEYS = ["str", "dex", "con", "int", "wis", "cha", "vit"];
const MODERN_STAT_KEYS = ["body", "agility", "mind", "tech", "empathy", "grit"];
const SCIFI_STAT_KEYS = ["might", "reflex", "logic", "systems", "presence", "resolve"];
const CORE_TEMPLATE_KEYS = [...new Set([...FANTASY_STAT_KEYS, ...MODERN_STAT_KEYS, ...SCIFI_STAT_KEYS])];

export const DM_PROFILE_STAT_LABELS = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
  vit: "VIT",
  body: "Тело",
  agility: "Ловкость",
  mind: "Разум",
  tech: "Техника",
  empathy: "Эмпатия",
  grit: "Стойкость",
  might: "Сила",
  reflex: "Рефлекс",
  logic: "Логика",
  systems: "Системы",
  presence: "Присутствие",
  resolve: "Воля"
};

export const DM_PROFILE_TEMPLATES = [
  {
    key: "fantasy",
    label: "Фэнтези",
    summary: "Класс, происхождение и классические атрибуты.",
    statKeys: FANTASY_STAT_KEYS,
    supportsClassPath: true,
    supportsOrigin: true,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, vit: 10 }
  },
  {
    key: "modern",
    label: "Современность",
    summary: "Убирает fantasy-слой и оставляет универсальные характеристики.",
    statKeys: MODERN_STAT_KEYS,
    supportsClassPath: false,
    supportsOrigin: false,
    stats: { body: 10, agility: 10, mind: 10, tech: 10, empathy: 10, grit: 10 }
  },
  {
    key: "scifi",
    label: "Sci-fi",
    summary: "Фокус на технике, системах и командных ролях.",
    statKeys: SCIFI_STAT_KEYS,
    supportsClassPath: false,
    supportsOrigin: false,
    stats: { might: 10, reflex: 10, logic: 10, systems: 10, presence: 10, resolve: 10 }
  },
  {
    key: "custom",
    label: "Свободный",
    summary: "Пустая база под любой собственный сеттинг.",
    statKeys: [],
    supportsClassPath: false,
    supportsOrigin: false,
    stats: {}
  }
];

export function getDmProfileTemplate(key) {
  return DM_PROFILE_TEMPLATES.find((template) => template.key === key) || DM_PROFILE_TEMPLATES[0];
}

export function detectDmProfileTemplate(source) {
  const stats = toStatsObject(source?.stats ?? source);
  const keys = Object.keys(stats);
  const hasFantasy = keys.some((key) => FANTASY_STAT_KEYS.includes(key)) || Boolean(source?.classKey) || Boolean(stats.race || stats.raceVariant);
  const hasModern = keys.some((key) => MODERN_STAT_KEYS.includes(key));
  const hasScifi = keys.some((key) => SCIFI_STAT_KEYS.includes(key));
  if (!keys.length && !source?.classKey) return "custom";
  if (hasFantasy) return "fantasy";
  if (hasScifi) return "scifi";
  if (hasModern) return "modern";
  return "custom";
}

export function applyDmProfileTemplate(source, templateKey) {
  const template = getDmProfileTemplate(templateKey);
  const base = source && typeof source === "object" ? source : {};
  const nextStats = buildTemplateStats(base.stats, template);
  const nextPublicFields = Array.isArray(base.publicFields) ? [...base.publicFields] : [];
  const filteredPublicFields = template.supportsClassPath
    ? nextPublicFields
    : nextPublicFields.filter((field) => field !== "classPath" && field !== "race");
  const next = {
    ...base,
    classKey: template.supportsClassPath ? String(base.classKey || "") : "",
    specializationKey: template.supportsClassPath ? String(base.specializationKey || "") : "",
    stats: nextStats
  };
  if (Object.prototype.hasOwnProperty.call(base, "publicFields")) {
    next.publicFields = filteredPublicFields;
  }
  return next;
}

function buildTemplateStats(stats, template) {
  const current = toStatsObject(stats);
  const preserved = Object.entries(current).reduce((acc, [key, value]) => {
    if (CORE_TEMPLATE_KEYS.includes(key)) return acc;
    if (!template.supportsOrigin && (key === "race" || key === "raceVariant")) return acc;
    acc[key] = value;
    return acc;
  }, {});
  const next = {
    ...preserved,
    ...template.stats
  };

  if (template.supportsOrigin) {
    const normalized = normalizeDmProfileStats({
      ...next,
      race: current.race || "human",
      raceVariant: current.raceVariant || "city"
    }, current);
    return normalized;
  }

  return next;
}

export function normalizeDmProfileStats(stats, baseStats = null) {
  const next = toStatsObject(stats);
  const base = toStatsObject(baseStats);
  const hasIncomingRace = Object.prototype.hasOwnProperty.call(next, "race");
  const hasIncomingVariant = Object.prototype.hasOwnProperty.call(next, "raceVariant");
  const hasBaseRace = Object.prototype.hasOwnProperty.call(base, "race") || Object.prototype.hasOwnProperty.call(base, "raceVariant");
  if (!hasIncomingRace && !hasIncomingVariant && !hasBaseRace) return next;

  let normalized = setRaceInStats(next, hasIncomingRace ? next.race : getRaceValue(base));
  if (hasIncomingVariant) {
    normalized = setRaceVariantInStats(normalized, next.raceVariant);
  } else if (!hasIncomingRace && hasBaseRace) {
    normalized = setRaceVariantInStats(normalized, getRaceVariantValue(base));
  }
  return normalized;
}

export function mergeDmProfileStats(stats, baseStats = null) {
  const base = toStatsObject(baseStats);
  return normalizeDmProfileStats({ ...base, ...toStatsObject(stats) }, base);
}

export function normalizeRequestChanges(changes) {
  const out = {};
  if (!changes || typeof changes !== "object") return out;
  if ("characterName" in changes) out.characterName = String(changes.characterName || "");
  if ("classRole" in changes) out.classRole = String(changes.classRole || "");
  if ("classKey" in changes) out.classKey = String(changes.classKey || "");
  if ("specializationKey" in changes) out.specializationKey = String(changes.specializationKey || "");
  if ("level" in changes) {
    const level = changes.level === "" || changes.level == null ? "" : Number(changes.level);
    out.level = Number.isFinite(level) ? level : "";
  }
  if ("reputation" in changes) out.reputation = normalizeReputation(changes.reputation);
  if ("stats" in changes) {
    const raw = changes.stats;
    if (raw && typeof raw === "object") out.stats = raw;
    else {
      try {
        const parsed = JSON.parse(String(raw || "{}"));
        out.stats = parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        out.stats = {};
      }
    }
  }
  if ("bio" in changes) out.bio = String(changes.bio || "");
  if ("avatarUrl" in changes) out.avatarUrl = String(changes.avatarUrl || "");
  return out;
}

export function formatProfileRequestValue(value) {
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function hasAnyData(form) {
  const snapshot = snapshotFromForm(form);
  const hasText = snapshot.characterName || snapshot.classRole || snapshot.classKey || snapshot.bio || snapshot.avatarUrl;
  const hasLevel = snapshot.level !== null && snapshot.level !== undefined;
  const hasReputation = snapshot.reputation !== 0;
  const hasProgress = snapshot.xp !== 0 || snapshot.specializationKey;
  const hasStats = Object.keys(snapshot.stats || {}).length > 0;
  const hasRights = snapshot.editableFields.length > 0 || snapshot.allowRequests;
  return !!(hasText || hasLevel || hasReputation || hasProgress || hasStats || hasRights);
}

export function hasUnsavedChanges(form, profile) {
  if (!profile) return hasAnyData(form);
  return JSON.stringify(snapshotFromForm(form)) !== JSON.stringify(snapshotFromProfile(profile));
}

function snapshotFromForm(form) {
  return {
    characterName: String(form.characterName || ""),
    classRole: String(form.classRole || ""),
    level: form.level === "" || form.level == null ? null : Number(form.level),
    reputation: normalizeReputation(form.reputation),
    classKey: String(form.classKey || ""),
    specializationKey: String(form.specializationKey || ""),
    xp: normalizeXp(form.xp),
    stats: sortObjectKeys(normalizeDmProfileStats(form.stats || {})),
    bio: String(form.bio || ""),
    avatarUrl: String(form.avatarUrl || ""),
    publicFields: [...(form.publicFields || [])].sort(),
    publicBlurb: String(form.publicBlurb || ""),
    editableFields: [...(form.editableFields || [])].sort(),
    allowRequests: !!form.allowRequests
  };
}

function snapshotFromProfile(profile) {
  if (!profile) return snapshotFromForm(EMPTY_DM_PROFILE_FORM);
  return {
    characterName: String(profile.characterName || ""),
    classRole: String(profile.classRole || ""),
    level: profile.level == null ? null : Number(profile.level),
    reputation: normalizeReputation(profile.reputation),
    classKey: String(profile.classKey || ""),
    specializationKey: String(profile.specializationKey || ""),
    xp: normalizeXp(profile.xp),
    stats: sortObjectKeys(normalizeDmProfileStats(profile.stats || {})),
    bio: String(profile.bio || ""),
    avatarUrl: String(profile.avatarUrl || ""),
    publicFields: [...(profile.publicFields || [])].sort(),
    publicBlurb: String(profile.publicBlurb || ""),
    editableFields: [...(profile.editableFields || [])].sort(),
    allowRequests: !!profile.allowRequests
  };
}

export function normalizeReputation(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-100, Math.min(100, Math.round(numeric)));
}

export function normalizeXp(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

export function formatReputation(value) {
  const reputation = normalizeReputation(value);
  return reputation > 0 ? `+${reputation}` : String(reputation);
}

export function getReputationTier(value) {
  const reputation = normalizeReputation(value);
  if (reputation <= -75) return { key: "outcast", label: "Изгой", tone: "off" };
  if (reputation <= -25) return { key: "bad", label: "Плохая", tone: "off" };
  if (reputation < 25) return { key: "neutral", label: "Нейтральная", tone: "secondary" };
  if (reputation < 75) return { key: "good", label: "Хорошая", tone: "ok" };
  return { key: "legendary", label: "Легендарная", tone: "ok" };
}

export function formatReputationLabel(value) {
  const tier = getReputationTier(value);
  return `${formatReputation(value)} · ${tier.label}`;
}

function sortObjectKeys(obj) {
  if (!obj || typeof obj !== "object") return {};
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

function toStatsObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...value };
}
