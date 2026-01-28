import { getDb } from "./db.js";
import { now } from "./util.js";

const RETENTION = Number(process.env.EVENTS_RETENTION || 20000);
const TRIM_EVERY_MS = Number(process.env.EVENTS_TRIM_EVERY_MS || 60_000);
const lastTrimAtByParty = new Map();

function safeJson(data) {
  try {
    return JSON.stringify(data ?? {});
  } catch {
    return "{}";
  }
}

function trimEventsIfNeeded(partyId) {
  if (!RETENTION || RETENTION <= 0) return;

  const t = now();
  const last = lastTrimAtByParty.get(partyId) || 0;
  if (t - last < TRIM_EVERY_MS) return;

  lastTrimAtByParty.set(partyId, t);

  const db = getDb();
  const cnt = db.prepare("SELECT COUNT(*) AS c FROM events WHERE party_id=?").get(partyId)?.c || 0;
  if (cnt <= RETENTION) return;

  const cutoffRow = db
    .prepare("SELECT created_at FROM events WHERE party_id=? ORDER BY created_at DESC LIMIT 1 OFFSET ?")
    .get(partyId, RETENTION - 1);

  const cutoff = cutoffRow?.created_at;
  if (!cutoff) return;

  db.prepare("DELETE FROM events WHERE party_id=? AND created_at < ?").run(partyId, cutoff);
}

export function logEvent(event, maybeIo) {
  const io = maybeIo ?? event?.io ?? null;

  const partyId = Number(event?.partyId);
  if (!partyId) return null;

  const type = String(event?.type || "event");
  const actorRole = String(event?.actorRole || "system");
  const actorPlayerId = event?.actorPlayerId == null ? null : Number(event.actorPlayerId);
  const actorName = event?.actorName == null ? null : String(event.actorName);
  const targetType = event?.targetType == null ? null : String(event.targetType);
  const targetId = event?.targetId == null ? null : Number(event.targetId);
  const message = String(event?.message || "");
  const data = event?.data ?? null;

  const db = getDb();
  const t = now();

  const info = db
    .prepare(
      `
      INSERT INTO events(
        party_id, type, actor_role, actor_player_id, actor_name,
        target_type, target_id, message, data, created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?)
    `
    )
    .run(
      partyId,
      type,
      actorRole,
      actorPlayerId,
      actorName,
      targetType,
      targetId,
      message,
      safeJson(data),
      t
    );

  try {
    trimEventsIfNeeded(partyId);
  } catch (e) {
    console.error("events retention failed:", e);
  }

  if (io) {
    io.to("dm").emit("events:updated", { id: info.lastInsertRowid, type });
  }

  return info.lastInsertRowid;
}
