import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const VAULT_DIR = path.join(process.cwd(), 'vault')
const LEADS_DIR = path.join(VAULT_DIR, 'leads')
const ACCOUNTS_DIR = path.join(VAULT_DIR, 'accounts')

// Map company names to account slugs
const companyToSlug: Record<string, string> = {
  'Xaira Therapeutics': 'xaira-therapeutics',
  'Recursion Pharmaceuticals': 'recursion-pharmaceuticals',
  'Generate Biomedicines': 'generate-biomedicines',
  'Insilico Medicine': 'insilico-medicine',
  'Cradle Bio': 'cradle-bio',
  'Atomwise': 'atomwise',
  'Relay Therapeutics': 'relay-therapeutics',
  'Iktos': 'iktos',
  'Charm Therapeutics': 'charm-therapeutics',
  'BioAge Labs': 'bioage-labs',
  'Enveda Biosciences': 'enveda-biosciences',
  'GenBio AI': 'genbio-ai',
  'Schrodinger': 'schrodinger',
  'BPGbio': 'bpgbio',
  'Anima Biotech': 'anima-biotech',
  'EvolutionaryScale': 'evolutionaryscale-ai',
  'EvolutionaryScale.ai': 'evolutionaryscale-ai',
  'Isomorphic Labs': 'isomorphic-labs',
  'Latent Labs': 'latent-labs',
}

async function main() {
  const leadFiles = fs.readdirSync(LEADS_DIR).filter(f => f.endsWith('.md'))

  let updated = 0
  let skipped = 0

  for (const file of leadFiles) {
    const filePath = path.join(LEADS_DIR, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const { data: frontmatter, content: body } = matter(content)

    // Skip if already has account link
    if (frontmatter.account) {
      console.log(`⏭️  ${file} - already has account link`)
      skipped++
      continue
    }

    const company = frontmatter.company
    if (!company) {
      console.log(`⚠️  ${file} - no company field`)
      skipped++
      continue
    }

    const slug = companyToSlug[company]
    if (!slug) {
      console.log(`⚠️  ${file} - unknown company: ${company}`)
      skipped++
      continue
    }

    // Check if account file exists
    const accountFile = path.join(ACCOUNTS_DIR, `${slug}.md`)
    if (!fs.existsSync(accountFile)) {
      console.log(`⚠️  ${file} - account file not found: ${slug}.md`)
      skipped++
      continue
    }

    // Add account link
    frontmatter.account = `[[accounts/${slug}]]`

    // Write updated file
    const updated_content = matter.stringify(body, frontmatter)
    fs.writeFileSync(filePath, updated_content)
    console.log(`✅ ${file} -> [[accounts/${slug}]]`)
    updated++
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`)
}

main().catch(console.error)
