/**
 * Discord Sync Database
 * Tracks message forwards to prevent loops
 */
import Database from 'better-sqlite3';
import path from 'path';

export interface MessageForward {
  id: string;
  source_platform: 'discord' | 'comms';
  source_message_id: string;
  source_content_hash: string;
  destination_platform: 'discord' | 'comms';
  destination_message_id: string | null;
  author: string;
  forwarded_at: string;
  duplicate_count: number;
}

export interface MessageStats {
  messageId: string;
  contentHash: string;
  seenCount: number;
  firstSeen: string;
  lastSeen: string;
}

let db: Database.Database | null = null;

/**
 * Initialize Discord sync database
 */
export function initializeDiscordSyncDb(vaultPath: string): Database.Database {
  if (db) return db;

  const dbPath = path.join(vaultPath, '_logs', 'discord-sync.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create message_forwards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_forwards (
      id TEXT PRIMARY KEY,
      source_platform TEXT NOT NULL,
      source_message_id TEXT NOT NULL,
      source_content_hash TEXT NOT NULL,
      destination_platform TEXT NOT NULL,
      destination_message_id TEXT,
      author TEXT NOT NULL,
      forwarded_at TEXT NOT NULL,
      duplicate_count INTEGER DEFAULT 0,
      UNIQUE(source_platform, source_message_id)
    )
  `);

  // Create indexes for fast lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_forwards_source
    ON message_forwards(source_platform, source_message_id);

    CREATE INDEX IF NOT EXISTS idx_forwards_dest
    ON message_forwards(destination_platform, destination_message_id);

    CREATE INDEX IF NOT EXISTS idx_forwards_hash
    ON message_forwards(source_content_hash);

    CREATE INDEX IF NOT EXISTS idx_forwards_time
    ON message_forwards(forwarded_at);
  `);

  // Create recent_messages table (rolling window for fast deduplication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS recent_messages (
      content_hash TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      message_id TEXT NOT NULL,
      author TEXT NOT NULL,
      seen_count INTEGER DEFAULT 1,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    )
  `);

  // Create emergency_stops table (kill switch)
  db.exec(`
    CREATE TABLE IF NOT EXISTS emergency_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reason TEXT NOT NULL,
      triggered_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `);

  console.log('[Discord Sync DB] Initialized at', dbPath);

  return db;
}

/**
 * Get database instance
 */
export function getDiscordSyncDb(): Database.Database {
  if (!db) {
    throw new Error('Discord sync database not initialized');
  }
  return db;
}

/**
 * Simple hash function for content deduplication
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Check if message was already forwarded (primary check)
 */
export function wasMessageForwarded(
  sourcePlatform: 'discord' | 'comms',
  sourceMessageId: string
): boolean {
  const db = getDiscordSyncDb();

  const result = db.prepare(`
    SELECT 1 FROM message_forwards
    WHERE source_platform = ? AND source_message_id = ?
    LIMIT 1
  `).get(sourcePlatform, sourceMessageId);

  return !!result;
}

/**
 * Check if content hash was seen recently (secondary check)
 */
export function wasContentSeenRecently(
  contentHash: string,
  withinSeconds: number = 10
): MessageStats | null {
  const db = getDiscordSyncDb();
  const cutoffTime = new Date(Date.now() - withinSeconds * 1000).toISOString();

  const result = db.prepare(`
    SELECT
      message_id as messageId,
      content_hash as contentHash,
      seen_count as seenCount,
      first_seen_at as firstSeen,
      last_seen_at as lastSeen
    FROM recent_messages
    WHERE content_hash = ? AND last_seen_at > ?
  `).get(contentHash, cutoffTime) as MessageStats | undefined;

  return result || null;
}

/**
 * Record a message forward
 */
export function recordMessageForward(forward: Omit<MessageForward, 'id' | 'duplicate_count'>): string {
  const db = getDiscordSyncDb();
  const id = `fwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.prepare(`
    INSERT INTO message_forwards (
      id, source_platform, source_message_id, source_content_hash,
      destination_platform, destination_message_id, author, forwarded_at, duplicate_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    forward.source_platform,
    forward.source_message_id,
    forward.source_content_hash,
    forward.destination_platform,
    forward.destination_message_id,
    forward.author,
    forward.forwarded_at
  );

  return id;
}

/**
 * Track message in recent_messages (rolling window)
 */
export function trackRecentMessage(
  contentHash: string,
  platform: 'discord' | 'comms',
  messageId: string,
  author: string
): number {
  const db = getDiscordSyncDb();
  const now = new Date().toISOString();

  // Try to update existing
  const result = db.prepare(`
    UPDATE recent_messages
    SET seen_count = seen_count + 1, last_seen_at = ?
    WHERE content_hash = ?
  `).run(now, contentHash);

  if (result.changes > 0) {
    // Return updated count
    const row = db.prepare(`
      SELECT seen_count FROM recent_messages WHERE content_hash = ?
    `).get(contentHash) as { seen_count: number };
    return row.seen_count;
  }

  // Insert new
  db.prepare(`
    INSERT INTO recent_messages (
      content_hash, platform, message_id, author, seen_count, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(contentHash, platform, messageId, author, now, now);

  return 1;
}

/**
 * Clean up old recent_messages (keep last hour only)
 */
export function cleanupRecentMessages(olderThanMinutes: number = 60): number {
  const db = getDiscordSyncDb();
  const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

  const result = db.prepare(`
    DELETE FROM recent_messages WHERE last_seen_at < ?
  `).run(cutoffTime);

  return result.changes;
}

/**
 * Increment duplicate count (for monitoring)
 */
export function incrementDuplicateCount(
  sourcePlatform: 'discord' | 'comms',
  sourceMessageId: string
): number {
  const db = getDiscordSyncDb();

  db.prepare(`
    UPDATE message_forwards
    SET duplicate_count = duplicate_count + 1
    WHERE source_platform = ? AND source_message_id = ?
  `).run(sourcePlatform, sourceMessageId);

  const row = db.prepare(`
    SELECT duplicate_count FROM message_forwards
    WHERE source_platform = ? AND source_message_id = ?
  `).get(sourcePlatform, sourceMessageId) as { duplicate_count: number } | undefined;

  return row?.duplicate_count || 0;
}

/**
 * Check if emergency stop is active
 */
export function isEmergencyStopped(): boolean {
  const db = getDiscordSyncDb();

  const result = db.prepare(`
    SELECT 1 FROM emergency_stops
    WHERE resolved_at IS NULL
    LIMIT 1
  `).get();

  return !!result;
}

/**
 * Trigger emergency stop
 */
export function triggerEmergencyStop(reason: string): void {
  const db = getDiscordSyncDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO emergency_stops (reason, triggered_at)
    VALUES (?, ?)
  `).run(reason, now);

  console.error('[EMERGENCY STOP] Discord sync disabled:', reason);
}

/**
 * Resolve emergency stop
 */
export function resolveEmergencyStop(): void {
  const db = getDiscordSyncDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE emergency_stops
    SET resolved_at = ?
    WHERE resolved_at IS NULL
  `).run(now);

  console.log('[EMERGENCY STOP] Resolved');
}

/**
 * Get sync statistics
 */
export function getSyncStats(): {
  totalForwards: number;
  recentMessages: number;
  highDuplicates: number;
  emergencyStops: number;
} {
  const db = getDiscordSyncDb();

  const totalForwards = (db.prepare('SELECT COUNT(*) as count FROM message_forwards').get() as { count: number }).count;
  const recentMessages = (db.prepare('SELECT COUNT(*) as count FROM recent_messages').get() as { count: number }).count;
  const highDuplicates = (db.prepare('SELECT COUNT(*) as count FROM message_forwards WHERE duplicate_count >= 3').get() as { count: number }).count;
  const emergencyStops = (db.prepare('SELECT COUNT(*) as count FROM emergency_stops WHERE resolved_at IS NULL').get() as { count: number }).count;

  return {
    totalForwards,
    recentMessages,
    highDuplicates,
    emergencyStops
  };
}
