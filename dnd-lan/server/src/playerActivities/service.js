import { getDb } from "../db.js";
import { jsonParse, now } from "../util.js";

export const LIVE_ACTIVITY_KINDS = {
  ARCADE: "arcade",
  SHIELD: "shield"
};

const LIVE_ACTIVITY_KIND_SET = new Set(Object.values(LIVE_ACTIVITY_KINDS));

function normalizeKind(kind) {
  const value = String(kind || "").trim().toLowerCase();
  if (!value) return "";
  return LIVE_ACTIVITY_KIND_SET.has(value) ? value : "";
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload;
}

export function mapLiveActivity(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    partyId: Number(row.party_id),
    playerId: Number(row.player_id),
    kind: normalizeKind(row.kind),
    status: String(row.status || "closed"),
    payload: jsonParse(row.payload, {}),
    openedBy: row.opened_by || "",
    openedAt: Number(row.opened_at || 0),
    closedAt: row.closed_at == null ? null : Number(row.closed_at),
    updatedAt: Number(row.updated_at || 0)
  };
}

export function getActivePlayerLiveActivity(playerId, {
  db = getDb(),
  kind = null
} = {}) {
  const safePlayerId = Number(playerId || 0);
  if (!safePlayerId) return null;
  const safeKind = normalizeKind(kind);
  const row = safeKind
    ? db.prepare(
      `SELECT *
       FROM player_live_activities
       WHERE player_id=? AND kind=? AND status='active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    ).get(safePlayerId, safeKind)
    : db.prepare(
      `SELECT *
       FROM player_live_activities
       WHERE player_id=? AND status='active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    ).get(safePlayerId);
  return mapLiveActivity(row);
}

export function openPlayerLiveActivity({
  playerId,
  partyId,
  kind = LIVE_ACTIVITY_KINDS.ARCADE,
  payload = {},
  openedBy = "dm",
  db = getDb(),
  nowFn = now
}) {
  const safePlayerId = Number(playerId || 0);
  const safePartyId = Number(partyId || 0);
  if (!safePlayerId || !safePartyId) return null;
  const safeKind = normalizeKind(kind);
  if (!safeKind) return null;
  const stamp = Number(nowFn()) || Date.now();
  const data = JSON.stringify(normalizePayload(payload));
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE player_live_activities
       SET status='closed', closed_at=?, updated_at=?
       WHERE player_id=? AND status='active'`
    ).run(stamp, stamp, safePlayerId);
    const result = db.prepare(
      `INSERT INTO player_live_activities(
        party_id, player_id, kind, status, payload, opened_by, opened_at, updated_at
      ) VALUES(?, ?, ?, 'active', ?, ?, ?, ?)`
    ).run(safePartyId, safePlayerId, safeKind, data, String(openedBy || "dm"), stamp, stamp);
    return db.prepare("SELECT * FROM player_live_activities WHERE id=?").get(result.lastInsertRowid);
  });
  return mapLiveActivity(tx());
}

export function closePlayerLiveActivity({
  playerId,
  kind = null,
  db = getDb(),
  nowFn = now
}) {
  const safePlayerId = Number(playerId || 0);
  if (!safePlayerId) return null;
  const safeKind = normalizeKind(kind);
  const current = safeKind
    ? db.prepare(
      `SELECT *
       FROM player_live_activities
       WHERE player_id=? AND kind=? AND status='active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    ).get(safePlayerId, safeKind)
    : db.prepare(
      `SELECT *
       FROM player_live_activities
       WHERE player_id=? AND status='active'
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    ).get(safePlayerId);
  if (!current) return null;
  const stamp = Number(nowFn()) || Date.now();
  db.prepare(
    `UPDATE player_live_activities
     SET status='closed', closed_at=?, updated_at=?
     WHERE id=?`
  ).run(stamp, stamp, current.id);
  return mapLiveActivity({ ...current, status: "closed", closed_at: stamp, updated_at: stamp });
}

export function requireActivePlayerLiveActivity(playerId, options = {}) {
  return getActivePlayerLiveActivity(playerId, options);
}
