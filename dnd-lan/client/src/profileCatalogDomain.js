import {
  getProfileOriginMeta,
  getProfileRoleMeta,
  joinProfileTags,
  normalizeProfileCatalogKey,
  parseProfileCarryBonus,
  splitProfileTags
} from "../../shared/profileCatalogs.js";

export const DEFAULT_PROFILE_CATALOGS = {
  roles: [],
  origins: []
};

export function normalizeProfileCatalogs(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    roles: normalizeCatalogList(source.roles, "role"),
    origins: normalizeCatalogList(source.origins, "origin")
  };
}

function normalizeCatalogList(list, prefix) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item, index) => normalizeCatalogEntry(item, prefix, index + 1))
    .filter(Boolean);
}

function normalizeCatalogEntry(item, prefix, index) {
  if (!item || typeof item !== "object") return null;
  const label = String(item.label || item.name || "").trim();
  if (!label) return null;
  const key = normalizeProfileCatalogKey(item.key, label) || `${prefix}_${index}`;
  return {
    id: String(item.id || key || `${prefix}_${index}`).trim().slice(0, 48) || `${prefix}_${index}`,
    key,
    label: label.slice(0, 80),
    description: String(item.description || "").trim().slice(0, 500),
    tags: splitProfileTags(item.tags),
    ...(prefix === "origin" ? { carryBonus: parseProfileCarryBonus(item.carryBonus) } : {})
  };
}

export function createEmptyRoleCatalogEntry(index = 1) {
  return {
    id: `role_${Date.now()}_${index}`,
    key: "",
    label: "",
    description: "",
    tags: []
  };
}

export function createEmptyOriginCatalogEntry(index = 1) {
  return {
    id: `origin_${Date.now()}_${index}`,
    key: "",
    label: "",
    description: "",
    carryBonus: 0,
    tags: []
  };
}

export function applyRoleCatalogEntryToProfile(current, entry) {
  const normalized = normalizeCatalogEntry(entry, "role", 1);
  if (!normalized) return current;
  const stats = {
    ...(current?.stats || {}),
    roleKey: normalized.key,
    roleDescription: normalized.description,
    roleTags: joinProfileTags(normalized.tags)
  };
  return {
    ...current,
    classRole: normalized.label,
    stats
  };
}

export function applyOriginCatalogEntryToProfile(current, entry) {
  const normalized = normalizeCatalogEntry(entry, "origin", 1);
  if (!normalized) return current;
  const stats = {
    ...(current?.stats || {}),
    originKey: normalized.key,
    originName: normalized.label,
    originDescription: normalized.description,
    originTags: joinProfileTags(normalized.tags),
    originCarryBonus: parseProfileCarryBonus(normalized.carryBonus)
  };
  return {
    ...current,
    stats
  };
}

export { getProfileOriginMeta, getProfileRoleMeta, joinProfileTags, parseProfileCarryBonus, splitProfileTags };
