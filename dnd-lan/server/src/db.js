import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { ensureDir, now, jsonParse } from "./util.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const DATA_DIR = process.env.DND_LAN_DATA_DIR
  ? path.resolve(process.env.DND_LAN_DATA_DIR)
  : (process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "dnd-lan")
    : path.join(repoRoot, "server", "data"));
const DB_PATH = path.join(DATA_DIR, "app.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

let db;

export { DATA_DIR, DB_PATH };

export function getDb() {
  if (!db) initDb();
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function ensureMigrations(database) {
  const cols = database.prepare("PRAGMA table_info(sessions)").all().map((c) => c.name);
  if (!cols.includes("impersonated")) {
    database.exec("ALTER TABLE sessions ADD COLUMN impersonated INTEGER NOT NULL DEFAULT 0;");
  }
  if (!cols.includes("impersonated_write")) {
    database.exec("ALTER TABLE sessions ADD COLUMN impersonated_write INTEGER NOT NULL DEFAULT 0;");
  }

  const reqCols = database.prepare("PRAGMA table_info(profile_change_requests)").all().map((c) => c.name);
  if (reqCols.length) {
    if (!reqCols.includes("reason")) {
      database.exec("ALTER TABLE profile_change_requests ADD COLUMN reason TEXT;");
    }
    if (!reqCols.includes("dm_note")) {
      database.exec("ALTER TABLE profile_change_requests ADD COLUMN dm_note TEXT;");
    }
  }
}

export function initDb() {
  ensureDir(DATA_DIR);
  db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  ensureMigrations(db);

  // bootstrap default party if none
  const partyCount = db.prepare("SELECT COUNT(*) AS c FROM parties").get().c;
  if (partyCount === 0) {
    const t = now();
    const partyId = db.prepare("INSERT INTO parties(name, join_code, created_at) VALUES(?,?,?)")
      .run("Default Party", null, t).lastInsertRowid;
    db.prepare("INSERT INTO party_settings(party_id, bestiary_enabled) VALUES(?,?)")
      .run(partyId, 0);
  }
  return db;
}

export function reloadDb() {
  closeDb();
  initDb();
}

export function dbHasDm() {
  const d = getDb().prepare("SELECT COUNT(*) AS c FROM users").get();
  return d.c > 0;
}

export function getPartyId() {
  return getDb().prepare("SELECT id FROM parties ORDER BY id LIMIT 1").get().id;
}

export function getPartySettings(partyId) {
  const row = getDb().prepare("SELECT * FROM party_settings WHERE party_id=?").get(partyId);
  return row || { party_id: partyId, bestiary_enabled: 0 };
}

export function setPartySettings(partyId, patch) {
  const cur = getPartySettings(partyId);
  const bestiary = patch.bestiary_enabled ?? cur.bestiary_enabled;
  getDb().prepare("INSERT INTO party_settings(party_id, bestiary_enabled) VALUES(?,?) ON CONFLICT(party_id) DO UPDATE SET bestiary_enabled=excluded.bestiary_enabled")
    .run(partyId, bestiary);
}

export function getParty() {
  return getDb().prepare("SELECT * FROM parties ORDER BY id LIMIT 1").get();
}

export function setJoinCode(join_code) {
  const partyId = getPartyId();
  getDb().prepare("UPDATE parties SET join_code=? WHERE id=?").run(join_code || null, partyId);
}

export function parseJsonArray(s) {
  return jsonParse(s, []);
}
