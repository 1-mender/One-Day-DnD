import { formatReputationLabel, getRaceProfile } from "./profileDomain.js";
import { getClassPathLabelWithRole } from "./classCatalog.js";

export function getPlayerPrimaryName(player, profile = player?.publicProfile || null) {
  const characterName = String(profile?.characterName || "").trim();
  const displayName = String(player?.displayName || "").trim();
  return characterName || displayName || "?";
}

export function getPlayerSecondaryName(player, profile = player?.publicProfile || null) {
  const characterName = String(profile?.characterName || "").trim();
  const displayName = String(player?.displayName || "").trim();
  if (!characterName || !displayName || characterName === displayName) return "";
  return displayName;
}

export function getPublicProfileMeta(profile) {
  if (!profile) return "";
  const classPath = profile.classKey ? getClassPathLabelWithRole(profile) : "";
  const race = getPublicRaceLabel(profile);
  return [
    classPath || String(profile.classRole || "").trim(),
    profile.level != null ? `lvl ${profile.level}` : "",
    profile.reputation != null ? `rep ${formatReputationLabel(profile.reputation)}` : "",
    race ? `race: ${race}` : ""
  ].filter(Boolean).join(" • ");
}

function getPublicRaceLabel(profile) {
  if (profile?.raceKey) {
    return getRaceProfile({ race: profile.raceKey, raceVariant: profile.raceVariantKey }).displayName;
  }
  const raw = String(profile?.race || "").trim();
  if (!raw) return "";
  if (/^[a-z_\s.-]+$/i.test(raw)) {
    return getRaceProfile({ race: raw }).displayName;
  }
  return raw;
}

export function matchesStatusFilter(player, filter = "all") {
  const normalized = String(filter || "all").toLowerCase();
  const status = String(player?.status || "offline").toLowerCase();
  if (normalized === "online") return status === "online" || status === "idle";
  if (normalized === "offline") return status === "offline";
  return true;
}

export function matchesPlayerQuery(player, query = "") {
  const normalizedQuery = String(query || "").toLowerCase().trim();
  if (!normalizedQuery) return true;

  const haystack = [
    String(player?.displayName || ""),
    String(player?.publicProfile?.characterName || "")
  ].join("\n").toLowerCase();

  return haystack.includes(normalizedQuery);
}
