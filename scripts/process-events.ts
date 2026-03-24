#!/usr/bin/env tsx
/**
 * Event Processor for FS-CRM
 * Converts pending events into entity markdown files
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const API_URL = 'http://localhost:9600';
const VAULT = path.join(process.cwd(), 'vault');

const KIND_DIR: Record<string, string> = {
  Account: 'accounts',
  Contact: 'contacts',
  Opportunity: 'opportunities',
  Activity: 'activities',
  Lead: 'leads',
  Task: 'tasks',
  Quote: 'quotes',
  Product: 'products',
  Campaign: 'campaigns',
  Event: 'events',
  Order: 'orders',
  Contract: 'contracts',
  Asset: 'assets',
  Case: 'cases',
  Knowledge: 'knowledge',
  // Party Model entities
  Party: 'parties',
  Individual: 'individuals',
  Organization: 'organizations',
  Household: 'households',
  'Party-identification': 'party-identifications',
  'Account-contact-relationship': 'account-contact-relationships',
  'Contact-point-email': 'contact-point-emails',
  'Contact-point-phone': 'contact-point-phones',
  'Contact-point-address': 'contact-point-addresses',
  'Contact-point-consent': 'contact-point-consents',
  'Data-use-purpose': 'data-use-purposes',
  // Research Intelligence entities
  'Researcher-profile': 'researcher-profiles',
  'Organization-profile': 'organization-profiles',
  'Party-source': 'party-sources',
  'Party-engagement': 'party-engagements',
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function writeMarkdown(dir: string, filename: string, fm: any, body: string): string {
  const content = matter.stringify(body.trim() + '\n', fm);
  const full = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(full, content, 'utf8');

  // Log change for the vault worker
  logChange('write', path.relative(VAULT, full));

  return full;
}

function logChange(action: string, filePath: string) {
  const logPath = path.join(VAULT, 'changes.log');
  const entry = JSON.stringify({
    action,
    filePath,
    timestamp: new Date().toISOString()
  }) + '\n';

  fs.appendFileSync(logPath, entry, 'utf8');
}

interface Event {
  event_id: string;
  timestamp: string;
  type: string;
  entity_type: string;
  entity_id: string;
  status: string;
  data: any;
}

function parseEventLog(logPath: string): Event[] {
  if (!fs.existsSync(logPath)) {
    return [];
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const events: Event[] = [];

  // Split by event markers
  const eventBlocks = content.split(/^## Event /m).slice(1);

  for (const block of eventBlocks) {
    try {
      const lines = block.split('\n');
      const eventId = lines[0].trim();

      // Extract metadata
      const timestampMatch = block.match(/\*\*Timestamp:\*\* (.+)/);
      const typeMatch = block.match(/\*\*Type:\*\* (.+)/);
      const entityMatch = block.match(/\*\*Entity:\*\* (.+)/);
      const entityIdMatch = block.match(/\*\*Entity ID:\*\* (.+)/);
      const statusMatch = block.match(/\*\*Status:\*\* (.+)/);

      // Extract JSON data
      const jsonMatch = block.match(/```json\n([\s\S]+?)\n```/);

      if (timestampMatch && typeMatch && entityMatch && statusMatch && jsonMatch) {
        const status = statusMatch[1].trim();
        const type = typeMatch[1].trim();
        const data = JSON.parse(jsonMatch[1]);

        // For create events, entity_id may be in the data instead of header
        let entityId = entityIdMatch ? entityIdMatch[1].trim() : null;
        if (!entityId && type === 'create' && data.id) {
          entityId = data.id;
        }

        // Only include pending events
        if (status === 'pending' && entityId) {
          events.push({
            event_id: eventId,
            timestamp: timestampMatch[1].trim(),
            type: type,
            entity_type: entityMatch[1].trim(),
            entity_id: entityId,
            status: status,
            data: data
          });
        }
      }
    } catch (error: any) {
      console.error(`⚠️  Failed to parse event block: ${error.message}`);
    }
  }

  return events;
}

async function fetchPendingEvents(): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];
  const logPath = path.join(VAULT, '_logs', `events-${today}.md`);

  return parseEventLog(logPath);
}

function updateEventStatus(eventId: string, status: string): boolean {
  try {
    const today = new Date().toISOString().split('T')[0];
    const logPath = path.join(VAULT, '_logs', `events-${today}.md`);

    if (!fs.existsSync(logPath)) {
      console.error(`❌ Event log not found: ${logPath}`);
      return false;
    }

    let content = fs.readFileSync(logPath, 'utf8');

    // Find the event block and update its status
    const eventPattern = new RegExp(
      `(## Event ${eventId}[\\s\\S]*?\\*\\*Status:\\*\\* )pending`,
      'g'
    );

    const updatedContent = content.replace(eventPattern, `$1${status}`);

    if (updatedContent === content) {
      console.error(`❌ Event ${eventId} not found or already processed`);
      return false;
    }

    fs.writeFileSync(logPath, updatedContent, 'utf8');
    return true;
  } catch (error: any) {
    console.error(`❌ Error updating event ${eventId}:`, error.message);
    return false;
  }
}

async function processCreateEvent(event: any): Promise<boolean> {
  try {
    const entityType = event.entity_type;
    const data = event.data;

    // AccountContactRelationship and other junction tables don't have a 'name' field
    const junctionTables = ['account-contact-relationship', 'Account-contact-relationship'];
    const requiresName = !junctionTables.includes(entityType);

    if (!entityType || !data || !data.id) {
      console.error(`❌ Invalid event data for ${event.event_id}`);
      return false;
    }

    if (requiresName && !data.name) {
      console.error(`❌ Invalid event data for ${event.event_id}: missing name`);
      return false;
    }

    // Capitalize first letter for KIND_DIR lookup
    const normalizedType = entityType.charAt(0).toUpperCase() + entityType.slice(1).toLowerCase();
    const dirName = KIND_DIR[normalizedType];
    if (!dirName) {
      console.error(`❌ Unknown entity type: ${entityType} (normalized: ${normalizedType})`);
      return false;
    }

    const dir = path.join(VAULT, dirName);

    // For junction tables without names, use ID as filename
    let slug: string;
    let name: string;
    if (data.name) {
      slug = slugify(data.name);
      name = data.name;
    } else {
      // Junction table - use ID as filename
      slug = data.id;
      name = `${entityType} ${data.id}`;
    }

    const filename = `${slug}.md`;

    // Create frontmatter from data
    const frontmatter = { ...data };

    // Create body
    let body = `# ${name}\n`;

    // Add entity-specific body templates (use normalized type)
    if (normalizedType === 'Contact') {
      body += '\n## Notes\n- \n';
    } else if (normalizedType === 'Opportunity') {
      body += '\n## Key Risks\n- \n';
    } else if (normalizedType === 'Lead') {
      body += '\n## Qualification Notes\n- \n';
    } else if (normalizedType === 'Task') {
      body += '\n## Details\n- \n';
    } else if (normalizedType === 'Quote') {
      body += '\n## Line Items\n- \n\n## Terms\n- \n';
    } else if (normalizedType === 'Product') {
      body += '\n## Description\n- \n\n## Features\n- \n';
    } else if (normalizedType === 'Campaign') {
      body += '\n## Goals\n- \n\n## Strategy\n- \n';
    } else if (normalizedType === 'Activity') {
      body += '\n- \n';
    } else if (normalizedType === 'Event') {
      body += '\n## Agenda\n- \n\n## Attendees\n- \n\n## Notes\n- \n';
    } else if (normalizedType === 'Order') {
      body += '\n## Order Details\n- \n\n## Line Items\n- \n\n## Delivery Information\n- \n';
    } else if (normalizedType === 'Contract') {
      body += '\n## Terms & Conditions\n- \n\n## Renewal Information\n- \n\n## Notes\n- \n';
    } else if (normalizedType === 'Asset') {
      body += '\n## Asset Details\n- \n\n## Maintenance History\n- \n\n## Notes\n- \n';
    } else if (normalizedType === 'Case') {
      body += '\n## Description\n\n\n## Resolution Steps\n- \n\n## Notes\n- \n';
    } else if (normalizedType === 'Knowledge') {
      body += '\n## Summary\n\n\n## Content\n\n\n## Related Articles\n- \n';
    }

    const filePath = writeMarkdown(dir, filename, frontmatter, body);
    console.log(`✅ Created ${entityType}: ${name} → ${path.relative(process.cwd(), filePath)}`);

    return true;
  } catch (error: any) {
    console.error(`❌ Error processing event ${event.event_id}:`, error.message);
    return false;
  }
}

async function processEvent(event: any): Promise<boolean> {
  if (event.type === 'create') {
    return await processCreateEvent(event);
  } else if (event.type === 'update') {
    // TODO: Implement update processing
    console.warn(`⚠️  Update events not yet supported: ${event.event_id}`);
    return false;
  } else if (event.type === 'delete') {
    // TODO: Implement delete processing
    console.warn(`⚠️  Delete events not yet supported: ${event.event_id}`);
    return false;
  } else {
    console.warn(`⚠️  Unknown event type: ${event.type}`);
    return false;
  }
}

async function main() {
  console.log('🔄 Processing pending events...\n');

  const events = await fetchPendingEvents();

  if (events.length === 0) {
    console.log('✨ No pending events to process');
    return;
  }

  console.log(`📋 Found ${events.length} pending event(s)\n`);

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    const success = await processEvent(event);

    if (success) {
      // Update event status to 'applied'
      const updated = updateEventStatus(event.event_id, 'applied');
      if (updated) {
        processed++;
      } else {
        failed++;
      }
    } else {
      // Mark event as failed
      updateEventStatus(event.event_id, 'failed');
      failed++;
    }
  }

  console.log(`\n✨ Processing complete!`);
  console.log(`   ✅ Processed: ${processed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('\n💡 The vault worker will sync these files to the database.');
}

main();
