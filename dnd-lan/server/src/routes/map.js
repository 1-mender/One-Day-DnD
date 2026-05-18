import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { mapPublicProfile } from "../profile/profileDomain.js";
import { getPlayerContextFromRequest, isDmRequest } from "../sessionAuth.js";
import { asyncHandler, now, randId, wrapMulter } from "../util.js";
import { repoRoot, uploadsDir } from "../paths.js";
import { finalizeUploadedFile, normalizeAllowedMimes, safeUnlink } from "../uploadSecurity.js";

export const mapRouter = express.Router();
const LOCATION_VISIBILITIES = new Set(["hidden", "known", "active", "completed"]);
const TMP_UPLOAD_DIR = path.join(uploadsDir, "tmp");
const MAPS_DIR = path.join(uploadsDir, "maps");
const DEFAULT_MAP_FILE = path.join(repoRoot, "Img", "Карта", "Where_is_the_Lord.png");
const DEFAULT_MAP_URL = "/api/map/default-image";
export const MAP_UPLOAD_MAX_BYTES = Number(process.env.MAP_UPLOAD_MAX_BYTES || 10 * 1024 * 1024);
export const MAP_ALLOWED_MIMES = normalizeAllowedMimes(
  process.env.MAP_UPLOAD_ALLOWED_MIMES
    ? String(process.env.MAP_UPLOAD_ALLOWED_MIMES).split(",")
    : ["image/jpeg", "image/png", "image/webp", "image/gif"]
);

fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(MAPS_DIR, { recursive: true });

function readMapRows(db, partyId) {
  return db.prepare(
    `SELECT id, filename, name, width, height, created_at as createdAt, updated_at as updatedAt
     FROM maps
     WHERE party_id = ?
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`
  ).all(partyId);
}

function clampCoordinate(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, num));
}

function toMapResponse(row) {
  if (!row) return null;
  const filename = String(row.filename || "").trim();
  return {
    ...row,
    url: filename ? `/uploads/maps/${filename}` : DEFAULT_MAP_URL
  };
}

function getActiveMapInfo(maps) {
  if (Array.isArray(maps) && maps.length > 0) {
    const activeMap = toMapResponse(maps[0]);
    return {
      ...activeMap,
      imageUrl: activeMap.url,
      isDefault: false
    };
  }

  return {
    id: "default",
    name: "World Map",
    filename: "",
    width: 1024,
    height: 1024,
    url: DEFAULT_MAP_URL,
    imageUrl: DEFAULT_MAP_URL,
    isDefault: true
  };
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

function readLocation(db, partyId, locationId) {
  const row = db.prepare(
    `SELECT id, name, category, description, default_x as defaultX, default_y as defaultY, created_by as createdBy, created_at as createdAt, updated_at as updatedAt
     FROM map_locations
     WHERE party_id = ? AND id = ?`
  ).get(partyId, locationId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    defaultX: row.defaultX,
    defaultY: row.defaultY,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

mapRouter.get("/default-image", (_req, res) => {
  if (!fs.existsSync(DEFAULT_MAP_FILE)) {
    return res.status(404).json({ error: "default_map_missing" });
  }
  return res.sendFile(DEFAULT_MAP_FILE);
});

mapRouter.get("/state", (req, res) => {
  const isDm = isDmRequest(req);
  const me = getPlayerContextFromRequest(req, { at: Date.now() });
  if (!isDm && !me) return res.status(401).json({ error: "not_authenticated" });

  const db = getDb();
  const partyId = getSinglePartyId();
  // read editable locations, tokens and available maps
  const locations = db.prepare(
    `SELECT id, name, category, description, default_x as defaultX, default_y as defaultY, created_by as createdBy, created_at as createdAt, updated_at as updatedAt FROM map_locations WHERE party_id = ? ORDER BY name`
  ).all(partyId);
  const tokens = db.prepare(
    `SELECT id, name, type, x, y, updated_by as updatedBy, updated_at as updatedAt FROM map_tokens WHERE party_id = ? ORDER BY id`
  ).all(partyId);
  const maps = readMapRows(db, partyId);
  const responseMaps = maps.map(toMapResponse);
  const mapInfo = getActiveMapInfo(responseMaps);

  res.json({
    map: mapInfo,
    activeMap: mapInfo,
    players: readMapPlayers(db, partyId),
    locationStates: readLocationStates(db, partyId),
    locations: locations,
    tokens: tokens,
    maps: responseMaps
  });
});

// --- Map uploads / maps listing ---
const upload = multer({
  dest: TMP_UPLOAD_DIR,
  limits: { fileSize: MAP_UPLOAD_MAX_BYTES }
});

mapRouter.get("/maps", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const rows = readMapRows(db, partyId);
  res.json({ ok: true, maps: rows.map(toMapResponse) });
});

mapRouter.post("/maps", dmAuthMiddleware, wrapMulter(upload.single("file")), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  const partyId = getSinglePartyId();
  const normalized = await finalizeUploadedFile(req.file, {
    allowText: false,
    allowedMimes: MAP_ALLOWED_MIMES
  });
  if (!normalized.ok) {
    const status = normalized.error === "upload_failed" ? 400 : 415;
    return res.status(status).json({ error: normalized.error });
  }

  const ext = path.extname(normalized.filename).toLowerCase();
  const originalBase = path.basename(req.file.originalname || "map", path.extname(req.file.originalname || ""));
  const safeBase = String(originalBase || "map")
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80) || "map";
  const safeName = `map_${Date.now()}_${randId(8)}_${safeBase}${ext}`;
  const destPath = path.join(MAPS_DIR, safeName);

  try {
    fs.renameSync(normalized.path, destPath);

    const meta = await sharp(destPath).metadata();
    const width = Number(meta.width || 0);
    const height = Number(meta.height || 0);
    if (!width || !height) {
      safeUnlink(destPath);
      return res.status(415).json({ error: "unsupported_file_type" });
    }

    const db = getDb();
    const t = now();
    const requestedName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const mapName = requestedName || req.file.originalname || safeBase;
    const info = db.prepare(`INSERT INTO maps(party_id, filename, name, width, height, created_by, created_at, updated_at) VALUES(?, ?, ?, ?, ?, 'dm', ?, ?)`)
      .run(partyId, safeName, mapName, width, height, t, t);
    const mapId = info.lastInsertRowid;
    const map = toMapResponse(
      db.prepare(`SELECT id, filename, name, width, height, created_at as createdAt, updated_at as updatedAt FROM maps WHERE id = ?`).get(mapId)
    );
    req.app.locals.io?.to(`party:${partyId}`).emit("map:mapsUpdated", { maps: [map] });
    req.app.locals.io?.to("dm").emit("map:mapsUpdated", { maps: [map] });
    return res.json({ ok: true, map });
  } catch {
    safeUnlink(normalized.path);
    safeUnlink(destPath);
    return res.status(500).json({ error: "upload_failed" });
  }
}));

