import { Command } from 'commander';
import { ORCIDClient } from '../integrations/orcid/client.js';
import { mapORCIDToResearcherProfile } from '../integrations/orcid/mapper.js';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export const enrichORCIDCommand = new Command('enrich:orcid')
  .description('Enrich a party with ORCID data')
  .argument('<party-id>', 'Party ID (slug) to enrich')
  .action(async (partyId: string) => {
    console.log(`\n🔍 Enriching party ${partyId} with ORCID data...\n`);

    const client = new ORCIDClient();

    // Read party file
    const partyPath = path.join(process.cwd(), 'vault', 'parties', `${partyId}.md`);
    if (!fs.existsSync(partyPath)) {
      console.error(`❌ Party not found: ${partyPath}`);
      process.exit(1);
    }

    const partyContent = fs.readFileSync(partyPath, 'utf8');
    const partyData = matter(partyContent);

    const { name, email } = partyData.data;
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');

    // Search ORCID
    console.log(`  Searching ORCID for: ${firstName} ${lastName} <${email}>`);
    const orcid = await client.searchByNameAndEmail(firstName, lastName, email);

    if (!orcid) {
      console.log('  ⚠️  No ORCID found');
      return;
    }

    console.log(`  ✓ Found ORCID: ${orcid}`);

    // Fetch profile
    console.log('  Fetching full profile...');
    const profile = await client.getProfile(orcid);

    if (!profile) {
      console.error('  ❌ Failed to fetch profile');
      return;
    }

    console.log(`  ✓ Profile fetched: ${profile.works.length} works`);

    // Find researcher profile
    const researcherProfilePath = path.join(
      process.cwd(),
      'vault',
      'researcher-profiles',
      `${partyId}-researcher-profile.md`
    );

    if (!fs.existsSync(researcherProfilePath)) {
      console.error('  ❌ ResearcherProfile not found');
      return;
    }

    // Update researcher profile
    const rpContent = fs.readFileSync(researcherProfilePath, 'utf8');
    const rpData = matter(rpContent);

    const updates = mapORCIDToResearcherProfile(profile);
    Object.assign(rpData.data, updates);

    const updatedContent = matter.stringify(rpData.content, rpData.data);
    fs.writeFileSync(researcherProfilePath, updatedContent, 'utf8');

    console.log(`  ✓ Updated ResearcherProfile with ORCID data`);
    console.log(`\n✅ Enrichment complete!\n`);
    console.log(`  ORCID: ${orcid}`);
    console.log(`  Publications: ${profile.works.length}`);
    console.log(`  Verified: ${profile.verified}`);
  });
