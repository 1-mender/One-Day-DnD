import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { ensureDir, now, jsonParse } from "./util.js";
import { logger } from "./logger.js";
import { runMigrations } from "./migrations.js";

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

export function initDb() {
  ensureDir(DATA_DIR);
  db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(schema);
  runMigrations(db, { dbPath: DB_PATH, dataDir: DATA_DIR, logger });

  // bootstrap default party if none
  const partyCount = db.prepare("SELECT COUNT(*) AS c FROM parties").get().c;
  if (partyCount === 0) {
    const t = now();
    const partyId = db.prepare("INSERT INTO parties(name, join_code, created_at) VALUES(?,?,?)")
      .run("Default Party", null, t).lastInsertRowid;
    db.prepare(
      "INSERT INTO party_settings(party_id, bestiary_enabled, tickets_enabled, tickets_rules, profile_presets, profile_presets_access) VALUES(?,?,?,?,?,?)"
    ).run(partyId, 0, 1, "{}", "[]", "{}");
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
  return row || {
    party_id: partyId,
    bestiary_enabled: 0,
    tickets_enabled: 1,
    tickets_rules: "{}",
    profile_presets: "[]",
    profile_presets_access: "{}"
  };
}

export function setPartySettings(partyId, patch) {
  const cur = getPartySettings(partyId);
  const bestiary = patch.bestiary_enabled ?? cur.bestiary_enabled;
  const ticketsEnabled = patch.tickets_enabled ?? cur.tickets_enabled ?? 1;
  const ticketsRules = patch.tickets_rules ?? cur.tickets_rules ?? "{}";
  const profilePresets = patch.profile_presets ?? cur.profile_presets ?? "[]";
  const profilePresetsAccess = patch.profile_presets_access ?? cur.profile_presets_access ?? "{}";
  getDb().prepare(
    `INSERT INTO party_settings(party_id, bestiary_enabled, tickets_enabled, tickets_rules, profile_presets, profile_presets_access)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(party_id) DO UPDATE SET
       bestiary_enabled=excluded.bestiary_enabled,
       tickets_enabled=excluded.tickets_enabled,
       tickets_rules=excluded.tickets_rules,
       profile_presets=excluded.profile_presets,
       profile_presets_access=excluded.profile_presets_access`
  ).run(partyId, bestiary, ticketsEnabled, ticketsRules, profilePresets, profilePresetsAccess);
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
