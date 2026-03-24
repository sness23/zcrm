import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Connect to the database
const dbPath = path.join(__dirname, '..', 'vault', 'crm.db');
const db = new Database(dbPath);

app.use(cors());
app.use(express.json());

// Ensure events table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_events_entity_id ON events(entity_id);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
`);

// Get events with filtering
app.get('/api/events', (req, res) => {
  try {
    const { days = 7, limit = 100 } = req.query;

    const stmt = db.prepare(`
      SELECT * FROM events
      WHERE timestamp >= datetime('now', '-' || ? || ' days')
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const events = stmt.all(days, limit);
    res.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get entities by type
app.get('/api/entities/:type', (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50 } = req.query;

    const validTypes = ['accounts', 'contacts', 'opportunities', 'leads', 'activities', 'tasks', 'quotes', 'products', 'campaigns'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const stmt = db.prepare(`
      SELECT * FROM ${type}
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const entities = stmt.all(limit) as Array<Record<string, any>>;
    res.json({ entities: entities.map(e => ({ ...e, type })) });
  } catch (error) {
    console.error(`Error fetching ${req.params.type}:`, error);
    res.status(500).json({ error: 'Failed to fetch entities' });
  }
});

// Get single entity
app.get('/api/entities/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;

    const validTypes = ['accounts', 'contacts', 'opportunities', 'leads', 'activities', 'tasks', 'quotes', 'products', 'campaigns'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    const stmt = db.prepare(`SELECT * FROM ${type} WHERE id = ?`);
    const entity = stmt.get(id);

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    res.json({ ...entity, type });
  } catch (error) {
    console.error(`Error fetching entity:`, error);
    res.status(500).json({ error: 'Failed to fetch entity' });
  }
});

app.listen(PORT, () => {
  console.log(`CRM API server running on http://localhost:${PORT}`);
  console.log(`Connected to database at ${dbPath}`);
});
