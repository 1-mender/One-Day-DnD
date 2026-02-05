import fs from "node:fs";
import path from "node:path";
import { getDb, DATA_DIR } from "./db.js";
import { ensureDir, now } from "./util.js";

const BACKUP_EVERY_MS = Number(process.env.BACKUP_EVERY_MS || 10 * 60 * 1000);
const BACKUP_RETAIN = Number(process.env.BACKUP_RETAIN || 20);
const BACKUP_DIR = process.env.DND_LAN_BACKUP_DIR
  ? path.resolve(process.env.DND_LAN_BACKUP_DIR)
  : path.join(DATA_DIR, "backups");

let backupInterval = null;
let backupInProgress = false;

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const entries = fs.readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("app-") && name.endsWith(".db"))
    .map((name) => {
      const full = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(full);
      return { name, full, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries;
}

function pruneBackups() {
  if (!BACKUP_RETAIN || BACKUP_RETAIN <= 0) return;
  const entries = listBackups();
  const toDelete = entries.slice(BACKUP_RETAIN);
  for (const b of toDelete) {
    try {
      fs.rmSync(b.full, { force: true });
    } catch (e) {
      console.error("backup prune failed:", b.full, e);
    }
  }
}

export async function runBackup(reason = "manual") {
  if (backupInProgress) return { ok: false, skipped: true };
  backupInProgress = true;
  try {
    ensureDir(BACKUP_DIR);
    const t = now();
    const filename = `app-${t}.db`;
    const dest = path.join(BACKUP_DIR, filename);
    const db = getDb();
    await db.backup(dest);
    pruneBackups();
    console.log(`backup ok (${reason}): ${dest}`);
    return { ok: true, path: dest };
  } catch (e) {
    console.error(`backup failed (${reason}):`, e);
    return { ok: false, error: String(e?.message || e) };
  } finally {
    backupInProgress = false;
  }
}

export function startAutoBackups() {
  if (backupInterval || BACKUP_EVERY_MS <= 0) return backupInterval;
  ensureDir(BACKUP_DIR);
  backupInterval = setInterval(() => {
    runBackup("interval");
  }, BACKUP_EVERY_MS);
  return backupInterval;
}

export function stopAutoBackups() {
  if (!backupInterval) return;
  clearInterval(backupInterval);
  backupInterval = null;
}
