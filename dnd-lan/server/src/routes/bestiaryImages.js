import express from "express";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import multer from "multer";
import { dmAuthMiddleware } from "../auth.js";
import { getDb, getSinglePartyId } from "../db.js";
import { asyncHandler, now, randId, wrapMulter } from "../util.js";
import { logEvent } from "../events.js";
import { uploadsDir } from "../paths.js";
import { DANGEROUS_UPLOAD_MIMES, finalizeUploadedFile, safeUnlink } from "../uploadSecurity.js";

export const bestiaryImagesRouter = express.Router();

const UPLOAD_DIR = path.join(uploadsDir, "bestiary");
const THUMB_DIR = path.join(UPLOAD_DIR, "thumbs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });
const MAX_IMAGES_PER_MONSTER = Number(process.env.BESTIARY_IMAGE_MAX_COUNT || 20);
const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, _file, cb) => {
    const mid = String(req.params.monsterId || "0");
    cb(null, `m${mid}_${Date.now()}_${randId(8)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

async function handleUpload(req, res) {
  const db = getDb();
  const partyId = getSinglePartyId();
  const f = req.file;
  const monsterId = Number(req.params.monsterId);
  if (!monsterId) {
    safeUnlink(f?.path);
    return res.status(400).json({ error: "invalid_monsterId" });
  }

  const monster = db.prepare("SELECT id FROM monsters WHERE id=? AND party_id=?").get(monsterId, partyId);
  if (!monster) {
    safeUnlink(f?.path);
    return res.status(404).json({ error: "monster_not_found" });
  }
  if (MAX_IMAGES_PER_MONSTER > 0) {
    const cnt = db.prepare("SELECT COUNT(*) AS c FROM monster_images WHERE monster_id=?").get(monsterId)?.c || 0;
    if (cnt >= MAX_IMAGES_PER_MONSTER) {
      safeUnlink(f?.path);
      return res.status(409).json({ error: "image_limit_reached", limit: MAX_IMAGES_PER_MONSTER });
    }
  }

  if (!f) return res.status(400).json({ error: "file_required" });

  const clientClaimedMime = String(f.mimetype || "").toLowerCase();
  if (DANGEROUS_UPLOAD_MIMES.has(clientClaimedMime)) {
    safeUnlink(f.path);
    return res.status(415).json({ error: "unsupported_file_type" });
  }

  const normalized = await finalizeUploadedFile(f, {
    allowText: false,
    allowedMimes: ALLOWED_IMAGE_MIMES
  });
  if (!normalized.ok) {
    const status = normalized.error === "upload_failed" ? 400 : 415;
    return res.status(status).json({ error: normalized.error });
  }

  const t = now();
  const imageId = db
    .prepare("INSERT INTO monster_images(monster_id, filename, original_name, mime, created_at) VALUES(?,?,?,?,?)")
    .run(monsterId, normalized.filename, f.originalname || "", normalized.mime, t).lastInsertRowid;

  const image = {
    id: imageId,
    monsterId,
    url: `/uploads/bestiary/${normalized.filename}`,
    thumbUrl: null,
    originalName: f.originalname || "",
    mime: normalized.mime,
    createdAt: t
  };

  // Generate thumbnail (best-effort). Name: <filename>.thumb.webp
  try {
    const thumbName = `${normalized.filename}.thumb.webp`;
    const thumbPath = path.join(THUMB_DIR, thumbName);
    await sharp(path.join(UPLOAD_DIR, normalized.filename))
      .resize({ width: 320, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(thumbPath);
    image.thumbUrl = `/uploads/bestiary/thumbs/${thumbName}`;
  } catch (err) {
    // ignore thumbnail errors
  }

  logEvent({
    partyId,
    type: "bestiary.image_added",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: monsterId,
    message: `Bestiary image added for monster #${monsterId}`,
    data: { imageId: image.id, filename: normalized.filename },
    io: req.app.locals.io
  });

  req.app.locals.io?.to("dm").emit("bestiary:updated", { monsterId, images: true });

  res.json({ ok: true, image });
}

