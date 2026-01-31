import express from "express";
import path from "node:path";
import multer from "multer";
import { getDmCookieName, verifyDmToken } from "../auth.js";
import { getDb } from "../db.js";
import { jsonParse, now, randId, wrapMulter } from "../util.js";
import { uploadsDir } from "../paths.js";

export const infoUploadsRouter = express.Router();

const UPLOAD_DIR = path.join(uploadsDir, "assets");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 12) || "";
    cb(null, `a_${Date.now()}_${randId(10)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (req.isPlayerUpload && !isAllowedPlayerImage(file.mimetype)) {
      req.fileValidationError = "unsupported_file_type";
      return cb(null, false);
    }
    cb(null, true);
  }
});

function isImage(mime) {
  return String(mime || "").toLowerCase().startsWith("image/");
}

const PLAYER_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
function isAllowedPlayerImage(mime) {
  return PLAYER_IMAGE_MIMES.has(String(mime || "").toLowerCase());
}

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
  if (req.fileValidationError) return res.status(415).json({ error: req.fileValidationError });
  const f = req.file;
  if (!f) return res.status(400).json({ error: "file_required" });

  const url = `/uploads/assets/${f.filename}`;
  const safeName = (f.originalname || "file").replaceAll("]", ")");
  const md = isImage(f.mimetype) ? `![](${url})` : `[${safeName}](${url})`;

  res.json({
    ok: true,
    url,
    markdown: md,
    originalName: f.originalname || "",
    mime: f.mimetype || ""
  });
});