mapRouter.put("/maps/:id/activate", dmAuthMiddleware, (req, res) => {
  const mapId = Number(req.params.id);
  if (!mapId) return res.status(400).json({ error: "invalid_mapId" });
  const db = getDb();
  const partyId = getSinglePartyId();
  const cur = db.prepare(`SELECT id FROM maps WHERE id = ? AND party_id = ?`).get(mapId, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  const t = now();
  db.prepare(`UPDATE maps SET updated_at = ? WHERE id = ? AND party_id = ?`).run(t, mapId, partyId);
  const map = toMapResponse(
    db.prepare(`SELECT id, filename, name, width, height, created_at as createdAt, updated_at as updatedAt FROM maps WHERE id = ?`).get(mapId)
  );
  req.app.locals.io?.to(`party:${partyId}`).emit("map:mapsUpdated", { maps: [map] });
  req.app.locals.io?.to("dm").emit("map:mapsUpdated", { maps: [map] });
  res.json({ ok: true, map });
});

mapRouter.delete("/maps/:id", dmAuthMiddleware, (req, res) => {
  const mapId = Number(req.params.id);
  if (!mapId) return res.status(400).json({ error: "invalid_mapId" });

  const db = getDb();
  const partyId = getSinglePartyId();
  const row = db.prepare(
    `SELECT id, filename
     FROM maps
     WHERE id = ? AND party_id = ?`
  ).get(mapId, partyId);
  if (!row) return res.status(404).json({ error: "not_found" });

  db.prepare("DELETE FROM maps WHERE id = ? AND party_id = ?").run(mapId, partyId);
  if (row.filename) {
    safeUnlink(path.join(MAPS_DIR, path.basename(String(row.filename))));
  }

  const maps = readMapRows(db, partyId).map(toMapResponse);
  const activeMap = getActiveMapInfo(maps);
  const payload = { ok: true, deletedMapId: mapId, activeMap, maps };
  req.app.locals.io?.to(`party:${partyId}`).emit("map:mapsUpdated", payload);
  req.app.locals.io?.to("dm").emit("map:mapsUpdated", payload);
  res.json(payload);
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

  const location = readLocation(db, partyId, id);
  const payload = { locationId: id, location };
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

  const location = readLocation(db, partyId, locationId);
  const payload = { locationId, location };
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
