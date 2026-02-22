import express from "express";
import path from "node:path";
import fs from "node:fs";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getPartySettings, setPartySettings, getParty } from "../db.js";
import { now, jsonParse } from "../util.js";
import { logEvent } from "../events.js";
import { uploadsDir } from "../paths.js";
import { getRequestPartyId, isDmRequest } from "../sessionAuth.js";

export const bestiaryRouter = express.Router();

const MONSTERS_DIR = path.join(uploadsDir, "monsters");
const BESTIARY_DIR = path.join(uploadsDir, "bestiary");
fs.mkdirSync(MONSTERS_DIR, { recursive: true });
fs.mkdirSync(BESTIARY_DIR, { recursive: true });

function imageUrl(filename) {
  const bestiaryPath = path.join(BESTIARY_DIR, filename);
  if (fs.existsSync(bestiaryPath)) return `/uploads/bestiary/${filename}`;
  return `/uploads/monsters/${filename}`;
}

const DEFAULT_PAGE_LIMIT = Number(process.env.BESTIARY_PAGE_LIMIT || 200);
const MAX_PAGE_LIMIT = 500;
const MAX_IMAGE_IDS = 200;

function decodeCursor(raw) {
  if (!raw) return null;
  try {
    const txt = Buffer.from(String(raw), "base64url").toString("utf8");
    const parsed = JSON.parse(txt);
    const name = typeof parsed?.name === "string" ? parsed.name : "";
    const id = Number(parsed?.id || 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { name, id };
  } catch {
    return null;
  }
}

function encodeCursor(row) {
  const payload = { name: String(row?.name || ""), id: Number(row?.id || 0) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function parseIdList(raw, max) {
  const items = String(raw || "")
    .split(",")
    .map((v) => Number(String(v).trim()))
    .filter((v) => Number.isFinite(v) && v > 0);
  const uniq = [];
  const seen = new Set();
  for (const id of items) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(id);
    if (uniq.length >= max) break;
  }
  return uniq;
}

function fetchImagesByMonsterIds(db, partyId, monsterIds, limitPer = 0) {
  if (!monsterIds.length) return new Map();
  const placeholders = monsterIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT mi.id, mi.monster_id, mi.filename
       FROM monster_images mi
       JOIN monsters m ON m.id=mi.monster_id
      WHERE m.party_id=? AND mi.monster_id IN (${placeholders})
      ORDER BY mi.monster_id, mi.id`
  ).all(partyId, ...monsterIds);
  const out = new Map();
  for (const r of rows) {
    const list = out.get(r.monster_id) || [];
    if (limitPer > 0 && list.length >= limitPer) continue;
    list.push({ id: r.id, url: imageUrl(r.filename) });
    out.set(r.monster_id, list);
  }
  return out;
}

bestiaryRouter.get("/", (req, res) => {
  const db = getDb();
  const isDm = isDmRequest(req);
  const partyId = getRequestPartyId(req, { at: Date.now() }) || getParty().id;
  const settings = getPartySettings(partyId);

  if (!isDm && !settings.bestiary_enabled) return res.json({ enabled: false, items: [], nextCursor: null });

  const q = String(req.query.q ?? "").trim();
  const cursor = decodeCursor(req.query.cursor);
  const limitRaw = Number(req.query.limit ?? DEFAULT_PAGE_LIMIT);
  const limit = Math.max(1, Math.min(MAX_PAGE_LIMIT, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_PAGE_LIMIT));
  const includeImages = String(req.query.includeImages || "0") === "1";
  const imagesLimitRaw = Number(req.query.imagesLimit ?? 0);
  const imagesLimit = Math.max(0, Math.min(20, Number.isFinite(imagesLimitRaw) ? imagesLimitRaw : 0));

  const where = ["party_id=?"];
  const args = [partyId];
  if (!isDm) where.push("is_hidden=0");
  if (q) {
    where.push("name LIKE ? COLLATE NOCASE");
    args.push(`%${q}%`);
  }
  if (cursor) {
    where.push("(name COLLATE NOCASE > ? OR (name COLLATE NOCASE = ? AND id > ?))");
    args.push(cursor.name, cursor.name, cursor.id);
  }

  const rows = db.prepare(
    `
    SELECT id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at
    FROM monsters
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY name COLLATE NOCASE ASC, id ASC
    LIMIT ?
  `
  ).all(...args, limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const items = pageRows.map((m) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    habitat: m.habitat,
    cr: m.cr,
    stats: jsonParse(m.stats, {}),
    abilities: jsonParse(m.abilities, []),
    description: m.description,
    is_hidden: m.is_hidden,
    created_at: m.created_at,
    updated_at: m.updated_at
  }));

  if (includeImages && items.length) {
    const map = fetchImagesByMonsterIds(db, partyId, items.map((m) => m.id), imagesLimit);
    for (const m of items) {
      m.images = map.get(m.id) || [];
    }
  }

  const nextCursor = hasMore ? encodeCursor(pageRows[pageRows.length - 1]) : null;
  res.json({ enabled: !!settings.bestiary_enabled, items, nextCursor });
});

bestiaryRouter.get("/images", (req, res) => {
  const db = getDb();
  const isDm = isDmRequest(req);
  const partyId = getRequestPartyId(req, { at: Date.now() }) || getParty().id;
  const settings = getPartySettings(partyId);
  const ids = parseIdList(req.query.ids, MAX_IMAGE_IDS);

  if (!isDm && !settings.bestiary_enabled) return res.json({ items: [] });
  if (!ids.length) return res.json({ items: [] });

  let allowedIds = ids;
  if (!isDm) {
    const placeholders = ids.map(() => "?").join(",");
    allowedIds = db.prepare(
      `SELECT id FROM monsters WHERE party_id=? AND is_hidden=0 AND id IN (${placeholders})`
    ).all(partyId, ...ids).map((r) => r.id);
  }

  if (!allowedIds.length) return res.json({ items: [] });

  const limitPerRaw = Number(req.query.limitPer ?? 0);
  const limitPer = Math.max(0, Math.min(20, Number.isFinite(limitPerRaw) ? limitPerRaw : 0));

  const map = fetchImagesByMonsterIds(db, partyId, allowedIds, limitPer);
  const items = allowedIds.map((id) => ({
    monsterId: id,
    images: map.get(id) || []
  }));

  res.json({ items });
});

bestiaryRouter.post("/", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  const t = now();
  const id = db.prepare(
    "INSERT INTO monsters(party_id, name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    partyId,
    name,
    String(b.type || ""),
    String(b.habitat || ""),
    String(b.cr || ""),
    JSON.stringify(b.stats || {}),
    JSON.stringify(b.abilities || []),
    String(b.description || ""),
    b.is_hidden ? 1 : 0,
    t, t
  ).lastInsertRowid;

  logEvent({
    partyId,
    type: "bestiary.created",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: Number(id),
    message: `Добавлен монстр: ${name}`,
    io: req.app.locals.io
  });

  req.app.locals.io?.emit("bestiary:updated");
  res.json({ ok: true, id });
});

bestiaryRouter.put("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT * FROM monsters WHERE id=? AND party_id=?").get(id, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });

  const b = req.body || {};
  const name = String(b.name ?? cur.name).trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  db.prepare(
    "UPDATE monsters SET name=?, type=?, habitat=?, cr=?, stats=?, abilities=?, description=?, is_hidden=?, updated_at=? WHERE id=? AND party_id=?"
  ).run(
    name,
    String(b.type ?? cur.type ?? ""),
    String(b.habitat ?? cur.habitat ?? ""),
    String(b.cr ?? cur.cr ?? ""),
    JSON.stringify(b.stats ?? jsonParse(cur.stats, {})),
    JSON.stringify(b.abilities ?? jsonParse(cur.abilities, [])),
    String(b.description ?? cur.description ?? ""),
    (b.is_hidden ?? cur.is_hidden) ? 1 : 0,
    now(),
    id,
    partyId
  );

  logEvent({
    partyId,
    type: "bestiary.updated",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: Number(cur.id),
    message: `Изменён монстр: ${name}`,
    io: req.app.locals.io
  });

  req.app.locals.io?.emit("bestiary:updated");
  res.json({ ok: true });
});

bestiaryRouter.delete("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getParty().id;
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT id, name FROM monsters WHERE id=? AND party_id=?").get(id, partyId);
  if (!cur) return res.status(404).json({ error: "not_found" });
  const imageRows = db.prepare("SELECT filename FROM monster_images WHERE monster_id=?").all(cur.id);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM monster_images WHERE monster_id=?").run(cur.id);
    db.prepare("DELETE FROM monsters WHERE id=? AND party_id=?").run(cur.id, partyId);
  });
  tx();

  for (const row of imageRows) {
    const filename = row?.filename;
    if (!filename) continue;
    const paths = [path.join(BESTIARY_DIR, filename), path.join(MONSTERS_DIR, filename)];
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // best-effort
      }
    }
  }
  logEvent({
    partyId,
    type: "bestiary.deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: Number(id),
    message: `Удалён монстр: ${cur?.name || id}`,
    io: req.app.locals.io
  });
  req.app.locals.io?.emit("bestiary:updated");
  res.json({ ok: true });
});

bestiaryRouter.post("/settings/toggle", dmAuthMiddleware, (req, res) => {
  const enabled = !!req.body?.enabled;
  setPartySettings(getParty().id, { bestiary_enabled: enabled ? 1 : 0 });
  req.app.locals.io?.emit("settings:updated");
  res.json({ ok: true });
});
