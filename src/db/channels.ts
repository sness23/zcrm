import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

/**
 * Ensures the database file and directory exist, without initializing a connection.
 * This is useful for tests to verify file existence before API starts.
 */
export function ensureDatabaseExists(): string {
  const dbPath = path.join(process.cwd(), 'vault', '_logs', 'channels.db');
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('✓ Created channels database directory');
  }

  // Create empty database file if it doesn't exist
  // This ensures tests can verify file existence without waiting for first write
  if (!fs.existsSync(dbPath)) {
    const tempDb = new Database(dbPath);
    tempDb.close();
    console.log('✓ Created empty channels.db file');
  }

  return dbPath;
}

export function initializeDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Always ensure database file exists first (creates empty file if needed)
  const dbPath = ensureDatabaseExists();

  // Create database connection
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Better concurrency

  // Run migrations
  const migrations = [
    '001-initial.sql',
    '002-download-queue.sql'
  ];

  for (const migration of migrations) {
    const migrationPath = path.join(__dirname, 'migrations', migration);
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      db.exec(sql);
      console.log(`  ✓ Applied migration: ${migration}`);
    }
  }

  console.log('✓ Database initialized:', dbPath);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
