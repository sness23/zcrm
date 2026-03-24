import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'
import matter from 'gray-matter'

describe('Vault Markdown Integrity', () => {
  const folders = [
    'accounts',
    'contacts',
    'leads',
    'opportunities',
    'campaigns',
    'products',
    'quotes',
    'tasks',
    'activities'
  ]

  describe('Frontmatter Parsing', () => {
    it('all markdown files have valid frontmatter', () => {
      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')

          // Should parse without errors
          let parsed
          expect(() => {
            parsed = matter(content)
          }).not.toThrow()

          // Should have data object
          expect(parsed.data).toBeDefined()
          expect(typeof parsed.data).toBe('object')
        }
      }
    })

    it('all files have required ID field', () => {
      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const parsed = matter(content)

          expect(parsed.data.id).toBeDefined()
          expect(typeof parsed.data.id).toBe('string')
        }
      }
    })

    it('all files have required type field', () => {
      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const parsed = matter(content)

          expect(parsed.data.type).toBeDefined()
          expect(typeof parsed.data.type).toBe('string')
        }
      }
    })
  })

  describe('ID Format Validation', () => {
    it('all IDs match ULID format', () => {
      const ulidPattern = /^[a-z]{3}_[a-z0-9]{26}$/

      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const parsed = matter(content)

          expect(parsed.data.id).toMatch(ulidPattern)
        }
      }
    })

    it('all files have correct ID prefixes', () => {
      const prefixMap: Record<string, string> = {
        accounts: 'acc_',
        contacts: 'con_',
        leads: 'led_',
        opportunities: 'opp_',
        campaigns: 'cmp_',
        products: 'prd_',
        quotes: 'quo_',
        tasks: 'tsk_',
        activities: 'act_'
      }

      for (const [folder, prefix] of Object.entries(prefixMap)) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const parsed = matter(content)

          expect(parsed.data.id).toMatch(new RegExp(`^${prefix}`))
        }
      }
    })
  })

  describe('Wikilink Format Validation', () => {
    it('no links use old colon format', () => {
      const linkPattern = /\[\[([^\]]+)\]\]/g

      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const matches = Array.from(content.matchAll(linkPattern))

          for (const match of matches) {
            const link = match[1]
            // Should NOT contain colons (old [[Type:slug]] format)
            expect(link).not.toContain(':')
          }
        }
      }
    })

    it('all wikilinks use folder-based or simple slug format', () => {
      const linkPattern = /\[\[([^\]]+)\]\]/g
      const validLinkPattern = /^[a-z0-9\-\/]+(\|[^\]]+)?$/

      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const matches = Array.from(content.matchAll(linkPattern))

          for (const match of matches) {
            const link = match[1]
            // Should match folder/slug or slug (with optional |alias)
            if (!validLinkPattern.test(link)) {
              console.error(`Invalid link format in ${filePath}: [[${link}]]`)
            }
            expect(link).toMatch(validLinkPattern)
          }
        }
      }
    })
  })

  describe('Type Consistency', () => {
    it('type field matches folder location', () => {
      const folderToType: Record<string, string> = {
        accounts: 'Account',
        contacts: 'Contact',
        leads: 'Lead',
        opportunities: 'Opportunity',
        campaigns: 'Campaign',
        products: 'Product',
        quotes: 'Quote',
        tasks: 'Task',
        activities: 'Activity'
      }

      for (const [folder, expectedType] of Object.entries(folderToType)) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const parsed = matter(content)

          expect(parsed.data.type).toBe(expectedType)
        }
      }
    })
  })

  describe('Content Structure', () => {
    it('all files have a markdown heading', () => {
      for (const folder of folders) {
        const dir = path.join('vault', folder)
        if (!existsSync(dir)) continue

        const files = readdirSync(dir).filter(f => f.endsWith('.md'))

        for (const file of files) {
          const filePath = path.join(dir, file)
          const content = readFileSync(filePath, 'utf8')
          const parsed = matter(content)

          // Should have at least one # heading
          expect(parsed.content).toMatch(/^#\s+/m)
        }
      }
    })
  })
})
