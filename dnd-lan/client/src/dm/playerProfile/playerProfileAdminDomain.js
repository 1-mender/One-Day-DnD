export const DM_PROFILE_EDITABLE_OPTIONS = [
  { key: "characterName", label: "Имя персонажа" },
  { key: "classRole", label: "Класс / роль" },
  { key: "level", label: "Уровень" },
  { key: "stats", label: "Статы" },
  { key: "bio", label: "Биография" },
  { key: "avatarUrl", label: "Аватар" }
];

export const DM_PROFILE_FIELD_LABELS = {
  characterName: "Имя",
  classRole: "Класс/роль",
  level: "Уровень",
  stats: "Статы",
  bio: "Биография",
  avatarUrl: "Аватар"
};

export const EMPTY_DM_PROFILE_FORM = {
  characterName: "",
  classRole: "",
  level: "",
  stats: {},
  bio: "",
  avatarUrl: "",
  editableFields: [],
  allowRequests: false
};

export const DM_STAT_PRESETS = [
  { key: "commoner", label: "10-10-10-10-10-10", stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  { key: "standard", label: "15-14-13-12-10-8", stats: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } },
  { key: "hero", label: "16-14-13-12-10-8", stats: { str: 16, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }
];

export function normalizeRequestChanges(changes) {
  const out = {};
  if (!changes || typeof changes !== "object") return out;
  if ("characterName" in changes) out.characterName = String(changes.characterName || "");
  if ("classRole" in changes) out.classRole = String(changes.classRole || "");
  if ("level" in changes) {
    const level = changes.level === "" || changes.level == null ? "" : Number(changes.level);
    out.level = Number.isFinite(level) ? level : "";
  }
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
  const hasText = snapshot.characterName || snapshot.classRole || snapshot.bio || snapshot.avatarUrl;
  const hasLevel = snapshot.level !== null && snapshot.level !== undefined;
  const hasStats = Object.keys(snapshot.stats || {}).length > 0;
  const hasRights = snapshot.editableFields.length > 0 || snapshot.allowRequests;
  return !!(hasText || hasLevel || hasStats || hasRights);
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
    stats: sortObjectKeys(form.stats || {}),
    bio: String(form.bio || ""),
    avatarUrl: String(form.avatarUrl || ""),
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
    stats: sortObjectKeys(profile.stats || {}),
    bio: String(profile.bio || ""),
    avatarUrl: String(profile.avatarUrl || ""),
    editableFields: [...(profile.editableFields || [])].sort(),
    allowRequests: !!profile.allowRequests
  };
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
