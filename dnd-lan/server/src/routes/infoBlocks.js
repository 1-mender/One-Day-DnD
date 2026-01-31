import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { dmAuthMiddleware, getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now, jsonParse, wrapMulter } from "../util.js";
import { logEvent } from "../events.js";
import { uploadsDir } from "../paths.js";

export const infoBlocksRouter = express.Router();

const ASSETS_DIR = path.join(uploadsDir, "assets");
fs.mkdirSync(ASSETS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ASSETS_DIR),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.originalname}`.replace(/[^\w.\-]/g, "_");
    cb(null, safe);
  }
});
const INFO_ASSET_MAX_BYTES = Number(process.env.INFO_ASSET_MAX_BYTES || 10 * 1024 * 1024);
const upload = multer({ storage, limits: { fileSize: INFO_ASSET_MAX_BYTES } });

function authPlayer(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), now());
  if (!sess) return null;
  const player = db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(sess.player_id);
  if (!player) return null;
  return { sess, player };
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

infoBlocksRouter.get("/", (req, res) => {
  const db = getDb();
  const isDm = isDmRequest(req);
  if (isDm) {
    const items = db.prepare("SELECT * FROM info_blocks ORDER BY updated_at DESC").all().map(mapBlock);
    return res.json({ items });
  }

  const me = authPlayer(req);
  if (!me) return res.status(401).json({ error: "not_authenticated" });

  try {
    const rows = db.prepare(
      `SELECT * FROM info_blocks
       WHERE access='all'
          OR (access='selected' AND EXISTS (
            SELECT 1 FROM json_each(info_blocks.selected_player_ids) WHERE value=?
          ))
       ORDER BY updated_at DESC`
    ).all(me.player.id);
    return res.json({ items: rows.map(mapBlock) });
  } catch {
    const all = db.prepare("SELECT * FROM info_blocks ORDER BY updated_at DESC").all().map(mapBlock);
    const filtered = all.filter((b) => {
      if (b.access === "all") return true;
      if (b.access === "selected") return (b.selectedPlayerIds || []).includes(me.player.id);
      return false;
    });
    return res.json({ items: filtered });
  }
});

infoBlocksRouter.post("/", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const title = String(b.title || "").trim();
  if (!title) return res.status(400).json({ error: "title_required" });

  const t = now();
  const access = ["dm","all","selected"].includes(b.access) ? b.access : "dm";
  const selected = Array.isArray(b.selectedPlayerIds) ? b.selectedPlayerIds.map(Number).filter(Boolean) : [];
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : [];

  const id = db.prepare(
    "INSERT INTO info_blocks(title, content, category, access, selected_player_ids, tags, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?)"
  ).run(
    title,
    String(b.content || ""),
    String(b.category || "note"),
    access,
    JSON.stringify(selected),
    JSON.stringify(tags),
    t, t
  ).lastInsertRowid;

  logEvent({
    partyId: getParty().id,
    type: "info.created",
    actorRole: "dm",
    actorName: "DM",
    targetType: "info_block",
    targetId: Number(id),
    message: `Создан блок: ${title}`,
    io: req.app.locals.io
  });

  req.app.locals.io?.emit("infoBlocks:updated");
  res.json({ ok: true, id });
});

infoBlocksRouter.put("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT * FROM info_blocks WHERE id=?").get(id);
  if (!cur) return res.status(404).json({ error: "not_found" });

  const b = req.body || {};
  const title = String(b.title ?? cur.title).trim();
  if (!title) return res.status(400).json({ error: "title_required" });

  const access = ["dm","all","selected"].includes(b.access ?? cur.access) ? (b.access ?? cur.access) : "dm";
  const selected = Array.isArray(b.selectedPlayerIds) ? b.selectedPlayerIds.map(Number).filter(Boolean) : jsonParse(cur.selected_player_ids, []);
  const tags = Array.isArray(b.tags) ? b.tags.map(String) : jsonParse(cur.tags, []);

  db.prepare(
    "UPDATE info_blocks SET title=?, content=?, category=?, access=?, selected_player_ids=?, tags=?, updated_at=? WHERE id=?"
  ).run(
    title,
    String(b.content ?? cur.content ?? ""),
    String(b.category ?? cur.category ?? "note"),
    access,
    JSON.stringify(selected),
    JSON.stringify(tags),
    now(),
    id
  );

  logEvent({
    partyId: getParty().id,
    type: "info.updated",
    actorRole: "dm",
    actorName: "DM",
    targetType: "info_block",
    targetId: Number(id),
    message: `Изменён блок: ${title}`,
    io: req.app.locals.io
  });

  req.app.locals.io?.emit("infoBlocks:updated");
  res.json({ ok: true });
});

infoBlocksRouter.delete("/:id", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const cur = db.prepare("SELECT title FROM info_blocks WHERE id=?").get(id);
  db.prepare("DELETE FROM info_blocks WHERE id=?").run(id);
  logEvent({
    partyId: getParty().id,
    type: "info.deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "info_block",
    targetId: Number(id),
    message: `Удалён блок: ${cur?.title || id}`,
    io: req.app.locals.io
  });
  req.app.locals.io?.emit("infoBlocks:updated");
  res.json({ ok: true });
});

// upload helper for local images (DM вставляет ссылку в markdown)
infoBlocksRouter.post("/upload", dmAuthMiddleware, wrapMulter(upload.single("file")), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file_required" });
  res.json({ ok: true, url: `/uploads/assets/${req.file.filename}` });
});

function mapBlock(r) {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    access: r.access,
    selectedPlayerIds: jsonParse(r.selected_player_ids, []),
    tags: jsonParse(r.tags, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
