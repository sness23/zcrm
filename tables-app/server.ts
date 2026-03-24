import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Connect to the database
const dbPath = path.join(__dirname, '..', 'vault', 'crm.db');
let db: Database.Database | null = null;

try {
  // Try to open database in readonly mode
  db = new Database(dbPath, { readonly: true });
  console.log('Connected to existing database');
} catch (error: any) {
  if (error.code === 'SQLITE_CANTOPEN') {
    // Database doesn't exist, create it with schema
    console.log('Database not found, creating new one...');
    db = new Database(dbPath);

    // Create tables for all entity types
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS opportunities (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, name TEXT, subject TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, type TEXT);
      CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, name TEXT, type TEXT);
    `);
    console.log('Database created with schema');
  } else {
    throw error;
  }
}

app.use(cors());
app.use(express.json());

// Entity types that we support
const ENTITIES = [
  'accounts',
  'contacts',
  'opportunities',
  'leads',
  'activities',
  'tasks',
  'quotes',
  'products',
  'campaigns'
] as const;

type EntityType = typeof ENTITIES[number];

// Get all records for an entity
app.get('/api/:entity', (req, res) => {
  try {
    const entity = req.params.entity as EntityType;

    if (!ENTITIES.includes(entity)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const rows = db.prepare(`SELECT * FROM ${entity}`).all();
    res.json(rows);
  } catch (error) {
    console.error(`Error fetching ${req.params.entity}:`, error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// Get a single record by ID
app.get('/api/:entity/:id', (req, res) => {
  try {
    const entity = req.params.entity as EntityType;
    const id = req.params.id;

    if (!ENTITIES.includes(entity)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const row = db.prepare(`SELECT * FROM ${entity} WHERE id = ?`).get(id);

    if (!row) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json(row);
  } catch (error) {
    console.error(`Error fetching ${req.params.entity}/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

// Get related records (e.g., contacts for an account)
app.get('/api/:entity/:id/:relatedEntity', (req, res) => {
  try {
    const entity = req.params.entity as EntityType;
    const id = req.params.id;
    const relatedEntity = req.params.relatedEntity as EntityType;

    if (!ENTITIES.includes(entity) || !ENTITIES.includes(relatedEntity)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Build the query based on the relationship
    let foreignKey = '';
    if (entity === 'accounts') {
      foreignKey = 'account_id';
    } else if (entity === 'opportunities') {
      foreignKey = 'opportunity_id';
    }

    if (!foreignKey) {
      return res.status(400).json({ error: 'Relationship not supported' });
    }

    const rows = db.prepare(
      `SELECT * FROM ${relatedEntity} WHERE ${foreignKey} = ?`
    ).all(id);

    res.json(rows);
  } catch (error) {
    console.error(`Error fetching related records:`, error);
    res.status(500).json({ error: 'Failed to fetch related records' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Connected to database at ${dbPath}`);
});
