import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { dmAuthMiddleware, getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb, getPartySettings, setPartySettings, getParty } from "../db.js";
import { now, jsonParse, wrapMulter } from "../util.js";
import { logEvent } from "../events.js";
import { uploadsDir } from "../paths.js";

export const bestiaryRouter = express.Router();

const MONSTERS_DIR = path.join(uploadsDir, "monsters");
const BESTIARY_DIR = path.join(uploadsDir, "bestiary");
fs.mkdirSync(MONSTERS_DIR, { recursive: true });
fs.mkdirSync(BESTIARY_DIR, { recursive: true });

const UPLOAD_DIR = MONSTERS_DIR;

function imageUrl(filename) {
  const bestiaryPath = path.join(BESTIARY_DIR, filename);
  if (fs.existsSync(bestiaryPath)) return `/uploads/bestiary/${filename}`;
  return `/uploads/monsters/${filename}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.originalname}`.replace(/[^\w.\-]/g, "_");
    cb(null, safe);
  }
});
const BESTIARY_IMAGE_MAX_BYTES = Number(process.env.BESTIARY_IMAGE_MAX_BYTES || 5 * 1024 * 1024);
const BESTIARY_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
function isAllowedBestiaryImage(mime) {
  return BESTIARY_IMAGE_MIMES.has(String(mime || "").toLowerCase());
}
const upload = multer({
  storage,
  limits: { fileSize: BESTIARY_IMAGE_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!isAllowedBestiaryImage(file.mimetype)) {
      req.fileValidationError = "unsupported_file_type";
      return cb(null, false);
    }
    cb(null, true);
  }
});

function authPlayer(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), now());
  if (!sess) return null;
  return sess;
}

function isDmRequest(req) {
  const token = req.cookies?.[getDmCookieName()];
  if (!token) return false;
  try {
    verifyDmToken(token);
    return true;
  } catch {
    return false;
  }
}

bestiaryRouter.get("/", (req, res) => {
  const db = getDb();
  const party = getParty();
  const settings = getPartySettings(party.id);
  const isDm = isDmRequest(req);
  const sess = authPlayer(req);

  if (!isDm && !settings.bestiary_enabled) return res.json({ enabled: false, items: [] });

  const monsters = db.prepare("SELECT * FROM monsters ORDER BY name").all();
  const monsterIds = monsters.map((m) => m.id);
  const imagesByMonster = new Map();

  if (monsterIds.length) {
    const placeholders = monsterIds.map(() => "?").join(",");
    const imageRows = db.prepare(
      `SELECT id, monster_id, filename FROM monster_images WHERE monster_id IN (${placeholders}) ORDER BY id`
    ).all(...monsterIds);
    for (const im of imageRows) {
      const list = imagesByMonster.get(im.monster_id) || [];
      list.push({ id: im.id, url: imageUrl(im.filename) });
      imagesByMonster.set(im.monster_id, list);
    }
  }

  const rows = monsters.map((m) => ({
    ...m,
    stats: jsonParse(m.stats, {}),
    abilities: jsonParse(m.abilities, []),
    images: imagesByMonster.get(m.id) || []
  }));

  // players: hide hidden monsters (optional)
  const filtered = (isDm) ? rows : rows.filter((m) => !m.is_hidden);
  res.json({ enabled: !!settings.bestiary_enabled, items: filtered });
});

bestiaryRouter.post("/", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ error: "name_required" });
  const t = now();
  const id = db.prepare(
    "INSERT INTO monsters(name, type, habitat, cr, stats, abilities, description, is_hidden, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(
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
    partyId: getParty().id,
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
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT * FROM monsters WHERE id=?").get(id);
  if (!cur) return res.status(404).json({ error: "not_found" });

  const b = req.body || {};
  const name = String(b.name ?? cur.name).trim();
  if (!name) return res.status(400).json({ error: "name_required" });

  db.prepare(
    "UPDATE monsters SET name=?, type=?, habitat=?, cr=?, stats=?, abilities=?, description=?, is_hidden=?, updated_at=? WHERE id=?"
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
    id
  );

  logEvent({
    partyId: getParty().id,
    type: "bestiary.updated",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: Number(id),
    message: `Изменён монстр: ${name}`,
    io: req.app.locals.io
  });

  req.app.locals.io?.emit("bestiary:updated");
  res.json({ ok: true });
});

bestiaryRouter.delete("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT name FROM monsters WHERE id=?").get(id);
  db.prepare("DELETE FROM monsters WHERE id=?").run(id);
  logEvent({
    partyId: getParty().id,
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

bestiaryRouter.post("/:id/image", dmAuthMiddleware, wrapMulter(upload.single("image")), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT * FROM monsters WHERE id=?").get(id);
  if (!cur) return res.status(404).json({ error: "not_found" });
  if (req.fileValidationError) return res.status(415).json({ error: req.fileValidationError });
  if (!req.file) return res.status(400).json({ error: "file_required" });

  db.prepare("INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)")
    .run(id, req.file.filename, req.file.originalname, req.file.mimetype, now());

  req.app.locals.io?.emit("bestiary:updated");
  res.json({ ok: true, url: `/uploads/monsters/${req.file.filename}` });
});

bestiaryRouter.post("/settings/toggle", dmAuthMiddleware, (req, res) => {
  const enabled = !!req.body?.enabled;
  setPartySettings(getParty().id, { bestiary_enabled: enabled ? 1 : 0 });
  req.app.locals.io?.emit("settings:updated");
  res.json({ ok: true });
});
