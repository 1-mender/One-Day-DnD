import express from "express";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getParty } from "../db.js";
import { now, randId } from "../util.js";
import { logEvent } from "../events.js";
import { uploadsDir } from "../paths.js";

export const bestiaryImagesRouter = express.Router();

const UPLOAD_DIR = path.join(uploadsDir, "bestiary");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const mid = String(req.params.monsterId || "0");
    const ext = path.extname(file.originalname || "").slice(0, 12) || "";
    cb(null, `m${mid}_${Date.now()}_${randId(8)}${ext}`);
  }
});

function isAllowedImage(mime) {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(String(mime || "").toLowerCase());
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, isAllowedImage(file.mimetype))
});

bestiaryImagesRouter.get("/:monsterId/images", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const monsterId = Number(req.params.monsterId);
  if (!monsterId) return res.status(400).json({ error: "invalid_monsterId" });

  const rows = db
    .prepare("SELECT id, monster_id, filename, original_name, mime, created_at FROM monster_images WHERE monster_id=? ORDER BY id DESC")
    .all(monsterId)
    .map((r) => ({
      id: r.id,
      monsterId: r.monster_id,
      url: `/uploads/bestiary/${r.filename}`,
      originalName: r.original_name,
      mime: r.mime,
      createdAt: r.created_at
    }));

  res.json({ items: rows });
});

bestiaryImagesRouter.post("/:monsterId/images", dmAuthMiddleware, upload.single("file"), (req, res) => {
  const db = getDb();
  const monsterId = Number(req.params.monsterId);
  if (!monsterId) return res.status(400).json({ error: "invalid_monsterId" });

  const monster = db.prepare("SELECT id FROM monsters WHERE id=?").get(monsterId);
  if (!monster) return res.status(404).json({ error: "monster_not_found" });

  const f = req.file;
  if (!f) return res.status(400).json({ error: "file_required" });
  if (!isAllowedImage(f.mimetype)) return res.status(415).json({ error: "unsupported_file_type" });

  const t = now();
  const imageId = db
    .prepare("INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)")
    .run(monsterId, f.filename, f.originalname || "", f.mimetype || "", t).lastInsertRowid;

  const image = {
    id: imageId,
    monsterId,
    url: `/uploads/bestiary/${f.filename}`,
    originalName: f.originalname || "",
    mime: f.mimetype || "",
    createdAt: t
  };

  logEvent({
    partyId: getParty().id,
    type: "bestiary.image_added",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: monsterId,
    message: `Добавлено изображение монстру: #${monsterId}`,
    data: { imageId: image.id, filename: f.filename },
    io: req.app.locals.io
  });

  req.app.locals.io?.to("dm").emit("bestiary:updated", { monsterId, images: true });

  res.json({ ok: true, image });
});

bestiaryImagesRouter.delete("/images/:imageId", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const imageId = Number(req.params.imageId);
  if (!imageId) return res.status(400).json({ error: "invalid_imageId" });

  const row = db.prepare("SELECT id, monster_id, filename FROM monster_images WHERE id=?").get(imageId);
  if (!row) return res.status(404).json({ error: "not_found" });

  const filePath = path.join(UPLOAD_DIR, row.filename);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }

  db.prepare("DELETE FROM monster_images WHERE id=?").run(imageId);
  logEvent({
    partyId: getParty().id,
    type: "bestiary.image_deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: row.monster_id,
    message: `Удалено изображение монстра: #${row.monster_id}`,
    data: { imageId, filename: row.filename },
    io: req.app.locals.io
  });
  req.app.locals.io?.to("dm").emit("bestiary:updated", { monsterId: row.monster_id, images: true });

  res.json({ ok: true });
});
