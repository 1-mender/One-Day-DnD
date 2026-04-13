import { getDb, getSinglePartyId } from "../src/db.js";
import { now } from "../src/util.js";

export function seedActiveArcadeActivity(playerId, payload = {}) {
  const db = getDb();
  const partyId = getSinglePartyId();
  const stamp = now();
  return db.prepare(
    `INSERT INTO player_live_activities(
      party_id, player_id, kind, status, payload, opened_by, opened_at, updated_at
    ) VALUES(?, ?, 'arcade', 'active', ?, 'test', ?, ?)`
  ).run(partyId, playerId, JSON.stringify(payload || {}), stamp, stamp).lastInsertRowid;
}
