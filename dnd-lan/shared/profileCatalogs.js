export const PROFILE_ROLE_META_KEYS = ["roleKey", "roleDescription", "roleTags"];
export const PROFILE_ORIGIN_META_KEYS = ["originKey", "originName", "originDescription", "originTags", "originCarryBonus"];
export const PROFILE_HIDDEN_STAT_KEYS = [...PROFILE_ROLE_META_KEYS, ...PROFILE_ORIGIN_META_KEYS];

export function normalizeProfileCatalogKey(value, fallback = "") {
  const source = String(value || fallback || "").trim().toLowerCase();
  if (!source) return "";
  return source
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function splitProfileTags(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
      .split(/[\n,;|]+/g);
  const seen = new Set();
  const tags = [];
  for (const item of source) {
    const tag = String(item || "").trim();
    if (!tag) continue;
    const normalized = tag.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(tag.slice(0, 32));
    if (tags.length >= 8) break;
  }
  return tags;
}

export function joinProfileTags(value) {
  return splitProfileTags(value).join(", ");
}

export function parseProfileCarryBonus(value, fallback = 0) {
  const numeric = Number(value ?? fallback ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-50, Math.min(50, Math.round(numeric)));
}

export function getProfileRoleMeta(stats) {
  const source = stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
  const key = normalizeProfileCatalogKey(source.roleKey, source.classRole);
  const description = String(source.roleDescription || "").trim();
  const tags = splitProfileTags(source.roleTags);
  if (!key && !description && tags.length === 0) return null;
  return {
    key,
    description,
    tags
  };
}

export function getProfileOriginMeta(stats) {
  const source = stats && typeof stats === "object" && !Array.isArray(stats) ? stats : {};
  const name = String(source.originName || "").trim();
  const key = normalizeProfileCatalogKey(source.originKey, name);
  const description = String(source.originDescription || "").trim();
  const tags = splitProfileTags(source.originTags);
  const carryBonus = parseProfileCarryBonus(source.originCarryBonus);
  const hasCarryBonus = String(source.originCarryBonus ?? "").trim() !== "";
  if (!name && !key && !description && tags.length === 0 && !hasCarryBonus) return null;
  return {
    key,
    name: name || key || "Происхождение",
    description,
    tags,
    carryBonus
  };
}
