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

  const invCols = database.prepare("PRAGMA table_info(inventory_items)").all().map((c) => c.name);
  if (invCols.length && !invCols.includes("image_url")) {
    database.exec("ALTER TABLE inventory_items ADD COLUMN image_url TEXT;");
  }
  if (invCols.length && !invCols.includes("reserved_qty")) {
    database.exec("ALTER TABLE inventory_items ADD COLUMN reserved_qty INTEGER NOT NULL DEFAULT 0;");
  }

  const partyCols = database.prepare("PRAGMA table_info(party_settings)").all().map((c) => c.name);
  if (partyCols.length) {
    if (!partyCols.includes("tickets_enabled")) {
      database.exec("ALTER TABLE party_settings ADD COLUMN tickets_enabled INTEGER NOT NULL DEFAULT 1;");
    }
    if (!partyCols.includes("tickets_rules")) {
      database.exec("ALTER TABLE party_settings ADD COLUMN tickets_rules TEXT NOT NULL DEFAULT '{}';");
    }
    if (!partyCols.includes("profile_presets")) {
      database.exec("ALTER TABLE party_settings ADD COLUMN profile_presets TEXT NOT NULL DEFAULT '[]';");
    }
    if (!partyCols.includes("profile_presets_access")) {
      database.exec("ALTER TABLE party_settings ADD COLUMN profile_presets_access TEXT NOT NULL DEFAULT '{}';");
    }
  }

  // indexes for existing DBs
  database.exec("CREATE INDEX IF NOT EXISTS idx_monster_images_monster ON monster_images(monster_id);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_monsters_name_id ON monsters(name COLLATE NOCASE, id);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_monsters_hidden_name_id ON monsters(is_hidden, name COLLATE NOCASE, id);");
  database.exec(
    `CREATE TABLE IF NOT EXISTS ticket_quests(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      quest_key TEXT NOT NULL,
      day_key INTEGER NOT NULL,
      reward_granted INTEGER NOT NULL DEFAULT 0,
      rewarded_at INTEGER,
      created_at INTEGER NOT NULL,
      UNIQUE(player_id, quest_key, day_key),
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );`
  );
  database.exec("CREATE INDEX IF NOT EXISTS idx_ticket_quests_player_day ON ticket_quests(player_id, day_key);");

  database.exec(
    `CREATE TABLE IF NOT EXISTS item_transfers(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_player_id INTEGER NOT NULL,
      to_player_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      note TEXT,
      FOREIGN KEY(from_player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(to_player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );`
  );
  database.exec("CREATE INDEX IF NOT EXISTS idx_transfers_inbox ON item_transfers(to_player_id, status);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_transfers_expires ON item_transfers(expires_at);");

  database.exec(
    `CREATE TABLE IF NOT EXISTS arcade_matches(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL,
      game_key TEXT NOT NULL,
      mode_key TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'found',
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER,
      queue_wait_ms INTEGER,
      duration_ms INTEGER,
      winner_player_id INTEGER,
      loser_player_id INTEGER,
      rematch_of INTEGER,
      metadata TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE,
      FOREIGN KEY(winner_player_id) REFERENCES players(id) ON DELETE SET NULL,
      FOREIGN KEY(loser_player_id) REFERENCES players(id) ON DELETE SET NULL,
      FOREIGN KEY(rematch_of) REFERENCES arcade_matches(id) ON DELETE SET NULL
    );`
  );

  database.exec(
    `CREATE TABLE IF NOT EXISTS arcade_match_queue(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      game_key TEXT NOT NULL,
      mode_key TEXT NOT NULL DEFAULT '',
      skill_band TEXT,
      rematch_target_player_id INTEGER,
      rematch_of_match_id INTEGER,
      status TEXT NOT NULL DEFAULT 'queued',
      joined_at INTEGER NOT NULL,
      matched_at INTEGER,
      canceled_at INTEGER,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      match_id INTEGER,
      FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(rematch_target_player_id) REFERENCES players(id) ON DELETE SET NULL,
      FOREIGN KEY(rematch_of_match_id) REFERENCES arcade_matches(id) ON DELETE SET NULL,
      FOREIGN KEY(match_id) REFERENCES arcade_matches(id) ON DELETE SET NULL
    );`
  );

  database.exec(
    `CREATE TABLE IF NOT EXISTS arcade_match_players(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      queue_id INTEGER,
      joined_at INTEGER NOT NULL,
      result TEXT NOT NULL DEFAULT 'pending',
      is_winner INTEGER NOT NULL DEFAULT 0,
      UNIQUE(match_id, player_id),
      FOREIGN KEY(match_id) REFERENCES arcade_matches(id) ON DELETE CASCADE,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY(queue_id) REFERENCES arcade_match_queue(id) ON DELETE SET NULL
    );`
  );

  const queueCols = database.prepare("PRAGMA table_info(arcade_match_queue)").all().map((c) => c.name);
  if (queueCols.length) {
    if (!queueCols.includes("rematch_target_player_id")) {
      database.exec("ALTER TABLE arcade_match_queue ADD COLUMN rematch_target_player_id INTEGER;");
    }
    if (!queueCols.includes("rematch_of_match_id")) {
      database.exec("ALTER TABLE arcade_match_queue ADD COLUMN rematch_of_match_id INTEGER;");
    }
  }

  const matchCols = database.prepare("PRAGMA table_info(arcade_matches)").all().map((c) => c.name);
  if (matchCols.length && !matchCols.includes("metadata")) {
    database.exec("ALTER TABLE arcade_matches ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';");
  }

  database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_matches_party_created ON arcade_matches(party_id, created_at DESC);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_matches_status ON arcade_matches(status, created_at DESC);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_queue_party_status_game_mode ON arcade_match_queue(party_id, status, game_key, mode_key, joined_at);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_queue_player_status ON arcade_match_queue(player_id, status, joined_at DESC);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_queue_expires ON arcade_match_queue(expires_at);");
  database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_match_players_player ON arcade_match_players(player_id, match_id DESC);");
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
