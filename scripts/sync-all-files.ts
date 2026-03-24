#!/usr/bin/env tsx
/**
 * Generate changes.log entries for all existing markdown files
 * This triggers the vault worker to sync everything to the database
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const VAULT = path.join(process.cwd(), 'vault');
const CHANGES_LOG = path.join(VAULT, 'changes.log');

async function main() {
  console.log('🔄 Generating change log entries for all entity files...\n');

  // Find all markdown files in entity directories (CRM + Party Model)
  const files = await glob('vault/{accounts,contacts,opportunities,leads,activities,tasks,quotes,products,campaigns,events,orders,contracts,assets,cases,knowledge,parties,individuals,organizations,households,party-identifications,account-contact-relationships,contact-point-emails,contact-point-phones,contact-point-addresses,researcher-profiles,organization-profiles,party-sources,party-engagements}/*.md');

  console.log(`Found ${files.length} entity files\n`);

  // Clear existing changes.log
  if (fs.existsSync(CHANGES_LOG)) {
    fs.unlinkSync(CHANGES_LOG);
  }

  // Generate entries for all files
  for (const file of files) {
    const relPath = path.relative(VAULT, file);
    const entry = JSON.stringify({
      action: 'write',
      filePath: relPath,
      timestamp: new Date().toISOString()
    }) + '\n';

    fs.appendFileSync(CHANGES_LOG, entry, 'utf8');
  }

  console.log(`✅ Generated ${files.length} change log entries`);
  console.log(`📄 Changes log: ${CHANGES_LOG}`);
  console.log('\n💡 The vault worker should now process these changes and sync to the database.');
}

main();
