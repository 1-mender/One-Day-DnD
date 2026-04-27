import { jsonParse, randId } from "../util.js";
import {
  canSelectSpecialization,
  normalizeClassKey,
  normalizeSpecializationKey
} from "./classCatalog.js";
import {
  getRaceProfile,
  getRaceValue,
  getRaceVariantValue,
  setRaceInStats,
  setRaceVariantInStats
} from "../../../shared/raceCatalog.js";

export const EDITABLE_FIELDS = new Set([
  "characterName",
  "classRole",
  "level",
  "reputation",
  "stats",
  "bio",
  "avatarUrl"
]);

export const PUBLIC_PROFILE_FIELDS = new Set([
  "classRole",
  "classPath",
  "level",
  "reputation",
  "race",
  "publicBlurb"
]);

export const LIMITS = {
  name: 80,
  classRole: 80,
  avatarUrl: 512,
  bio: 2000,
  publicBlurb: 280,
  xpReason: 160,
  reason: 500,
  dmNote: 500,
  reputationMin: -100,
  reputationMax: 100,
  statKey: 24,
  statValue: 64,
  maxStats: 20
};

export const PRESET_LIMITS = {
  title: 80,
  subtitle: 160,
  maxPresets: 30
};

export const DEFAULT_PRESET_ACCESS = {
  enabled: true,
  playerEdit: true,
  playerRequest: true,
  hideLocal: false
};

