-- Initial schema for Slack-like channels

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT DEFAULT 'system',
  description TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp
  ON messages(channel_id, timestamp);

-- Seed default channels
INSERT OR IGNORE INTO channels (id, name, created_at, description) VALUES
  ('ch_general', 'general', datetime('now'), 'General discussion'),
  ('ch_public', 'public', datetime('now'), 'Public announcements'),
  ('dm_cohere', 'dm_cohere', datetime('now'), 'Direct messages with Cohere AI');
