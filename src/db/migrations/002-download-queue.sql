-- Download queue for Pocketz worker
-- This table tracks URLs that need to be downloaded via the local Pocketz worker

CREATE TABLE IF NOT EXISTS download_queue (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  shared_by TEXT NOT NULL,
  shared_by_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, downloading, completed, failed
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  pocketz_directory_name TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);

CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status);
CREATE INDEX IF NOT EXISTS idx_download_queue_created ON download_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_download_queue_channel ON download_queue(channel_id);
