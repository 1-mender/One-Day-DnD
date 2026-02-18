import fs from "node:fs";
import path from "node:path";

function tableColumns(database, tableName) {
  return database.prepare(`PRAGMA table_info(${tableName})`).all().map((c) => c.name);
}

function hasTable(database, tableName) {
  return !!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
}

function addColumnIfMissing(database, tableName, columnName, sql) {
  const cols = tableColumns(database, tableName);
  if (!cols.length || cols.includes(columnName)) return;
  database.exec(sql);
}

const MIGRATIONS = [
  {
    version: 1,
    name: "users_token_version",
    up(database) {
      addColumnIfMissing(database, "users", "token_version", "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;");
    }
  },
  {
    version: 2,
    name: "sessions_impersonation_flags",
    up(database) {
      addColumnIfMissing(database, "sessions", "impersonated", "ALTER TABLE sessions ADD COLUMN impersonated INTEGER NOT NULL DEFAULT 0;");
      addColumnIfMissing(database, "sessions", "impersonated_write", "ALTER TABLE sessions ADD COLUMN impersonated_write INTEGER NOT NULL DEFAULT 0;");
    }
  },
  {
    version: 3,
    name: "profile_change_requests_reason_dm_note",
    up(database) {
      addColumnIfMissing(database, "profile_change_requests", "reason", "ALTER TABLE profile_change_requests ADD COLUMN reason TEXT;");
      addColumnIfMissing(database, "profile_change_requests", "dm_note", "ALTER TABLE profile_change_requests ADD COLUMN dm_note TEXT;");
    }
  },
  {
    version: 4,
    name: "inventory_items_image_and_reserved_qty",
    up(database) {
      addColumnIfMissing(database, "inventory_items", "image_url", "ALTER TABLE inventory_items ADD COLUMN image_url TEXT;");
      addColumnIfMissing(database, "inventory_items", "reserved_qty", "ALTER TABLE inventory_items ADD COLUMN reserved_qty INTEGER NOT NULL DEFAULT 0;");
    }
  },
  {
    version: 5,
    name: "party_settings_tickets_and_presets",
    up(database) {
      addColumnIfMissing(database, "party_settings", "tickets_enabled", "ALTER TABLE party_settings ADD COLUMN tickets_enabled INTEGER NOT NULL DEFAULT 1;");
      addColumnIfMissing(database, "party_settings", "tickets_rules", "ALTER TABLE party_settings ADD COLUMN tickets_rules TEXT NOT NULL DEFAULT '{}';");
      addColumnIfMissing(database, "party_settings", "profile_presets", "ALTER TABLE party_settings ADD COLUMN profile_presets TEXT NOT NULL DEFAULT '[]';");
      addColumnIfMissing(database, "party_settings", "profile_presets_access", "ALTER TABLE party_settings ADD COLUMN profile_presets_access TEXT NOT NULL DEFAULT '{}';");
    }
  },
  {
    version: 6,
    name: "ticket_quests_table",
    up(database) {
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
    }
  },
  {
    version: 7,
    name: "item_transfers_table",
    up(database) {
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
    }
  },
  {
    version: 8,
    name: "arcade_tables",
    up(database) {
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
      database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_matches_party_created ON arcade_matches(party_id, created_at DESC);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_matches_status ON arcade_matches(status, created_at DESC);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_queue_party_status_game_mode ON arcade_match_queue(party_id, status, game_key, mode_key, joined_at);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_queue_player_status ON arcade_match_queue(player_id, status, joined_at DESC);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_queue_expires ON arcade_match_queue(expires_at);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_arcade_match_players_player ON arcade_match_players(player_id, match_id DESC);");
    }
  },
  {
    version: 9,
    name: "arcade_columns_metadata_and_rematch",
    up(database) {
      addColumnIfMissing(database, "arcade_match_queue", "rematch_target_player_id", "ALTER TABLE arcade_match_queue ADD COLUMN rematch_target_player_id INTEGER;");
      addColumnIfMissing(database, "arcade_match_queue", "rematch_of_match_id", "ALTER TABLE arcade_match_queue ADD COLUMN rematch_of_match_id INTEGER;");
      addColumnIfMissing(database, "arcade_matches", "metadata", "ALTER TABLE arcade_matches ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';");
    }
  },
  {
    version: 10,
    name: "legacy_indexes",
    up(database) {
      database.exec("CREATE INDEX IF NOT EXISTS idx_monster_images_monster ON monster_images(monster_id);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_monsters_name_id ON monsters(name COLLATE NOCASE, id);");
      database.exec("CREATE INDEX IF NOT EXISTS idx_monsters_hidden_name_id ON monsters(is_hidden, name COLLATE NOCASE, id);");
    }
  }
];

function ensureMigrationTable(database) {
  database.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations(
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );`
  );
}

function createMigrationBackup(dbPath, dataDir) {
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  const backupDir = path.join(dataDir, "backups", "migrations");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = Date.now();
  const backupPath = path.join(backupDir, `app.db.pre-migrate.${stamp}.bak`);
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

export function runMigrations(database, { dbPath, dataDir, logger } = {}) {
  ensureMigrationTable(database);
  const applied = new Set(
    database.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((row) => Number(row.version))
  );
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version)).sort((a, b) => a.version - b.version);
  if (!pending.length) return { appliedCount: 0, backupPath: null };

  const backupPath = createMigrationBackup(dbPath, dataDir);
  for (const migration of pending) {
    const tx = database.transaction(() => {
      migration.up(database);
      database
        .prepare("INSERT INTO schema_migrations(version, name, applied_at) VALUES(?,?,?)")
        .run(migration.version, migration.name, Date.now());
    });
    tx();
    logger?.info?.({ version: migration.version, name: migration.name }, "migration applied");
  }
  if (backupPath) {
    logger?.info?.({ backupPath }, "migration backup created");
  }
  return { appliedCount: pending.length, backupPath };
}

export function hasMigrationVersion(database, version) {
  if (!hasTable(database, "schema_migrations")) return false;
  const row = database.prepare("SELECT version FROM schema_migrations WHERE version=?").get(version);
  return !!row;
}
