PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS parties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  join_code TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS party_settings (
  party_id INTEGER PRIMARY KEY,
  bestiary_enabled INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline', -- online/offline
  last_seen INTEGER NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS banned_ips (
  ip TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS join_requests (
  id TEXT PRIMARY KEY,
  party_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  player_id INTEGER NOT NULL,
  party_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  impersonated INTEGER NOT NULL DEFAULT 0,
  impersonated_write INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  weight REAL NOT NULL DEFAULT 0,
  rarity TEXT NOT NULL DEFAULT 'common',
  tags TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'public', -- public/hidden
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'player', -- player/dm
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monsters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT,
  habitat TEXT,
  cr TEXT,
  stats TEXT NOT NULL DEFAULT '{}',
  abilities TEXT NOT NULL DEFAULT '[]',
  description TEXT,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS monster_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monster_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(monster_id) REFERENCES monsters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS info_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'note', -- lore/quest/note/other
  access TEXT NOT NULL DEFAULT 'dm', -- dm/all/selected
  selected_player_ids TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL,
  type TEXT NOT NULL,                -- например: player.online, join.approved, inventory.updated
  actor_role TEXT NOT NULL,          -- dm | player | system
  actor_player_id INTEGER,           -- если действие от игрока
  actor_name TEXT,                   -- displayName (снимок на момент события)
  target_type TEXT,                  -- player | inventory_item | monster | info_block | join_request | ...
  target_id INTEGER,                 -- id сущности (если есть)
  message TEXT,                      -- человекочитаемо
  data TEXT NOT NULL DEFAULT '{}',   -- JSON строка (счётчики/детали)
  created_at INTEGER NOT NULL,
  FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS character_profiles (
  player_id INTEGER PRIMARY KEY,
  character_name TEXT,
  class_role TEXT,
  level INTEGER,
  stats TEXT NOT NULL DEFAULT '{}',
  bio TEXT,
  avatar_url TEXT,
  editable_fields TEXT NOT NULL DEFAULT '[]',
  allow_requests INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  proposed_changes TEXT NOT NULL DEFAULT '{}',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  dm_note TEXT,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_players_party ON players(party_id);
CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory_items(player_id);
CREATE INDEX IF NOT EXISTS idx_monsters_name ON monsters(name);
CREATE INDEX IF NOT EXISTS idx_info_blocks_title ON info_blocks(title);
CREATE INDEX IF NOT EXISTS idx_events_party_created ON events(party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_player ON character_profiles(player_id);
CREATE INDEX IF NOT EXISTS idx_profile_requests_status ON profile_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_requests_player ON profile_change_requests(player_id);
