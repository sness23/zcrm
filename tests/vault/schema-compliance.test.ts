import { describe, it, expect, beforeEach } from 'vitest'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { readdirSync, readFileSync, existsSync } from 'fs'
import path from 'path'
import matter from 'gray-matter'

describe('Schema Compliance', () => {
  let ajv: Ajv

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false })
    addFormats(ajv)
  })

  it('all vault records pass schema validation', () => {
    const typeToFolder: Record<string, string> = {
      Account: 'accounts',
      Contact: 'contacts',
      Lead: 'leads',
      Opportunity: 'opportunities',
      Campaign: 'campaigns',
      Product: 'products',
      Quote: 'quotes',
      Task: 'tasks',
      Activity: 'activities'
    }

    let totalValidated = 0
    const failures: string[] = []

    for (const [entityType, folder] of Object.entries(typeToFolder)) {
      const schemaPath = path.join('vault', '_schemas', `${entityType}.schema.json`)
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
      const validate = ajv.compile(schema)

      const dir = path.join('vault', folder)
      if (!existsSync(dir)) continue

      const files = readdirSync(dir).filter(f => f.endsWith('.md'))

      for (const file of files) {
        const filePath = path.join(dir, file)
        const content = readFileSync(filePath, 'utf8')
        const parsed = matter(content)

        const isValid = validate(parsed.data)
        totalValidated++

        if (!isValid) {
          failures.push(`${folder}/${file}`)
          console.error(`\nValidation failed for ${folder}/${file}:`)
          console.error(JSON.stringify(validate.errors, null, 2))
        }
      }
    }

    console.log(`\nValidated ${totalValidated} records`)

    if (failures.length > 0) {
      console.error(`\nFailed files: ${failures.join(', ')}`)
    }

    expect(failures).toHaveLength(0)
  })

  it('validates accounts against Account schema', () => {
    const schema = JSON.parse(
      readFileSync('vault/_schemas/Account.schema.json', 'utf8')
    )
    const validate = ajv.compile(schema)

    const dir = path.join('vault', 'accounts')
    if (!existsSync(dir)) {
      console.warn('No accounts directory found')
      return
    }

    const files = readdirSync(dir).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const content = readFileSync(path.join(dir, file), 'utf8')
      const parsed = matter(content)

      const isValid = validate(parsed.data)
      if (!isValid) {
        console.error(`Validation failed for accounts/${file}:`)
        console.error(validate.errors)
      }

      expect(isValid).toBe(true)
    }
  })

  it('validates contacts against Contact schema', () => {
    const schema = JSON.parse(
      readFileSync('vault/_schemas/Contact.schema.json', 'utf8')
    )
    const validate = ajv.compile(schema)

    const dir = path.join('vault', 'contacts')
    if (!existsSync(dir)) return

    const files = readdirSync(dir).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const content = readFileSync(path.join(dir, file), 'utf8')
      const parsed = matter(content)

      const isValid = validate(parsed.data)
      if (!isValid) {
        console.error(`Validation failed for contacts/${file}:`)
        console.error(validate.errors)
      }

      expect(isValid).toBe(true)
    }
  })

  it('validates opportunities against Opportunity schema', () => {
    const schema = JSON.parse(
      readFileSync('vault/_schemas/Opportunity.schema.json', 'utf8')
    )
    const validate = ajv.compile(schema)

    const dir = path.join('vault', 'opportunities')
    if (!existsSync(dir)) return

    const files = readdirSync(dir).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const content = readFileSync(path.join(dir, file), 'utf8')
      const parsed = matter(content)

      const isValid = validate(parsed.data)
      if (!isValid) {
        console.error(`Validation failed for opportunities/${file}:`)
        console.error(validate.errors)
      }

      expect(isValid).toBe(true)
    }
  })

  it('required fields are present in all records', () => {
    const folders = [
      'accounts', 'contacts', 'leads', 'opportunities',
      'campaigns', 'products', 'quotes', 'tasks', 'activities'
    ]

    for (const folder of folders) {
      const dir = path.join('vault', folder)
      if (!existsSync(dir)) continue

      const files = readdirSync(dir).filter(f => f.endsWith('.md'))

      for (const file of files) {
        const content = readFileSync(path.join(dir, file), 'utf8')
        const parsed = matter(content)

        // All records must have id and type
        expect(parsed.data.id).toBeDefined()
        expect(parsed.data.type).toBeDefined()

        // All records except Activity must have name
        if (folder !== 'activities' && folder !== 'tasks') {
          expect(parsed.data.name).toBeDefined()
        }

        // Tasks must have subject
        if (folder === 'tasks') {
          expect(parsed.data.subject).toBeDefined()
        }
      }
    }
  })
})
