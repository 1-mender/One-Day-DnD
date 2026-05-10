const STATUS_PRIORITY = {
  online: 3,
  idle: 2,
  offline: 1
};

export const DM_PLAYER_FLAG_FILTERS = [
  { key: "all", label: "Все" },
  { key: "no_profile", label: "Без профиля" },
  { key: "shield", label: "Щиток" },
  { key: "specialization", label: "Специализация" },
  { key: "requests", label: "Заявки" }
];

export function getDmPlayerSearchHaystack(player) {
  return [
    player?.displayName,
    player?.characterName,
    player?.publicProfile?.characterName,
    player?.classRole,
    player?.publicProfile?.classRole,
    player?.classKey,
    player?.specializationKey,
    player?.specializationRole?.key,
    player?.specializationRole?.label,
    player?.id ? `#${player.id}` : "",
    player?.id
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesDmPlayerQuery(player, query = "") {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return true;
  return getDmPlayerSearchHaystack(player).includes(normalized);
}

export function matchesDmPlayerStatus(player, filter = "all") {
  const normalized = String(filter || "all").trim().toLowerCase();
  const status = String(player?.status || "offline").trim().toLowerCase();
  if (normalized === "all") return true;
  return status === normalized;
}

export function matchesDmPlayerRole(player, filter = "all") {
  const normalized = String(filter || "all").trim().toLowerCase();
  if (normalized === "all") return true;
  return String(player?.specializationRole?.key || "").trim().toLowerCase() === normalized;
}

export function matchesDmPlayerFlag(player, filter = "all") {
  const normalized = String(filter || "all").trim().toLowerCase();
  if (normalized === "all") return true;
  if (normalized === "no_profile") return !player?.profileExists;
  if (normalized === "shield") return !!player?.shieldActive;
  if (normalized === "specialization") return !!player?.specializationAvailable;
  if (normalized === "requests") return Number(player?.pendingRequestCount || 0) > 0;
  return true;
}

export function filterDmPlayers(players, filters = {}) {
  const list = Array.isArray(players) ? players : [];
  return list
    .filter((player) => matchesDmPlayerStatus(player, filters.status))
    .filter((player) => matchesDmPlayerRole(player, filters.role))
    .filter((player) => matchesDmPlayerFlag(player, filters.flag))
    .filter((player) => matchesDmPlayerQuery(player, filters.query));
}

export function sortDmPlayers(players) {
  const list = Array.isArray(players) ? [...players] : [];
  return list.sort(compareDmPlayers);
}

export function getDmPlayerFilterSummary(filters = {}) {
  const parts = [];
  const status = String(filters.status || "all");
  const role = String(filters.role || "all");
  const flag = String(filters.flag || "all");
  const query = String(filters.query || "").trim();
  if (status !== "all") parts.push(`Статус: ${status}`);
  if (flag !== "all") parts.push(`Фокус: ${flag}`);
  if (role !== "all") parts.push(`Роль: ${role}`);
  if (query) parts.push(`Поиск: ${query}`);
  return parts.length ? parts.join(" • ") : "Все игроки";
}

function compareDmPlayers(a, b) {
  const scoreDiff = getPriorityScore(b) - getPriorityScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  const nameDiff = String(a?.displayName || "").localeCompare(String(b?.displayName || ""), "ru", { sensitivity: "base" });
  if (nameDiff !== 0) return nameDiff;
  return Number(a?.id || 0) - Number(b?.id || 0);
}

function getPriorityScore(player) {
  let score = 0;
  if (player?.shieldActive) score += 500;
  if (player?.specializationAvailable) score += 300;
  if (Number(player?.pendingRequestCount || 0) > 0) score += 250;
  if (!player?.profileExists) score += 150;
  score += STATUS_PRIORITY[String(player?.status || "offline").toLowerCase()] || 0;
  return score;
}
