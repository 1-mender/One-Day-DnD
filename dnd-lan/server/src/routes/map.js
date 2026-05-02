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
           cp.reputation,
           cp.class_key,
           cp.specialization_key,
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
           x,
           y,
           updated_at as updatedAt
    FROM map_location_states
    WHERE party_id=?
  `
  ).all(partyId).map((row) => ({
    locationId: row.locationId,
    visibility: LOCATION_VISIBILITIES.has(row.visibility) ? row.visibility : "known",
    x: row.x == null ? null : Number(row.x),
    y: row.y == null ? null : Number(row.y),
    updatedAt: row.updatedAt || null
  }));
}

mapRouter.get("/state", (req, res) => {
  const isDm = isDmRequest(req);
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });

  const db = getDb();
  const partyId = getSinglePartyId();
  // read editable locations and tokens if present
  const locations = db.prepare(
    `SELECT id, name, category, description, default_x as defaultX, default_y as defaultY, created_by as createdBy, created_at as createdAt, updated_at as updatedAt FROM map_locations WHERE party_id = ? ORDER BY name`
  ).all(partyId);
  const tokens = db.prepare(
    `SELECT id, name, type, x, y, updated_by as updatedBy, updated_at as updatedAt FROM map_tokens WHERE party_id = ? ORDER BY id`
  ).all(partyId);

  res.json({
    map: {
      imageUrl: "/map/where-is-the-lord.png",
      width: 1024,
      height: 1024
    },
    players: readMapPlayers(db, partyId),
    locationStates: readLocationStates(db, partyId),
    locations: locations,
    tokens: tokens
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

mapRouter.put("/locations/:id/position", dmAuthMiddleware, (req, res) => {
  const locationId = String(req.params.id || "").trim();
  if (!locationId || locationId.length > 80) return res.status(400).json({ error: "invalid_locationId" });

  const x = clampCoordinate(req.body?.x);
  const y = clampCoordinate(req.body?.y);
  if (x == null || y == null) return res.status(400).json({ error: "invalid_position" });

  const db = getDb();
  const partyId = getSinglePartyId();
  const current = db
    .prepare("SELECT visibility FROM map_location_states WHERE party_id=? AND location_id=?")
    .get(partyId, locationId);
  const requestedVisibility = String(req.body?.visibility || "").trim();
  const visibility = LOCATION_VISIBILITIES.has(requestedVisibility)
    ? requestedVisibility
    : (LOCATION_VISIBILITIES.has(current?.visibility) ? current.visibility : "known");
  const t = now();

  db.prepare(
    `
    INSERT INTO map_location_states(party_id, location_id, visibility, x, y, updated_by, updated_at)
    VALUES(?, ?, ?, ?, ?, 'dm', ?)
    ON CONFLICT(party_id, location_id) DO UPDATE SET
      visibility=excluded.visibility,
      x=excluded.x,
      y=excluded.y,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
  `
  ).run(partyId, locationId, visibility, x, y, t);

  const payload = { locationId, state: { locationId, visibility, x, y, updatedAt: t } };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:locationUpdated", payload);
  req.app.locals.io?.to("dm").emit("map:locationUpdated", payload);

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

// --- DM editable locations CRUD ---
function makeIdFromName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

mapRouter.get("/locations", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const rows = db.prepare(
    `SELECT id, name, category, description, default_x as defaultX, default_y as defaultY, created_by as createdBy, created_at as createdAt, updated_at as updatedAt FROM map_locations WHERE party_id = ? ORDER BY name`
  ).all(partyId);
  res.json({ ok: true, locations: rows });
});

mapRouter.post("/locations", dmAuthMiddleware, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "invalid_name" });
  let id = String(req.body?.id || "").trim() || makeIdFromName(name);
  if (!id || id.length > 80) return res.status(400).json({ error: "invalid_id" });
  const category = req.body?.category ? String(req.body.category).trim() : null;
  const description = req.body?.description ? String(req.body.description) : null;
  const defaultX = clampCoordinate(req.body?.default_x ?? req.body?.defaultX ?? null);
  const defaultY = clampCoordinate(req.body?.default_y ?? req.body?.defaultY ?? null);
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  db.prepare(
    `INSERT INTO map_locations(party_id, id, name, category, description, default_x, default_y, created_by, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, 'dm', ?, ?)
     ON CONFLICT(party_id, id) DO UPDATE SET name=excluded.name, category=excluded.category, description=excluded.description, default_x=excluded.default_x, default_y=excluded.default_y, updated_at=excluded.updated_at`
  ).run(partyId, id, name, category, description, defaultX, defaultY, t, t);

  const payload = { locationId: id, location: { id, name, category, description, defaultX, defaultY, updatedAt: t } };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:locationCreated", payload);
  req.app.locals.io?.to("dm").emit("map:locationCreated", payload);
  res.json({ ok: true, ...payload });
});

mapRouter.put("/locations/:id", dmAuthMiddleware, (req, res) => {
  const locationId = String(req.params.id || "").trim();
  if (!locationId || locationId.length > 80) return res.status(400).json({ error: "invalid_locationId" });
  const name = req.body?.name ? String(req.body.name).trim() : null;
  const category = req.body?.category ? String(req.body.category).trim() : null;
  const description = req.body?.description ? String(req.body.description) : null;
  const defaultX = clampCoordinate(req.body?.default_x ?? req.body?.defaultX ?? null);
  const defaultY = clampCoordinate(req.body?.default_y ?? req.body?.defaultY ?? null);
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  const cur = db.prepare("SELECT id FROM map_locations WHERE party_id=? AND id=?").get(partyId, locationId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  db.prepare(
    `UPDATE map_locations SET name = COALESCE(?, name), category = COALESCE(?, category), description = COALESCE(?, description), default_x = COALESCE(?, default_x), default_y = COALESCE(?, default_y), updated_at = ? WHERE party_id = ? AND id = ?`
  ).run(name, category, description, defaultX, defaultY, t, partyId, locationId);

  const payload = { locationId, location: { id: locationId, name, category, description, defaultX, defaultY, updatedAt: t } };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:locationUpdated", payload);
  req.app.locals.io?.to("dm").emit("map:locationUpdated", payload);
  res.json({ ok: true, ...payload });
});

mapRouter.delete("/locations/:id", dmAuthMiddleware, (req, res) => {
  const locationId = String(req.params.id || "").trim();
  if (!locationId || locationId.length > 80) return res.status(400).json({ error: "invalid_locationId" });
  const db = getDb();
  const partyId = getSinglePartyId();
  const cur = db.prepare("SELECT id FROM map_locations WHERE party_id=? AND id=?").get(partyId, locationId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  db.prepare("DELETE FROM map_locations WHERE party_id=? AND id=?").run(partyId, locationId);
  db.prepare("DELETE FROM map_location_states WHERE party_id=? AND location_id=?").run(partyId, locationId);

  const payload = { locationId };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:locationDeleted", payload);
  req.app.locals.io?.to("dm").emit("map:locationDeleted", payload);
  res.json({ ok: true, ...payload });
});

// --- DM tokens CRUD ---
mapRouter.get("/tokens", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const rows = db.prepare(`SELECT id, name, type, x, y, updated_by as updatedBy, updated_at as updatedAt FROM map_tokens WHERE party_id = ? ORDER BY id`).all(partyId);
  res.json({ ok: true, tokens: rows });
});

mapRouter.post("/tokens", dmAuthMiddleware, (req, res) => {
  const name = req.body?.name ? String(req.body.name) : null;
  const type = req.body?.type ? String(req.body.type) : null;
  const x = clampCoordinate(req.body?.x ?? req.body?.position?.x ?? null) ?? 50;
  const y = clampCoordinate(req.body?.y ?? req.body?.position?.y ?? null) ?? 43;
  const db = getDb();
  const partyId = getSinglePartyId();
  const t = now();
  const info = db.prepare(`INSERT INTO map_tokens(party_id, name, type, x, y, updated_by, updated_at) VALUES(?, ?, ?, ?, ?, 'dm', ?)`)
    .run(partyId, name, type, x, y, t);
  const tokenId = info.lastInsertRowid;
  const token = { id: tokenId, name, type, x, y, updatedAt: t };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:tokenCreated", { token });
  req.app.locals.io?.to("dm").emit("map:tokenCreated", { token });
  res.json({ ok: true, token });
});

mapRouter.put("/tokens/:id", dmAuthMiddleware, (req, res) => {
  const tokenId = Number(req.params.id);
  if (!tokenId) return res.status(400).json({ error: "invalid_tokenId" });
  const name = req.body?.name ? String(req.body.name) : null;
  const type = req.body?.type ? String(req.body.type) : null;
  const x = clampCoordinate(req.body?.x ?? req.body?.position?.x ?? null);
  const y = clampCoordinate(req.body?.y ?? req.body?.position?.y ?? null);
  const db = getDb();
  const partyId = getSinglePartyId();
  const cur = db.prepare(`SELECT id FROM map_tokens WHERE id = ? AND party_id = ?`).get(tokenId, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  const t = now();
  db.prepare(`UPDATE map_tokens SET name = COALESCE(?, name), type = COALESCE(?, type), x = COALESCE(?, x), y = COALESCE(?, y), updated_by = 'dm', updated_at = ? WHERE id = ? AND party_id = ?`).run(name, type, x, y, t, tokenId, partyId);
  const token = db.prepare(`SELECT id, name, type, x, y, updated_at as updatedAt FROM map_tokens WHERE id = ?`).get(tokenId);
  req.app.locals.io?.to(`party:${partyId}`).emit("map:tokenUpdated", { token });
  req.app.locals.io?.to("dm").emit("map:tokenUpdated", { token });
  res.json({ ok: true, token });
});

mapRouter.delete("/tokens/:id", dmAuthMiddleware, (req, res) => {
  const tokenId = Number(req.params.id);
  if (!tokenId) return res.status(400).json({ error: "invalid_tokenId" });
  const db = getDb();
  const partyId = getSinglePartyId();
  const cur = db.prepare(`SELECT id FROM map_tokens WHERE id = ? AND party_id = ?`).get(tokenId, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  db.prepare(`DELETE FROM map_tokens WHERE id = ? AND party_id = ?`).run(tokenId, partyId);
  req.app.locals.io?.to(`party:${partyId}`).emit("map:tokenDeleted", { tokenId });
  req.app.locals.io?.to("dm").emit("map:tokenDeleted", { tokenId });
  res.json({ ok: true, tokenId });
});
