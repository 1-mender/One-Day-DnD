import express from "express";
import path from "node:path";
import fs from "node:fs";
import archiver from "archiver";
import unzipper from "unzipper";
import multer from "multer";
import { dmAuthMiddleware } from "../auth.js";
import { closeDb, reloadDb, DATA_DIR, DB_PATH } from "../db.js";

export const backupRouter = express.Router();

const upload = multer({ dest: path.join(DATA_DIR, "tmp") });

backupRouter.get("/export", dmAuthMiddleware, (req, res) => {
  const dbPath = DB_PATH;
  const uploadsPath = path.resolve("server", "uploads");

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=\"dnd-lan-backup.zip\"");

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).end(String(err)));
  archive.pipe(res);

  if (fs.existsSync(dbPath)) archive.file(dbPath, { name: "app.db" });
  if (fs.existsSync(uploadsPath)) archive.directory(uploadsPath, "uploads");

  archive.finalize();
});

backupRouter.post("/import", dmAuthMiddleware, upload.single("zip"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file_required" });

  const tmpDir = path.join(DATA_DIR, "import_tmp");
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // close DB before replace
    closeDb();

    await fs.createReadStream(req.file.path)
      .pipe(unzipper.Extract({ path: tmpDir }))
      .promise();

    const srcDb = path.join(tmpDir, "app.db");
    const srcUploads = path.join(tmpDir, "uploads");

    if (!fs.existsSync(srcDb)) return res.status(400).json({ error: "invalid_backup_no_db" });

    const dstDb = DB_PATH;
    const dstUploads = path.resolve("server", "uploads");
    fs.mkdirSync(DATA_DIR, { recursive: true });

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
    res.status(500).json({ error: "import_failed", details: String(e) });
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
});
