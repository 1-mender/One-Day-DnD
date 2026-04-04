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

function buildSinglePartyError(count) {
  const err = new Error(count > 1 ? "multiple_parties_not_supported" : "single_party_missing");
  err.code = count > 1 ? "multiple_parties_not_supported" : "single_party_missing";
  err.partyCount = count;
  return err;
}

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
  const nextDb = new Database(DB_PATH);
  try {
    nextDb.pragma("foreign_keys = ON");
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    nextDb.exec(schema);
    runMigrations(nextDb, { dbPath: DB_PATH, dataDir: DATA_DIR, logger });
    ensureColumnAwareIndexes(nextDb);

    // Bootstrap the only supported party when the database is empty.
    const partyCount = getPartyCount(nextDb);
    if (partyCount === 0) {
      const t = now();
      const partyId = nextDb.prepare("INSERT INTO parties(name, join_code, created_at) VALUES(?,?,?)")
        .run("Default Party", null, t).lastInsertRowid;
      nextDb.prepare(
        "INSERT INTO party_settings(party_id, bestiary_enabled, tickets_enabled, tickets_rules, profile_presets, profile_presets_access) VALUES(?,?,?,?,?,?)"
      ).run(partyId, 0, 1, "{}", "[]", "{}");
    }

    assertSinglePartyInvariant(nextDb);
    db = nextDb;
    return db;
  } catch (error) {
    try {
      nextDb.close();
    } catch {}
    if (db === nextDb) db = null;
    throw error;
  }
}

function hasColumn(database, tableName, columnName) {
  try {
    const rows = database.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some((row) => String(row.name) === String(columnName));
  } catch {
    return false;
  }
}

function ensureColumnAwareIndexes(database) {
  if (
    hasColumn(database, "inventory_items", "inv_container")
    && hasColumn(database, "inventory_items", "slot_x")
    && hasColumn(database, "inventory_items", "slot_y")
  ) {
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_inventory_layout ON inventory_items(player_id, inv_container, slot_y, slot_x);"
    );
  }
  if (hasColumn(database, "monsters", "party_id")) {
    database.exec("CREATE INDEX IF NOT EXISTS idx_monsters_party_name_id ON monsters(party_id, name COLLATE NOCASE, id);");
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_monsters_party_hidden_name_id ON monsters(party_id, is_hidden, name COLLATE NOCASE, id);"
    );
  }
  if (hasColumn(database, "players", "party_id") && hasColumn(database, "players", "banned")) {
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_players_party_banned_id ON players(party_id, banned, id);"
    );
  }
  if (hasColumn(database, "item_transfers", "item_id") && hasColumn(database, "item_transfers", "status")) {
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_transfers_item_status_to_player ON item_transfers(item_id, status, to_player_id);"
    );
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_transfers_outbox_created ON item_transfers(from_player_id, status, created_at DESC, expires_at);"
    );
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_transfers_inbox_created ON item_transfers(to_player_id, status, created_at DESC, expires_at);"
    );
  }
  if (hasColumn(database, "monster_images", "monster_id")) {
    database.exec(
      "CREATE INDEX IF NOT EXISTS idx_monster_images_monster_id_desc ON monster_images(monster_id, id DESC);"
    );
  }
  if (hasColumn(database, "info_blocks", "party_id")) {
    database.exec("CREATE INDEX IF NOT EXISTS idx_info_blocks_party_updated ON info_blocks(party_id, updated_at DESC);");
  }
}

export function reloadDb() {
  closeDb();
  initDb();
}

export function dbHasDm() {
  const d = getDb().prepare("SELECT COUNT(*) AS c FROM users").get();
  return d.c > 0;
}

export function getPartyCount(database = getDb()) {
  return Number(database.prepare("SELECT COUNT(*) AS c FROM parties").get()?.c || 0);
}

export function assertSinglePartyInvariant(database = getDb()) {
  const partyCount = getPartyCount(database);
  if (partyCount !== 1) throw buildSinglePartyError(partyCount);
  return partyCount;
}

export function assertSinglePartyDbFile(dbPath) {
  const fileDb = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    assertSinglePartyInvariant(fileDb);
  } finally {
    fileDb.close();
  }
}

export function getSinglePartyId() {
  assertSinglePartyInvariant();
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

export function getSingleParty() {
  assertSinglePartyInvariant();
  return getDb().prepare("SELECT * FROM parties ORDER BY id LIMIT 1").get();
}

export function setJoinCode(join_code) {
  const partyId = getSinglePartyId();
  getDb().prepare("UPDATE parties SET join_code=? WHERE id=?").run(join_code || null, partyId);
}

export function parseJsonArray(s) {
  return jsonParse(s, []);
}
