#!/usr/bin/env node
/**
 * Email Import Script
 *
 * Imports email contacts from ~/data/vaults/emails/ into the CRM system as Leads.
 *
 * Features:
 * - Imports researcher email data as Leads
 * - Primary email in frontmatter, all emails listed in body
 * - Tracks email sources (pubmed, inferred, fern_archive, etc.)
 * - Deduplication by email
 *
 * Usage:
 *   npx tsx src/scripts/import-emails.ts [options]
 *
 * Environment Variables:
 *   DRY_RUN=true      Preview import without writing
 *   SOURCE_DIR=<path> Custom path to email JSON files
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { ulid } from 'ulidx';
import os from 'os';

// Types
interface EmailRecord {
  uid: string;
  name: string;
  emails: string[];
  sources: Record<string, string[]>;
  updated: string;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
}

// Configuration
const DEFAULT_SOURCE_DIR = process.env.SOURCE_DIR || path.join(os.homedir(), 'data/vaults/emails');
const VAULT_DIR = path.join(process.cwd(), 'vault');
const DRY_RUN = process.env.DRY_RUN === 'true';

// Helper to generate ULID with prefix
function idFor(kind: string): string {
  const prefixes: Record<string, string> = {
    lead: 'led_',
  };
  return prefixes[kind] + ulid().toLowerCase();
}

// Helper to create slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper to remove undefined values from object
function removeUndefined(obj: any): any {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

// Helper to write markdown file
function writeMarkdown(type: string, slug: string, data: any, body: string = '') {
  const dirs: Record<string, string> = {
    lead: 'leads',
  };

  const dir = path.join(VAULT_DIR, dirs[type]);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${slug}.md`);
  const cleanedData = removeUndefined(data);
  const content = matter.stringify(body, cleanedData);

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return filePath;
}

// Check if lead already exists by email
function findExistingLeadByEmail(email: string): string | null {
  const leadsDir = path.join(VAULT_DIR, 'leads');
  if (!fs.existsSync(leadsDir)) return null;

  const files = fs.readdirSync(leadsDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(leadsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    if (data.email && data.email.toLowerCase() === email.toLowerCase()) {
      return data.id;
    }
  }

  return null;
}

// Import a single email record
async function importEmailRecord(jsonFile: string, stats: ImportStats): Promise<void> {
  try {
    stats.total++;

    // Read JSON file
    const filePath = path.join(DEFAULT_SOURCE_DIR, jsonFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const data: EmailRecord = JSON.parse(content);

    // Validate required fields
    if (!data.name || !data.emails || data.emails.length === 0) {
      console.log(`  Skipping ${jsonFile}: Missing required fields`);
      stats.skipped++;
      return;
    }

    const primaryEmail = data.emails[0];

    // Check for duplicates by email
    const existingId = findExistingLeadByEmail(primaryEmail);
    if (existingId) {
      console.log(`  Skipping ${data.name}: Already exists (email match)`);
      stats.duplicates++;
      return;
    }

    // Generate ID and slug
    const leadId = idFor('lead');
    const slug = slugify(data.name);

    // Build body with all emails
    let body = `# ${data.name}\n\n`;
    body += `## Email Addresses\n\n`;
    body += `### Verified\n`;
    for (const email of data.emails) {
      body += `- ${email}\n`;
    }

    // Add emails from sources
    if (data.sources) {
      for (const [source, emails] of Object.entries(data.sources)) {
        if (emails && emails.length > 0) {
          body += `\n### ${source}\n`;
          for (const email of emails) {
            body += `- ${email}\n`;
          }
        }
      }
    }

    body += `\n---\nExternal UID: ${data.uid}\n`;
    body += `Updated: ${data.updated}\n`;

    // Create Lead
    const leadData = {
      id: leadId,
      type: 'Lead',
      name: data.name,
      email: primaryEmail,
      source: 'email-vault',
      status: 'New',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    writeMarkdown('lead', slug, leadData, body);

    console.log(`  Imported: ${data.name} <${primaryEmail}>`);
    stats.imported++;

  } catch (error) {
    console.error(`  Error importing ${jsonFile}:`, error);
    stats.errors++;
  }
}

// Main import function
async function main() {
  console.log('Email Import Script\n');
  console.log(`Source: ${DEFAULT_SOURCE_DIR}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}\n`);

  // Check if source directory exists
  if (!fs.existsSync(DEFAULT_SOURCE_DIR)) {
    console.error(`Source directory not found: ${DEFAULT_SOURCE_DIR}`);
    process.exit(1);
  }

  // Get all JSON files
  const files = fs.readdirSync(DEFAULT_SOURCE_DIR)
    .filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No email JSON files found.');
    return;
  }

  console.log(`Found ${files.length} email files to process.\n`);

  const stats: ImportStats = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0,
  };

  // Process files
  for (const file of files) {
    await importEmailRecord(file, stats);
  }

  // Print summary
  console.log('\nImport Summary:');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Imported: ${stats.imported}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Duplicates: ${stats.duplicates}`);
  console.log(`Errors: ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN - No files were actually written');
  }
}

// Run
main().catch(console.error);