export function mapProfile(row) {
  const stats = normalizeProfileStats(jsonParse(row.stats, {}));
  const editableFields = jsonParse(row.editable_fields, []);
  const publicFields = normalizePublicFields(jsonParse(row.public_fields, []));
  return {
    playerId: row.player_id,
    characterName: row.character_name || "",
    classRole: row.class_role || "",
    level: row.level == null ? null : Number(row.level),
    reputation: normalizeReputation(row.reputation),
    classKey: normalizeClassKey(row.class_key),
    specializationKey: normalizeSpecializationKey(row.class_key, row.specialization_key),
    xp: normalizeXp(row.xp),
    stats: (stats && typeof stats === "object" && !Array.isArray(stats)) ? stats : {},
    bio: row.bio || "",
    avatarUrl: row.avatar_url || "",
    publicFields,
    publicBlurb: row.public_blurb || "",
    editableFields: Array.isArray(editableFields) ? editableFields : [],
    allowRequests: !!row.allow_requests,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapPublicProfile(row) {
  if (!row) return null;
  const rawStats = row.stats ?? row.profile_stats ?? {};
  const stats = typeof rawStats === "string" ? jsonParse(rawStats, {}) : rawStats;
  const rawPublicFields = row.public_fields ?? row.publicFields ?? [];
  const publicFields = normalizePublicFields(
    Array.isArray(rawPublicFields) ? rawPublicFields : jsonParse(rawPublicFields, [])
  );
  const characterName = String(row.character_name ?? row.characterName ?? "").trim();
  const avatarUrl = String(row.avatar_url ?? row.avatarUrl ?? "").trim();
  const classRole = String(row.class_role ?? row.classRole ?? "").trim();
  const classKey = normalizeClassKey(row.class_key ?? row.classKey);
  const specializationKey = normalizeSpecializationKey(classKey, row.specialization_key ?? row.specializationKey);
  const rawLevel = row.level;
  const reputation = normalizeReputation(row.reputation);
  const publicBlurb = String(row.public_blurb ?? row.publicBlurb ?? "").trim();
  const hasRace = Boolean(String(stats?.race || stats?.raceVariant || "").trim());
  const raceProfile = getRaceProfile(stats);

  const profile = {};
  if (characterName) profile.characterName = characterName;
  if (avatarUrl) profile.avatarUrl = avatarUrl;
  if (publicFields.includes("classRole") && classRole) profile.classRole = classRole;
  if (publicFields.includes("classPath") && classKey) {
    profile.classKey = classKey;
    if (specializationKey) profile.specializationKey = specializationKey;
  }
  if (publicFields.includes("level") && rawLevel != null && rawLevel !== "") {
    const level = Number(rawLevel);
    if (Number.isFinite(level)) profile.level = level;
  }
  if (publicFields.includes("reputation")) profile.reputation = reputation;
  if (publicFields.includes("race") && hasRace) {
    profile.race = raceProfile.displayName;
    profile.raceKey = raceProfile.raceKey;
    profile.raceVariantKey = raceProfile.variantKey;
    profile.raceTrait = raceProfile.trait;
  }
  if (publicFields.includes("publicBlurb") && publicBlurb) profile.publicBlurb = publicBlurb;
  return profile;
}

function normalizeStats(value) {
  if (value == null) return {};
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return null;
}

function normalizeProfileStats(stats, existingStats = {}) {
  const next = normalizeStats(stats);
  const base = normalizeStats(existingStats);
  if (next === null) return null;
  const safeNext = { ...(next || {}) };
  const safeBase = { ...(base || {}) };
  const hasIncomingRace = Object.prototype.hasOwnProperty.call(safeNext, "race");
  const hasIncomingVariant = Object.prototype.hasOwnProperty.call(safeNext, "raceVariant");
  const hasBaseRace = Object.prototype.hasOwnProperty.call(safeBase, "race") || Object.prototype.hasOwnProperty.call(safeBase, "raceVariant");
  if (!hasIncomingRace && !hasIncomingVariant && !hasBaseRace) return safeNext;

  let normalized = setRaceInStats(safeNext, hasIncomingRace ? safeNext.race : getRaceValue(safeBase));
  if (hasIncomingVariant) {
    normalized = setRaceVariantInStats(normalized, safeNext.raceVariant);
  } else if (!hasIncomingRace && hasBaseRace) {
    normalized = setRaceVariantInStats(normalized, getRaceVariantValue(safeBase));
  }
  return normalized;
}

function normalizeReputation(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(LIMITS.reputationMin, Math.min(LIMITS.reputationMax, Math.round(numeric)));
}

function normalizeXp(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

export function normalizeEditableFields(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter((v) => EDITABLE_FIELDS.has(v));
}

export function normalizePublicFields(value) {
  if (!Array.isArray(value)) return [];
  const next = [];
  for (const field of value) {
    const key = String(field || "").trim();
    if (!PUBLIC_PROFILE_FIELDS.has(key) || next.includes(key)) continue;
    next.push(key);
  }
  return next;
}

export function validateTextLen(value, max, errorCode) {
  if (value == null) return null;
  if (String(value).length > max) return errorCode;
  return null;
}

function validateStats(stats) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return "stats_invalid";
  const keys = Object.keys(stats);
  if (keys.length > LIMITS.maxStats) return "stats_too_many";
  for (const key of keys) {
    if (String(key).length > LIMITS.statKey) return "stats_key_too_long";
    const value = stats[key];
    if (value == null) continue;
    if (typeof value === "number") continue;
    if (typeof value === "string") {
      if (value.length > LIMITS.statValue) return "stats_value_too_long";
      continue;
    }
    return "stats_invalid";
  }
  return null;
}

export function normalizePresetAccess(value) {
  const current = value && typeof value === "object" ? value : {};
  return {
    enabled: typeof current.enabled === "boolean" ? current.enabled : DEFAULT_PRESET_ACCESS.enabled,
    playerEdit: typeof current.playerEdit === "boolean" ? current.playerEdit : DEFAULT_PRESET_ACCESS.playerEdit,
    playerRequest: typeof current.playerRequest === "boolean" ? current.playerRequest : DEFAULT_PRESET_ACCESS.playerRequest,
    hideLocal: typeof current.hideLocal === "boolean" ? current.hideLocal : DEFAULT_PRESET_ACCESS.hideLocal
  };
}

function normalizePresetData(raw) {
  const changes = sanitizeRequestChanges(raw || {});
  const error = validateRequestChanges(changes);
  if (error) return { error };
  const classKey = normalizeClassKey(changes.classKey);
  const data = {
    characterName: String(changes.characterName || ""),
    classRole: String(changes.classRole || ""),
    level: changes.level === "" || changes.level == null ? "" : Number(changes.level),
    reputation: normalizeReputation(changes.reputation),
    stats: normalizeProfileStats(changes.stats || {}),
    bio: String(changes.bio || ""),
    avatarUrl: String(changes.avatarUrl || "")
  };
  if (Object.prototype.hasOwnProperty.call(raw || {}, "classKey")) data.classKey = classKey;
  if (Object.prototype.hasOwnProperty.call(raw || {}, "specializationKey")) {
    data.specializationKey = normalizeSpecializationKey(classKey, changes.specializationKey);
  }
  return data;
}

export function sanitizePreset(preset, index) {
  if (!preset || typeof preset !== "object") return null;
  const title = String(preset.title || "").trim();
  if (!title) return null;
  if (title.length > PRESET_LIMITS.title) return { error: "preset_title_too_long" };
  const subtitle = String(preset.subtitle || "").trim();
  if (subtitle.length > PRESET_LIMITS.subtitle) return { error: "preset_subtitle_too_long" };
  const data = normalizePresetData(preset.data || preset);
  if (data?.error) return { error: data.error };
  const idRaw = String(preset.id || preset.key || "").trim();
  const id = idRaw ? idRaw.slice(0, 40) : `preset_${index}_${randId(4)}`;
  return { id, title, subtitle, data };
}

export function buildProfilePayload(body, existing) {
  const input = body || {};
  const characterName = input.characterName ?? existing?.character_name ?? "";
  const classRole = input.classRole ?? existing?.class_role ?? "";
  const levelRaw = input.level ?? existing?.level ?? null;
  const level = levelRaw === null || levelRaw === "" || Number.isNaN(Number(levelRaw))
    ? null
    : Math.max(0, Number(levelRaw));
  const reputation = input.reputation !== undefined
    ? normalizeReputation(input.reputation)
    : normalizeReputation(existing?.reputation);
  const xp = input.xp !== undefined ? normalizeXp(input.xp) : normalizeXp(existing?.xp);
  const classKey = normalizeClassKey(input.classKey ?? existing?.class_key ?? "");
  const specializationKey = normalizeSpecializationKey(
    classKey,
    input.specializationKey ?? existing?.specialization_key ?? ""
  );
  let statsObj;
  if (input.stats !== undefined) {
    const normalized = normalizeProfileStats(input.stats, jsonParse(existing?.stats, {}));
    if (normalized === null) return { error: "stats_invalid" };
    statsObj = normalized;
  } else {
    const existingStats = normalizeProfileStats(jsonParse(existing?.stats, {}));
    statsObj = existingStats ?? {};
  }
  const bio = input.bio ?? existing?.bio ?? "";
  const avatarUrl = input.avatarUrl ?? existing?.avatar_url ?? "";
  const publicFields = input.publicFields !== undefined
    ? normalizePublicFields(input.publicFields)
    : normalizePublicFields(jsonParse(existing?.public_fields, []));
  const publicBlurb = input.publicBlurb !== undefined
    ? String(input.publicBlurb || "").trim()
    : String(existing?.public_blurb || "");
  const editableFields = input.editableFields !== undefined
    ? normalizeEditableFields(input.editableFields)
    : normalizeEditableFields(jsonParse(existing?.editable_fields, []));
  const allowRequests = input.allowRequests !== undefined ? !!input.allowRequests : !!existing?.allow_requests;

  const error = validateTextLen(characterName, LIMITS.name, "character_name_too_long")
    || validateTextLen(classRole, LIMITS.classRole, "class_role_too_long")
    || validateTextLen(avatarUrl, LIMITS.avatarUrl, "avatar_url_too_long")
    || validateTextLen(bio, LIMITS.bio, "bio_too_long")
    || validateTextLen(publicBlurb, LIMITS.publicBlurb, "public_blurb_too_long")
    || validateStats(statsObj);
  if (error) return { error };

  return {
    character_name: String(characterName || ""),
    class_role: String(classRole || ""),
    level,
    reputation,
    class_key: classKey,
    specialization_key: specializationKey,
    xp,
    stats: JSON.stringify(statsObj || {}),
    bio: String(bio || ""),
    avatar_url: String(avatarUrl || ""),
    public_fields: JSON.stringify(publicFields || []),
    public_blurb: publicBlurb,
    editable_fields: JSON.stringify(editableFields || []),
    allow_requests: allowRequests ? 1 : 0
  };
}

export function sanitizePatch(body, existing = null) {
  const input = body || {};
  const output = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

  if (has("characterName")) output.character_name = String(input.characterName || "");
  if (has("classRole")) output.class_role = String(input.classRole || "");
  if (has("level")) {
    const level = input.level === "" || input.level == null ? null : Number(input.level);
    output.level = Number.isFinite(level) ? Math.max(0, level) : null;
  }
  if (has("reputation")) output.reputation = normalizeReputation(input.reputation);
  if (has("classKey")) {
    output.class_key = normalizeClassKey(input.classKey);
    if (!output.class_key) output.specialization_key = "";
  }
  if (has("specializationKey")) {
    const classKey = output.class_key ?? normalizeClassKey(input.classKey ?? existing?.class_key);
    output.specialization_key = normalizeSpecializationKey(classKey, input.specializationKey);
  }
  if (has("stats")) output.stats = normalizeProfileStats(input.stats, jsonParse(existing?.stats, {}));
  if (has("bio")) output.bio = String(input.bio || "");
  if (has("avatarUrl")) output.avatar_url = String(input.avatarUrl || "");
  if (has("publicFields")) output.public_fields = JSON.stringify(normalizePublicFields(input.publicFields));
  if (has("publicBlurb")) output.public_blurb = String(input.publicBlurb || "").trim();

  return output;
}

export function sanitizeRequestChanges(body) {
  const input = body || {};
  const output = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(input, key);

  if (has("characterName")) output.characterName = String(input.characterName || "");
  if (has("classRole")) output.classRole = String(input.classRole || "");
  if (has("level")) {
    const level = input.level === "" || input.level == null ? null : Number(input.level);
    output.level = Number.isFinite(level) ? Math.max(0, level) : null;
  }
  if (has("reputation")) output.reputation = normalizeReputation(input.reputation);
  if (has("classKey")) output.classKey = normalizeClassKey(input.classKey);
  if (has("specializationKey")) {
    output.specializationKey = normalizeSpecializationKey(output.classKey ?? input.classKey, input.specializationKey);
  }
  if (has("stats")) output.stats = normalizeProfileStats(input.stats);
  if (has("bio")) output.bio = String(input.bio || "");
  if (has("avatarUrl")) output.avatarUrl = String(input.avatarUrl || "");

  return output;
}

export function validatePlayerClassPathPatch(body, row) {
  const input = body || {};
  const currentClassKey = normalizeClassKey(row?.class_key);
  const currentSpecializationKey = normalizeSpecializationKey(currentClassKey, row?.specialization_key);
  const xp = normalizeXp(row?.xp);
  const wantsClass = Object.prototype.hasOwnProperty.call(input, "classKey");
  const wantsSpecialization = Object.prototype.hasOwnProperty.call(input, "specializationKey");
  if (!wantsClass && !wantsSpecialization) return null;

  if (currentSpecializationKey && wantsClass && normalizeClassKey(input.classKey) !== currentClassKey) {
    return "class_locked_after_specialization";
  }
  const rawClassKey = String(input.classKey ?? "").trim();
  const nextClassKey = wantsClass ? normalizeClassKey(input.classKey) : currentClassKey;
  if (wantsClass && rawClassKey && !nextClassKey) return "invalid_class";
  if (wantsClass && !nextClassKey && wantsSpecialization) return "class_required";

  if (wantsSpecialization) {
    if (!nextClassKey) return "class_required";
    if (currentSpecializationKey) return "specialization_locked";
    if (!canSelectSpecialization(xp)) return "specialization_xp_required";
    if (!normalizeSpecializationKey(nextClassKey, input.specializationKey)) return "invalid_specialization";
  }

  return null;
}

export function validateRequestChanges(changes) {
  let error = null;
  if ("characterName" in changes) error = error || validateTextLen(changes.characterName, LIMITS.name, "character_name_too_long");
  if ("classRole" in changes) error = error || validateTextLen(changes.classRole, LIMITS.classRole, "class_role_too_long");
  if ("avatarUrl" in changes) error = error || validateTextLen(changes.avatarUrl, LIMITS.avatarUrl, "avatar_url_too_long");
  if ("bio" in changes) error = error || validateTextLen(changes.bio, LIMITS.bio, "bio_too_long");
  if ("stats" in changes) error = error || validateStats(changes.stats);
  return error;
}

export function validateAndFinalizePatch(patch, { stringifyStats = true } = {}) {
  let error = null;
  if ("character_name" in patch) error = error || validateTextLen(patch.character_name, LIMITS.name, "character_name_too_long");
  if ("class_role" in patch) error = error || validateTextLen(patch.class_role, LIMITS.classRole, "class_role_too_long");
  if ("avatar_url" in patch) error = error || validateTextLen(patch.avatar_url, LIMITS.avatarUrl, "avatar_url_too_long");
  if ("bio" in patch) error = error || validateTextLen(patch.bio, LIMITS.bio, "bio_too_long");
  if ("public_blurb" in patch) error = error || validateTextLen(patch.public_blurb, LIMITS.publicBlurb, "public_blurb_too_long");
  if ("stats" in patch) error = error || validateStats(patch.stats);
  if (error) return { error };

  const output = { ...patch };
  if ("stats" in output && stringifyStats) output.stats = JSON.stringify(output.stats || {});
  return { patch: output };
}
