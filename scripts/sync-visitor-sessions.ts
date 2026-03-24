#!/usr/bin/env tsx
/**
 * Manually sync visitor sessions from event log to database
 */
import { CRMDatabase } from '../src/lib/database.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'vault/crm.db');
const db = new CRMDatabase(dbPath);
const logDir = path.join(process.cwd(), 'vault/_logs');

console.log(`📊 Using database: ${dbPath}`);

// Read today's event log
const today = new Date().toISOString().slice(0, 10);
const logPath = path.join(logDir, `events-${today}.md`);

console.log(`📖 Reading events from ${logPath}`);

if (!fs.existsSync(logPath)) {
  console.log('❌ No event log found for today');
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf-8');

// Extract all visitor-session events
const eventBlocks = content.split('## Event ').filter(block => block.includes('visitor-session'));

console.log(`Found ${eventBlocks.length} visitor-session events`);

let synced = 0;
let failed = 0;

for (const block of eventBlocks) {
  try {
    // Extract JSON data from the block
    const dataMatch = block.match(/### Data\s+```json\s+([\s\S]+?)\s+```/);
    const changesMatch = block.match(/### Changes\s+```json\s+([\s\S]+?)\s+```/);

    if (dataMatch) {
      const data = JSON.parse(dataMatch[1]);

      // Insert or update visitor session
      db.insertVisitorSession({
        id: data.id,
        socket_id: data.socket_id,
        name: data.name || null,
        email: data.email || null,
        phone: data.phone || null,
        company: data.company || null,
        message: data.message || null,
        connected_at: data.connected_at,
        last_activity: data.last_activity || data.connected_at,
        disconnected_at: data.disconnected_at || null,
        page_url: data.page_url,
        referrer: null,
        user_agent: data.user_agent,
        ip_address: data.ip_address,
        status: data.status || 'active'
      });

      console.log(`✅ Synced session ${data.id}`);
      synced++;
    } else if (changesMatch) {
      // Handle update events
      const changes = JSON.parse(changesMatch[1]);
      const entityIdMatch = block.match(/\*\*Entity ID:\*\* (vis_[a-z0-9]+)/);

      if (entityIdMatch) {
        const sessionId = entityIdMatch[1];
        db.updateVisitorSession(sessionId, changes);
        console.log(`✅ Updated session ${sessionId}`);
        synced++;
      }
    }
  } catch (error: any) {
    console.error(`❌ Failed to process event:`, error.message);
    failed++;
  }
}

console.log(`\n✨ Complete! Synced: ${synced}, Failed: ${failed}`);
