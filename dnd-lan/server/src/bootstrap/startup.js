import { runBackup, startAutoBackups } from "../backup.js";
import { initDb } from "../db.js";
import { ensureUploads } from "../uploads.js";

export function runStartup() {
  initDb();
  ensureUploads();
  runBackup("startup");
  startAutoBackups();
}
