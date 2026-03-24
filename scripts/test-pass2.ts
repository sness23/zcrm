#!/usr/bin/env tsx
/**
 * Test script for Pass 2 (Relationship Resolution)
 *
 * This script:
 * 1. Imports Accounts to build ID → Slug mapping
 * 2. Imports Contacts (which reference Accounts)
 * 3. Runs Pass 2 to resolve relationships
 */

import { SFImporter } from './sf-import.js';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Mappings {
  global: any;
  objects: Record<string, any>;
}

async function main() {
  console.log('='.repeat(70));
  console.log('Pass 2 Relationship Resolution Test');
  console.log('='.repeat(70));

  // Load mappings
  const mappingsPath = path.join(__dirname, '../sf/mappings.yaml');
  const mappings = yaml.load(fs.readFileSync(mappingsPath, 'utf-8')) as Mappings;

  // Create importer in dry-run mode
  const importer = new SFImporter(mappings, {
    apiUrl: 'http://localhost:9600/api/events',
    dryRun: true,  // Don't actually post events for this test
  });

  console.log('\n📥 Step 1: Import Accounts (builds ID mapping)');
  console.log('-'.repeat(70));
  await importer.importObject(
    'Account',
    'sf/test-data/sample-accounts.json'
  );

  console.log('\n📥 Step 2: Import Contacts (with AccountId references)');
  console.log('-'.repeat(70));
  await importer.importObject(
    'Contact',
    'sf/test-data/sample-contacts.json'
  );

  console.log('\n📥 Step 3: Import Opportunities (with AccountId references)');
  console.log('-'.repeat(70));
  await importer.importObject(
    'Opportunity',
    'sf/test-data/sample-opportunities.json'
  );

  console.log('\n🔗 Step 4: Run Pass 2 - Resolve Relationships');
  console.log('-'.repeat(70));
  await importer.resolveAllRelationships(['Account', 'Contact', 'Opportunity']);

  console.log('\n✅ Test Complete!');
  console.log('='.repeat(70));
  console.log('\nNOTE: This is a dry-run test. To actually apply changes:');
  console.log('  1. Remove --dry-run flag');
  console.log('  2. Ensure API server is running (npm run api)');
  console.log('  3. Run: npx tsx scripts/sf-import.ts --objects=Account,Contact,Opportunity');
}

main().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
