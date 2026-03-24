import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { getVaultPath } from './vault.js';

/**
 * Get database path
 */
export function getDatabasePath(): string {
  return path.join(getVaultPath(), 'crm.db');
}

/**
 * Open a connection to the database
 */
export function openDatabase(): Database.Database {
  const dbPath = getDatabasePath();
  return new Database(dbPath);
}

/**
 * Execute a query with optional parameters
 */
export function query<T = any>(sql: string, params?: any[]): T[] {
  const db = openDatabase();
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...(params || [])) as T[];
  } finally {
    db.close();
  }
}

/**
 * Execute a query and return a single row
 */
export function queryOne<T = any>(sql: string, params?: any[]): T | null {
  const db = openDatabase();
  try {
    const stmt = db.prepare(sql);
    return (stmt.get(...(params || [])) as T) || null;
  } finally {
    db.close();
  }
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export function execute(sql: string, params?: any[]): Database.RunResult {
  const db = openDatabase();
  try {
    const stmt = db.prepare(sql);
    return stmt.run(...(params || []));
  } finally {
    db.close();
  }
}

/**
 * Get all table names in the database
 */
export function getTables(): string[] {
  const results = query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  return results.map((r) => r.name);
}

/**
 * Get table info (columns, types, etc)
 */
export function getTableInfo(tableName: string): Array<{
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}> {
  return query(`PRAGMA table_info(${tableName})`);
}

/**
 * Get row count for a table
 */
export function getTableRowCount(tableName: string): number {
  const result = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
  return result?.count || 0;
}

/**
 * Clear all data from all tables (but keep schema)
 */
export function clearAllTables(): number {
  const db = openDatabase();
  let cleared = 0;

  try {
    const tables = getTables();
    for (const table of tables) {
      const result = db.prepare(`DELETE FROM ${table}`).run();
      cleared += result.changes;
    }
  } finally {
    db.close();
  }

  return cleared;
}

/**
 * Clear a specific table
 */
export function clearTable(tableName: string): number {
  const result = execute(`DELETE FROM ${tableName}`);
  return result.changes;
}

/**
 * Vacuum the database (optimize and reclaim space)
 */
export function vacuumDatabase(): void {
  const db = openDatabase();
  try {
    db.prepare('VACUUM').run();
  } finally {
    db.close();
  }
}

/**
 * Get database file size in bytes
 */
export function getDatabaseSize(): number {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    return 0;
  }
  return fs.statSync(dbPath).size;
}

/**
 * Check if database exists
 */
export function databaseExists(): boolean {
  return fs.existsSync(getDatabasePath());
}

/**
 * Execute multiple statements in a transaction
 */
export function transaction(statements: Array<{ sql: string; params?: any[] }>): void {
  const db = openDatabase();
  try {
    const txn = db.transaction(() => {
      for (const { sql, params } of statements) {
        const stmt = db.prepare(sql);
        stmt.run(...(params || []));
      }
    });
    txn();
  } finally {
    db.close();
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  path: string;
  size: number;
  tables: Array<{
    name: string;
    rowCount: number;
  }>;
} {
  const tables = getTables();
  return {
    path: getDatabasePath(),
    size: getDatabaseSize(),
    tables: tables.map((name) => ({
      name,
      rowCount: getTableRowCount(name),
    })),
  };
}