bestiaryImagesRouter.get("/:monsterId/images", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const monsterId = Number(req.params.monsterId);
  if (!monsterId) return res.status(400).json({ error: "invalid_monsterId" });
  const monster = db.prepare("SELECT id FROM monsters WHERE id=? AND party_id=?").get(monsterId, partyId);
  if (!monster) return res.status(404).json({ error: "monster_not_found" });

  const rows = db
    .prepare("SELECT id, monster_id, filename, original_name, mime, created_at FROM monster_images WHERE monster_id=? ORDER BY id DESC")
    .all(monsterId)
    .map((r) => ({
      id: r.id,
      monsterId: r.monster_id,
      url: `/uploads/bestiary/${r.filename}`,
      thumbUrl: fs.existsSync(path.join(THUMB_DIR, `${r.filename}.thumb.webp`))
        ? `/uploads/bestiary/thumbs/${r.filename}.thumb.webp`
        : null,
      originalName: r.original_name,
      mime: r.mime,
      createdAt: r.created_at
    }));

  res.json({ items: rows });
});

// DM batch images by monster ids: GET /api/bestiary/dm/images?ids=1,2,3&limitPer=1
bestiaryImagesRouter.get("/dm/images", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const idsParam = String(req.query.ids || "").trim();
  if (!idsParam) return res.status(400).json({ error: "ids_required" });
  const ids = idsParam.split(",").map((s) => Number(s)).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: "ids_required" });

  const limitPer = Number(req.query.limitPer || 0) || 0;

  // validate that monsters belong to party
  const placeholders = ids.map(() => "?").join(",");
  const monsters = db.prepare(`SELECT id FROM monsters WHERE id IN (${placeholders}) AND party_id=?`).all(...ids, partyId).map((m) => m.id);
  if (!monsters.length) return res.json({ items: {} });

  // fetch images; order by monster_id, id DESC so we can slice per monster if needed
  const rows = db.prepare(
    `SELECT id, monster_id, filename, original_name, mime, created_at FROM monster_images WHERE monster_id IN (${placeholders}) ORDER BY monster_id, id DESC`
  ).all(...ids);

  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.monster_id]) grouped[r.monster_id] = [];
    grouped[r.monster_id].push({
      id: r.id,
      monsterId: r.monster_id,
      url: `/uploads/bestiary/${r.filename}`,
      thumbUrl: fs.existsSync(path.join(THUMB_DIR, `${r.filename}.thumb.webp`))
        ? `/uploads/bestiary/thumbs/${r.filename}.thumb.webp`
        : null,
      originalName: r.original_name,
      mime: r.mime,
      createdAt: r.created_at
    });
  }

  if (limitPer > 0) {
    for (const k of Object.keys(grouped)) {
      grouped[k] = grouped[k].slice(0, limitPer);
    }
  }

  res.json({ items: grouped });
});

bestiaryImagesRouter.post("/:monsterId/images", dmAuthMiddleware, wrapMulter(upload.single("file")), asyncHandler(handleUpload));

// legacy alias: accepts field "image"
bestiaryImagesRouter.post("/:monsterId/image", dmAuthMiddleware, wrapMulter(upload.single("image")), asyncHandler(handleUpload));

bestiaryImagesRouter.delete("/images/:imageId", dmAuthMiddleware, (req, res) => {
  const db = getDb();
  const partyId = getSinglePartyId();
  const imageId = Number(req.params.imageId);
  if (!imageId) return res.status(400).json({ error: "invalid_imageId" });

  const row = db.prepare(
    `SELECT mi.id, mi.monster_id, mi.filename
       FROM monster_images mi
       JOIN monsters m ON m.id=mi.monster_id
      WHERE mi.id=? AND m.party_id=?`
  ).get(imageId, partyId);
  if (!row) return res.status(404).json({ error: "not_found" });

  const paths = [
    path.join(UPLOAD_DIR, row.filename),
    path.join(uploadsDir, "monsters", row.filename)
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // best-effort
    }
  }

  db.prepare("DELETE FROM monster_images WHERE id=?").run(imageId);
  logEvent({
    partyId,
    type: "bestiary.image_deleted",
    actorRole: "dm",
    actorName: "DM",
    targetType: "monster",
    targetId: row.monster_id,
    message: `Bestiary image deleted for monster #${row.monster_id}`,
    data: { imageId, filename: row.filename },
    io: req.app.locals.io
  });
  req.app.locals.io?.to("dm").emit("bestiary:updated", { monsterId: row.monster_id, images: true });

  res.json({ ok: true });
});
