import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import matter from 'gray-matter';
import { ulid } from 'ulidx';
import { CRMDatabase } from './lib/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VAULT_PATH = path.join(__dirname, '..', 'vault');
const CHANGES_LOG_PATH = path.join(VAULT_PATH, 'changes.log');
const DB_PATH = path.join(VAULT_PATH, 'crm.db');

const crmDb = new CRMDatabase(DB_PATH);
const db = crmDb.getDb();

// Track processed log entries
let lastProcessedLine = 0;

// Map directory names to entity types
const ENTITY_MAP: Record<string, string> = {
  accounts: 'accounts',
  contacts: 'contacts',
  opportunities: 'opportunities',
  leads: 'leads',
  activities: 'activities',
  tasks: 'tasks',
  quotes: 'quotes',
  products: 'products',
  campaigns: 'campaigns',
  events: 'events',
  orders: 'orders',
  contracts: 'contracts',
  assets: 'assets',
  cases: 'cases',
  knowledge: 'knowledge',
  visitors: 'visitor-sessions',
  'contact-chats': 'contact-chats',
  imessages: 'imessages',
  // Party Model (Phase 3.C - Identity Resolution)
  parties: 'party',
  individuals: 'individual',
  organizations: 'organization',
  households: 'household',
  'party-identifications': 'party-identification',
  'contact-point-emails': 'contact-point-email',
  'contact-point-phones': 'contact-point-phone',
  'contact-point-addresses': 'contact-point-address',
  'researcher-profiles': 'researcher-profile',
  'organization-profiles': 'organization-profile',
  'party-sources': 'party-source',
  'party-engagements': 'party-engagement',
};

function getEntityTypeFromPath(filePath: string): string | null {
  const parts = filePath.split('/');
  if (parts.length < 2) return null;
  return ENTITY_MAP[parts[0]] || null;
}

function extractIdFromFilename(filename: string): string | null {
  // Look for patterns like acc_01ABCD...  con_01ABCD... etc in the filename
  const match = filename.match(/([a-z]+_[0-9A-Z]+)/);
  return match ? match[1] : null;
}

function syncMarkdownToDatabase(filePath: string, action: string) {
  try {
    const fullPath = path.join(VAULT_PATH, filePath);
    const dirName = filePath.split('/')[0];

    if (!ENTITY_MAP[dirName]) {
      console.log(`Skipping non-entity file: ${filePath}`);
      return;
    }

    if (action === 'delete') {
      // Handle deletion
      const id = extractIdFromFilename(filePath);
      if (id) {
        crmDb.applyEvent({
          id: ulid(),
          type: 'delete',
          entity_type: '', // Not needed for delete
          entity_id: id,
          data: {},
          timestamp: new Date().toISOString(),
          status: 'applied'
        });
        console.log(`✓ Deleted ${id}`);
      }
      return;
    }

    // Read and parse the markdown file
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const parsed = matter(content);
    const frontmatter = parsed.data;

    if (!frontmatter.id) {
      console.log(`No ID in frontmatter for ${filePath}`);
      return;
    }

    // Use the CRMDatabase's applyEvent method which handles all special cases
    crmDb.applyEvent({
      id: ulid(),
      type: 'create', // applyCreate handles both insert and update via INSERT OR REPLACE
      entity_type: frontmatter.type,
      entity_id: frontmatter.id,
      data: frontmatter,
      timestamp: new Date().toISOString(),
      status: 'applied'
    });

    console.log(`✓ Created ${frontmatter.type} ${frontmatter.id}`);
  } catch (error) {
    console.error(`Error syncing ${filePath}:`, error);
    createEvent('update', '', '', 'failed', (error as Error).message);
  }
}

function createEvent(
  type: string,
  entityType: string,
  entityId: string,
  status: string = 'completed',
  error?: string
) {
  const eventId = ulid();
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO sync_log (event_id, type, entity_type, entity_id, status, timestamp, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(eventId, type, entityType, entityId, status, timestamp, error || null);
}

function processChangesLog() {
  try {
    if (!fs.existsSync(CHANGES_LOG_PATH)) {
      console.log('No changes.log file found');
      return;
    }

    const content = fs.readFileSync(CHANGES_LOG_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);

    // Process new lines
    const newLines = lines.slice(lastProcessedLine);

    if (newLines.length > 0) {
      console.log(`\nProcessing ${newLines.length} new change(s)...`);

      for (const line of newLines) {
        try {
          const entry = JSON.parse(line);
          console.log(`Processing: ${entry.action} ${entry.filePath}`);
          syncMarkdownToDatabase(entry.filePath, entry.action);
        } catch (error) {
          console.error(`Error processing log entry:`, error);
        }
      }

      lastProcessedLine = lines.length;
    }
  } catch (error) {
    console.error('Error processing changes log:', error);
  }
}

// Watch the changes log file
console.log('Starting CRM sync worker...');
console.log(`Watching: ${CHANGES_LOG_PATH}`);
console.log(`Database: ${DB_PATH}\n`);

// Initial processing
processChangesLog();

// Watch for changes
fs.watchFile(CHANGES_LOG_PATH, { interval: 1000 }, () => {
  processChangesLog();
});

console.log('✓ Worker running. Watching for changes...\n');
