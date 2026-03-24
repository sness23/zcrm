#!/usr/bin/env node
/**
 * Google Scholar Import Script
 *
 * Imports scholars from ~/data/vaults/scholarmd/scholars/ into the CRM system
 * as Individual parties with ResearcherProfiles.
 *
 * Features:
 * - Selective import (h-index >= 20)
 * - Identity resolution (prevents duplicates)
 * - Batch processing with progress tracking
 * - Creates: Party → Individual → ContactPointEmail → PartyIdentification → ResearcherProfile
 *
 * Usage:
 *   npx tsx src/scripts/import-scholars.ts [options]
 *
 * Options:
 *   --batch-size <n>      Number of scholars to import (default: 10)
 *   --min-h-index <n>     Minimum h-index threshold (default: 20)
 *   --dry-run             Preview import without writing
 *   --source-dir <path>   Custom path to scholar markdown files
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { ulid } from 'ulidx';
import os from 'os';

// Types
interface ScholarFrontmatter {
  author_id: string;
  name: string;
  affiliations?: string;
  email?: string;
  website?: string;
  thumbnail?: string;
  total_articles?: number;
  total_citations?: number;
  h_index?: number;
  i10_index?: number;
  scholar_url?: string;
  tags?: string[];
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  duplicates: number;
}

// Configuration
const DEFAULT_SOURCE_DIR = path.join(os.homedir(), 'data/vaults/scholarmd/scholars');
const VAULT_DIR = path.join(process.cwd(), 'vault');
const MIN_H_INDEX = parseInt(process.env.MIN_H_INDEX || '20');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const DRY_RUN = process.env.DRY_RUN === 'true';

// Helper to generate ULID with prefix
function idFor(kind: string): string {
  const prefixes: Record<string, string> = {
    party: 'pty_',
    individual: 'ind_',
    'contact-point-email': 'cpe_',
    'party-identification': 'pid_',
    'researcher-profile': 'rsp_',
    'party-source': 'pso_',
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
    party: 'parties',
    individual: 'individuals',
    'contact-point-email': 'contact-point-emails',
    'party-identification': 'party-identifications',
    'researcher-profile': 'researcher-profiles',
    'party-source': 'party-sources',
  };

  const dir = path.join(VAULT_DIR, dirs[type]);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = path.join(dir, `${slug}.md`);
  // Remove undefined values before stringifying
  const cleanedData = removeUndefined(data);
  const content = matter.stringify(body, cleanedData);

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return filePath;
}

// Check if party already exists by email
function findExistingPartyByEmail(email: string): string | null {
  const emailsDir = path.join(VAULT_DIR, 'contact-point-emails');
  if (!fs.existsSync(emailsDir)) return null;

  const files = fs.readdirSync(emailsDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(emailsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    if (data.email_address && data.email_address.toLowerCase() === email.toLowerCase()) {
      return data.party_id;
    }
  }

  return null;
}

// Check if party already exists by Google Scholar ID
function findExistingPartyByScholarId(scholarId: string): string | null {
  const idsDir = path.join(VAULT_DIR, 'party-identifications');
  if (!fs.existsSync(idsDir)) return null;

  const files = fs.readdirSync(idsDir);
  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const filePath = path.join(idsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);

    if (
      data.party_identification_type === 'GoogleScholar' &&
      data.identification_number === scholarId
    ) {
      return data.party_id;
    }
  }

  return null;
}

// Check if party already exists by name (fuzzy match)
function findExistingPartyByName(name: string): string | null {
  const individualsDir = path.join(VAULT_DIR, 'individuals');
  if (!fs.existsSync(individualsDir)) return null;

  const slug = slugify(name);
  const filePath = path.join(individualsDir, `${slug}.md`);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    return data.party_id || null;
  }

  return null;
}

// Import a single scholar
async function importScholar(scholarFile: string, stats: ImportStats): Promise<void> {
  try {
    stats.total++;

    // Read scholar file
    const filePath = path.join(DEFAULT_SOURCE_DIR, scholarFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const data = parsed.data as ScholarFrontmatter;

    // Validate required fields
    if (!data.author_id || !data.name) {
      console.log(`⏭️  Skipping ${scholarFile}: Missing required fields`);
      stats.skipped++;
      return;
    }

    // Filter by h-index
    if (!data.h_index || data.h_index < MIN_H_INDEX) {
      console.log(`⏭️  Skipping ${data.name} (h-index too low: ${data.h_index || 0})`);
      stats.skipped++;
      return;
    }

    // Identity resolution (check for duplicates)
    let existingPartyId: string | null = null;

    // 1. Check by Google Scholar ID
    existingPartyId = findExistingPartyByScholarId(data.author_id);
    if (existingPartyId) {
      console.log(`⏭️  Skipping ${data.name}: Already exists (Scholar ID match)`);
      stats.duplicates++;
      return;
    }

    // 2. Check by email
    if (data.email && data.email !== 'Verified email at ucl.ac.uk') {
      const cleanEmail = data.email.replace('Verified email at ', '').trim();
      if (cleanEmail.includes('@')) {
        existingPartyId = findExistingPartyByEmail(cleanEmail);
        if (existingPartyId) {
          console.log(`⏭️  Skipping ${data.name}: Already exists (Email match)`);
          stats.duplicates++;
          return;
        }
      }
    }

    // 3. Check by name (fuzzy match)
    existingPartyId = findExistingPartyByName(data.name);
    if (existingPartyId) {
      console.log(`⚠️  Warning: ${data.name} may already exist (Name match) - importing anyway with new ID`);
    }

    // Generate IDs
    const partyId = idFor('party');
    const individualId = idFor('individual');
    const researcherProfileId = idFor('researcher-profile');
    const partySourceId = idFor('party-source');
    const partyIdentificationId = idFor('party-identification');

    const slug = slugify(data.name);

    // Create Party
    const partyData = {
      id: partyId,
      type: 'Party',
      party_type: 'Individual',
      name: data.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeMarkdown('party', slug, partyData, `# ${data.name}\n\nResearcher imported from Google Scholar.\n`);

    // Create Individual
    const individualData = {
      id: individualId,
      type: 'Individual',
      party_id: partyId,  // Use ULID for database foreign key
      first_name: data.name.split(' ')[0],
      last_name: data.name.split(' ').slice(1).join(' '),
      salutation: data.name.includes('Dr.') ? 'Dr.' : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeMarkdown('individual', slug, individualData, `# ${data.name}\n`);

    // Create ContactPointEmail if email exists
    if (data.email && data.email !== 'Verified email at ucl.ac.uk') {
      const cleanEmail = data.email.replace('Verified email at ', '').trim();
      if (cleanEmail.includes('@')) {
        const emailSlug = `${slug}-email`;
        const emailData = {
          id: idFor('contact-point-email'),
          type: 'ContactPointEmail',
          party_id: partyId,  // Use ULID for database foreign key
          email_address: cleanEmail,
          is_primary: true,
          email_type: 'Work',
          created_at: new Date().toISOString(),
        };
        writeMarkdown('contact-point-email', emailSlug, emailData, `# ${data.name} - Email\n`);
      }
    }

    // Create PartyIdentification
    const idSlug = `${slug}-google-scholar`;
    const idData = {
      id: partyIdentificationId,
      type: 'party-identification',
      name: `${data.name} - Google Scholar ID`,
      party_id: partyId,  // Use ULID for database foreign key
      identification_number: data.author_id,
      party_identification_type: 'GoogleScholar',
      identification_name: 'Google Scholar Profile',
      source_url: data.scholar_url || `https://scholar.google.com/citations?user=${data.author_id}`,
      confidence_score: 1.0,
      match_method: 'exact_id',
      issuing_authority: 'Google',
      discovered_date: new Date().toISOString().split('T')[0],
      is_verified: true,
      is_primary: true,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    writeMarkdown('party-identification', idSlug, idData, `# ${data.name} - Google Scholar ID\n`);

    // Create ResearcherProfile
    const profileSlug = `${slug}-profile`;
    const profileData = {
      id: researcherProfileId,
      type: 'ResearcherProfile',
      individual_id: individualId,  // Use ULID for database foreign key
      party_id: partyId,  // Use ULID for database foreign key
      google_scholar_id: data.author_id,
      h_index: data.h_index,
      total_citations: data.total_citations || 0,
      publications_count: data.total_articles || 0,
      current_institution: data.affiliations || undefined,
      enrichment_sources: ['Google Scholar'],
      last_enriched: new Date().toISOString(),
      first_discovered: new Date().toISOString().split('T')[0],
      discovery_source: 'Google Scholar Import Script',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeMarkdown('researcher-profile', profileSlug, profileData, `# ${data.name} - Research Profile\n`);

    // Create PartySource
    const sourceSlug = `${slug}-source`;
    const sourceData = {
      id: partySourceId,
      type: 'party-source',
      name: `${data.name} - Google Scholar Source`,
      party_id: partyId,  // Use ULID for database foreign key
      source_type: 'Google Scholar',
      source_name: 'Google Scholar',
      source_date: new Date().toISOString().split('T')[0],
      data_quality_score: data.h_index >= 50 ? 95 : data.h_index >= 30 ? 85 : 75,
      created_at: new Date().toISOString(),
    };
    writeMarkdown('party-source', sourceSlug, sourceData, `# ${data.name} - Data Source\n`);

    console.log(`✅ Imported: ${data.name} (h-index: ${data.h_index})`);
    stats.imported++;

  } catch (error) {
    console.error(`❌ Error importing ${scholarFile}:`, error);
    stats.errors++;
  }
}

// Main import function
async function main() {
  console.log('🔬 Google Scholar Import Script\n');
  console.log(`Source: ${DEFAULT_SOURCE_DIR}`);
  console.log(`Min h-index: ${MIN_H_INDEX}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}\n`);

  // Check if source directory exists
  if (!fs.existsSync(DEFAULT_SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${DEFAULT_SOURCE_DIR}`);
    process.exit(1);
  }

  // Get all scholar files
  const files = fs.readdirSync(DEFAULT_SOURCE_DIR)
    .filter(f => f.endsWith('.md'))
    .slice(0, BATCH_SIZE);

  if (files.length === 0) {
    console.log('No scholar files found.');
    return;
  }

  console.log(`Found ${files.length} scholar files to process.\n`);

  const stats: ImportStats = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    duplicates: 0,
  };

  // Process files
  for (const file of files) {
    await importScholar(file, stats);
  }

  // Print summary
  console.log('\n📊 Import Summary:');
  console.log(`Total processed: ${stats.total}`);
  console.log(`✅ Imported: ${stats.imported}`);
  console.log(`⏭️  Skipped (low h-index): ${stats.skipped}`);
  console.log(`🔄 Duplicates: ${stats.duplicates}`);
  console.log(`❌ Errors: ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No files were actually written');
  }
}

// Run
main().catch(console.error);
