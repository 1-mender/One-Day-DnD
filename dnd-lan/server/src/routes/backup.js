import express from "express";
import path from "node:path";
import fs from "node:fs";
import archiver from "archiver";
import unzipper from "unzipper";
import multer from "multer";
import { pipeline } from "node:stream/promises";
import { dmAuthMiddleware } from "../auth.js";
import { closeDb, reloadDb, DATA_DIR, DB_PATH } from "../db.js";
import { asyncHandler, wrapMulter } from "../util.js";
import { uploadsDir } from "../paths.js";

export const backupRouter = express.Router();

const MAX_BACKUP_BYTES = Number(process.env.BACKUP_IMPORT_MAX_BYTES || 200 * 1024 * 1024);
const MAX_BACKUP_EXTRACT_BYTES = Number(process.env.BACKUP_IMPORT_MAX_EXTRACT_BYTES || 500 * 1024 * 1024);
const upload = multer({ dest: path.join(DATA_DIR, "tmp"), limits: { fileSize: MAX_BACKUP_BYTES } });

async function safeExtractZip(zipPath, destDir) {
  const base = path.resolve(destDir);
  const directory = await unzipper.Open.file(zipPath);
  let total = 0;
  for (const entry of directory.files) {
    const rel = String(entry.path || "").replace(/\\/g, "/");
    if (!rel || rel.startsWith("/") || rel.includes("..")) {
      entry.autodrain();
      continue;
    }
    const entrySize = Number(entry.uncompressedSize || 0);
    if (Number.isFinite(entrySize)) {
      if (entrySize > MAX_BACKUP_EXTRACT_BYTES) {
        entry.autodrain();
        throw new Error("backup_too_large");
      }
      total += entrySize;
      if (total > MAX_BACKUP_EXTRACT_BYTES) {
        entry.autodrain();
        throw new Error("backup_too_large");
      }
    }
    const target = path.resolve(base, rel);
    if (!target.startsWith(base + path.sep)) {
      entry.autodrain();
      continue;
    }
    if (entry.type === "Directory") {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await pipeline(entry.stream(), fs.createWriteStream(target));
  }
}

backupRouter.get("/export", dmAuthMiddleware, (req, res) => {
  const dbPath = DB_PATH;
  const uploadsPath = uploadsDir;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=\"dnd-lan-backup.zip\"");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).end(String(err)));
  archive.pipe(res);

  if (fs.existsSync(dbPath)) archive.file(dbPath, { name: "app.db" });
  if (fs.existsSync(uploadsPath)) archive.directory(uploadsPath, "uploads");

  archive.finalize();
});

backupRouter.post("/import", dmAuthMiddleware, wrapMulter(upload.single("zip")), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file_required" });

  const tmpDir = path.join(DATA_DIR, "import_tmp");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    await safeExtractZip(req.file.path, tmpDir);

    const srcDb = path.join(tmpDir, "app.db");
    const srcUploads = path.join(tmpDir, "uploads");

    if (!fs.existsSync(srcDb)) return res.status(400).json({ error: "invalid_backup_no_db" });

    const dstDb = DB_PATH;
    const dstUploads = uploadsDir;
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // close DB before replace
    closeDb();

    // backup old
    if (fs.existsSync(dstDb)) fs.copyFileSync(dstDb, dstDb + ".bak");
    fs.copyFileSync(srcDb, dstDb);

    // replace uploads
    fs.rmSync(dstUploads, { recursive: true, force: true });
    if (fs.existsSync(srcUploads)) {
      fs.cpSync(srcUploads, dstUploads, { recursive: true });
    } else {
      fs.mkdirSync(dstUploads, { recursive: true });
    }

    // reload db
    reloadDb();

    req.app.locals.io?.emit("settings:updated");
    req.app.locals.io?.emit("players:updated");
    req.app.locals.io?.emit("inventory:updated");
    req.app.locals.io?.emit("bestiary:updated");
    req.app.locals.io?.emit("infoBlocks:updated");

    res.json({ ok: true });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg === "backup_too_large") {
      return res.status(413).json({ error: "backup_too_large" });
    }
    res.status(500).json({ error: "import_failed", details: msg });
  } finally {
    fs.rmSync(req.file.path, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}));
