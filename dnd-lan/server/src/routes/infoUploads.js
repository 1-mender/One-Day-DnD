import express from "express";
import path from "node:path";
import multer from "multer";
import { dmAuthMiddleware } from "../auth.js";
import { randId } from "../util.js";

export const infoUploadsRouter = express.Router();

const UPLOAD_DIR = path.resolve("server", "uploads", "assets");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").slice(0, 12) || "";
    cb(null, `a_${Date.now()}_${randId(10)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

function isImage(mime) {
  return String(mime || "").toLowerCase().startsWith("image/");
}

infoUploadsRouter.post("/upload", dmAuthMiddleware, upload.single("file"), (req, res) => {
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
