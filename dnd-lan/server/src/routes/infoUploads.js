import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb } from "../db.js";
import { jsonParse, now, randId, wrapMulter } from "../util.js";
import { uploadsDir } from "../paths.js";
import {
  DANGEROUS_UPLOAD_MIMES,
  finalizeUploadedFile,
  isImageMime,
  normalizeAllowedMimes
} from "../uploadSecurity.js";

export const infoUploadsRouter = express.Router();

const UPLOAD_DIR = path.join(uploadsDir, "assets");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => {
    cb(null, `a_${Date.now()}_${randId(10)}`);
  }
});

const INFO_UPLOAD_MAX_BYTES = Number(process.env.INFO_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);
const DEFAULT_INFO_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown"
];
const INFO_UPLOAD_ALLOWED_MIMES = normalizeAllowedMimes(
  process.env.INFO_UPLOAD_ALLOWED_MIMES
    ? String(process.env.INFO_UPLOAD_ALLOWED_MIMES).split(",")
    : DEFAULT_INFO_MIMES
);

const upload = multer({
  storage,
  limits: { fileSize: INFO_UPLOAD_MAX_BYTES }
});

const PLAYER_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function getPlayerSession(req) {
  const token = req.header("x-player-token");
  if (!token) return null;
  const db = getDb();
  const sess = db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(String(token), now());
  if (!sess) return null;
  return sess;
}

function dmOrAvatarUpload(req, res, next) {
  const token = req.cookies?.[getDmCookieName()];
  if (token) {
    try {
      verifyDmToken(token);
      req.isPlayerUpload = false;
      return next();
    } catch {
      // fall through to player check
    }
  }

  const sess = getPlayerSession(req);
  if (!sess) return res.status(401).json({ error: "not_authenticated" });
  if (sess.impersonated && !sess.impersonated_write) {
    return res.status(403).json({ error: "read_only_impersonation" });
  }
  const row = getDb().prepare("SELECT editable_fields FROM character_profiles WHERE player_id=?").get(sess.player_id);
  if (!row) return res.status(404).json({ error: "profile_not_created" });
  const parsed = jsonParse(row.editable_fields, []);
  const fields = Array.isArray(parsed) ? parsed : [];
  if (!fields.includes("avatarUrl")) return res.status(403).json({ error: "field_not_allowed" });
  req.isPlayerUpload = true;
  return next();
}

infoUploadsRouter.post("/upload", dmOrAvatarUpload, wrapMulter(upload.single("file")), (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: "file_required" });

  const clientClaimedMime = String(f.mimetype || "").toLowerCase();
  if (DANGEROUS_UPLOAD_MIMES.has(clientClaimedMime)) {
    return res.status(415).json({ error: "unsupported_file_type" });
  }

  const normalized = finalizeUploadedFile(f, {
    allowText: !req.isPlayerUpload,
    allowedMimes: req.isPlayerUpload ? PLAYER_IMAGE_MIMES : INFO_UPLOAD_ALLOWED_MIMES
  });
  if (!normalized.ok) {
    const status = normalized.error === "upload_failed" ? 400 : 415;
    return res.status(status).json({ error: normalized.error });
  }

  const url = `/uploads/assets/${normalized.filename}`;
  const safeName = (f.originalname || "file").replaceAll("]", ")");
  const md = isImageMime(normalized.mime) ? `![](${url})` : `[${safeName}](${url})`;

  res.json({
    ok: true,
    url,
    markdown: md,
    originalName: f.originalname || "",
    mime: normalized.mime
  });
});
