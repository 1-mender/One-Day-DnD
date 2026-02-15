PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
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
  tickets_enabled INTEGER NOT NULL DEFAULT 1,
  tickets_rules TEXT NOT NULL DEFAULT '{}',
  profile_presets TEXT NOT NULL DEFAULT '[]',
  profile_presets_access TEXT NOT NULL DEFAULT '{}',
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
  image_url TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS item_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_player_id INTEGER NOT NULL,
  to_player_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/accepted/rejected/canceled/expired
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  note TEXT,
  FOREIGN KEY(from_player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(to_player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tickets (
  player_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  daily_earned INTEGER NOT NULL DEFAULT 0,
  daily_spent INTEGER NOT NULL DEFAULT 0,
  day_key INTEGER NOT NULL DEFAULT 0,
  last_played_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  outcome TEXT NOT NULL,
  entry_cost INTEGER NOT NULL DEFAULT 0,
  reward INTEGER NOT NULL DEFAULT 0,
  penalty INTEGER NOT NULL DEFAULT 0,
  multiplier REAL NOT NULL DEFAULT 1,
  streak_after INTEGER NOT NULL DEFAULT 0,
  day_key INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  quest_key TEXT NOT NULL,
  day_key INTEGER NOT NULL,
  reward_granted INTEGER NOT NULL DEFAULT 0,
  rewarded_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, quest_key, day_key),
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  cost INTEGER NOT NULL DEFAULT 0,
  day_key INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS arcade_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  mode_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'found', -- found/active/completed/canceled
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
);

CREATE TABLE IF NOT EXISTS arcade_match_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  game_key TEXT NOT NULL,
  mode_key TEXT NOT NULL DEFAULT '',
  skill_band TEXT,
  rematch_target_player_id INTEGER,
  rematch_of_match_id INTEGER,
  status TEXT NOT NULL DEFAULT 'queued', -- queued/matched/canceled/expired
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
);

CREATE TABLE IF NOT EXISTS arcade_match_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  queue_id INTEGER,
  joined_at INTEGER NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending', -- pending/win/loss/draw
  is_winner INTEGER NOT NULL DEFAULT 0,
  UNIQUE(match_id, player_id),
  FOREIGN KEY(match_id) REFERENCES arcade_matches(id) ON DELETE CASCADE,
  FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY(queue_id) REFERENCES arcade_match_queue(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_players_party ON players(party_id);
CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory_items(player_id);
CREATE INDEX IF NOT EXISTS idx_transfers_inbox ON item_transfers(to_player_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_expires ON item_transfers(expires_at);
CREATE INDEX IF NOT EXISTS idx_monsters_name ON monsters(name);
CREATE INDEX IF NOT EXISTS idx_monsters_name_id ON monsters(name COLLATE NOCASE, id);
CREATE INDEX IF NOT EXISTS idx_monsters_hidden_name_id ON monsters(is_hidden, name COLLATE NOCASE, id);
CREATE INDEX IF NOT EXISTS idx_monster_images_monster ON monster_images(monster_id);
CREATE INDEX IF NOT EXISTS idx_info_blocks_title ON info_blocks(title);
CREATE INDEX IF NOT EXISTS idx_events_party_created ON events(party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_player ON character_profiles(player_id);
CREATE INDEX IF NOT EXISTS idx_profile_requests_status ON profile_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_profile_requests_player ON profile_change_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_tickets_player ON tickets(player_id);
CREATE INDEX IF NOT EXISTS idx_ticket_plays_player_day ON ticket_plays(player_id, day_key);
CREATE INDEX IF NOT EXISTS idx_ticket_purchases_player_day ON ticket_purchases(player_id, day_key);
CREATE INDEX IF NOT EXISTS idx_ticket_quests_player_day ON ticket_quests(player_id, day_key);
CREATE INDEX IF NOT EXISTS idx_arcade_matches_party_created ON arcade_matches(party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_matches_status ON arcade_matches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_queue_party_status_game_mode ON arcade_match_queue(party_id, status, game_key, mode_key, joined_at);
CREATE INDEX IF NOT EXISTS idx_arcade_queue_player_status ON arcade_match_queue(player_id, status, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_arcade_queue_expires ON arcade_match_queue(expires_at);
CREATE INDEX IF NOT EXISTS idx_arcade_match_players_player ON arcade_match_players(player_id, match_id DESC);
