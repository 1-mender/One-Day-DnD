import express from "express";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { mapPublicProfile } from "../profile/profileDomain.js";
import { getPlayerContextFromRequest, isDmRequest } from "../sessionAuth.js";
import { now } from "../util.js";

export const mapRouter = express.Router();
const LOCATION_VISIBILITIES = new Set(["hidden", "known", "active", "completed"]);

function clampCoordinate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, num));
}

function readMapPlayers(db, partyId) {
  const rows = db.prepare(
    `
    SELECT p.id,
           p.display_name as displayName,
           p.status,
           p.last_seen as lastSeen,
           CASE WHEN cp.player_id IS NULL THEN 0 ELSE 1 END as profileCreated,
           cp.character_name,
           cp.class_role,
           cp.level,
           cp.stats,
           cp.avatar_url,
           cp.public_fields,
           cp.public_blurb,
           pmp.x as mapX,
           pmp.y as mapY,
           pmp.updated_at as mapUpdatedAt
    FROM players p
    LEFT JOIN character_profiles cp ON cp.player_id = p.id
    LEFT JOIN player_map_positions pmp ON pmp.player_id = p.id
    WHERE p.party_id=? AND p.banned=0
    ORDER BY p.id
  `
  ).all(partyId);

  return rows.map((row, index) => ({
    id: row.id,
    displayName: row.displayName,
    status: row.status,
    lastSeen: row.lastSeen,
    profileCreated: !!Number(row.profileCreated || 0),
    publicProfile: Number(row.profileCreated) ? mapPublicProfile(row) : null,
    mapPosition: {
      x: row.mapX == null ? 50 + Math.cos((Math.PI * 2 * index) / Math.max(1, rows.length)) * Math.min(7, 3 + rows.length) : Number(row.mapX),
      y: row.mapY == null ? 43 + Math.sin((Math.PI * 2 * index) / Math.max(1, rows.length)) * Math.min(7, 3 + rows.length) : Number(row.mapY),
      saved: row.mapX != null && row.mapY != null,
      updatedAt: row.mapUpdatedAt || null
    }
  }));
}

function readLocationStates(db, partyId) {
  return db.prepare(
    `
    SELECT location_id as locationId,
           visibility,
           updated_at as updatedAt
    FROM map_location_states
    WHERE party_id=?
  `
  ).all(partyId).map((row) => ({
    locationId: row.locationId,
    visibility: LOCATION_VISIBILITIES.has(row.visibility) ? row.visibility : "known",
    updatedAt: row.updatedAt || null
  }));
}

mapRouter.get("/state", (req, res) => {
  const isDm = isDmRequest(req);
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });

  const db = getDb();
  const partyId = getSinglePartyId();
  res.json({
    map: {
      imageUrl: "/map/where-is-the-lord.png",
      width: 1024,
      height: 1024
    },
    players: readMapPlayers(db, partyId),
    locationStates: readLocationStates(db, partyId)
  });
});

mapRouter.put("/players/:id/position", dmAuthMiddleware, (req, res) => {
  const playerId = Number(req.params.id);
  if (!playerId) return res.status(400).json({ error: "invalid_playerId" });

  const x = clampCoordinate(req.body?.x);
  const y = clampCoordinate(req.body?.y);
  if (x == null || y == null) return res.status(400).json({ error: "invalid_position" });

  const db = getDb();
  const partyId = getSinglePartyId();
  const player = db.prepare("SELECT id, party_id FROM players WHERE id=? AND party_id=? AND banned=0").get(playerId, partyId);
  if (!player) return res.status(404).json({ error: "not_found" });

  const t = now();
  db.prepare(
    `
    INSERT INTO player_map_positions(player_id, party_id, x, y, updated_by, updated_at)
    VALUES(?, ?, ?, ?, 'dm', ?)
    ON CONFLICT(player_id) DO UPDATE SET
      party_id=excluded.party_id,
      x=excluded.x,
      y=excluded.y,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
  `
  ).run(playerId, partyId, x, y, t);

  const payload = { playerId, position: { x, y, saved: true, updatedAt: t } };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:positionUpdated", payload);
  req.app.locals.io?.to("dm").emit("map:positionUpdated", payload);

  res.json({ ok: true, ...payload });
});

mapRouter.put("/locations/:id/state", dmAuthMiddleware, (req, res) => {
  const locationId = String(req.params.id || "").trim();
  if (!locationId || locationId.length > 80) return res.status(400).json({ error: "invalid_locationId" });

  const visibility = String(req.body?.visibility || "").trim();
  if (!LOCATION_VISIBILITIES.has(visibility)) return res.status(400).json({ error: "invalid_visibility" });

  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare(
    `
    INSERT INTO map_location_states(party_id, location_id, visibility, updated_by, updated_at)
    VALUES(?, ?, ?, 'dm', ?)
    ON CONFLICT(party_id, location_id) DO UPDATE SET
      visibility=excluded.visibility,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
  `
  ).run(partyId, locationId, visibility, t);

  const payload = { locationId, state: { locationId, visibility, updatedAt: t } };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:locationUpdated", payload);
  req.app.locals.io?.to("dm").emit("map:locationUpdated", payload);

  res.json({ ok: true, ...payload });
});
