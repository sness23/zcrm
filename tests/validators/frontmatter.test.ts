import { describe, it, expect, beforeEach } from 'vitest'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { readFileSync } from 'fs'
import path from 'path'

describe('Frontmatter Schema Validation', () => {
  let ajv: Ajv

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false })
    addFormats(ajv)
  })

  describe('Account Schema', () => {
    it('validates valid account data', () => {
      const schema = JSON.parse(
        readFileSync('vault/_schemas/Account.schema.json', 'utf8')
      )
      const validate = ajv.compile(schema)

      const validAccount = {
        id: 'acc_01k7djy3vnezx59arwm93xs613',
        type: 'Account',
        name: 'Test Corporation',
        lifecycle_stage: 'prospect',
        created: '2025-10-13'
      }

      const result = validate(validAccount)
      if (!result) {
        console.error(validate.errors)
      }
      expect(result).toBe(true)
    })

    it('rejects account with wrong ID prefix', () => {
      const schema = JSON.parse(
        readFileSync('vault/_schemas/Account.schema.json', 'utf8')
      )
      const validate = ajv.compile(schema)

      const invalid = {
        id: 'con_123456789012345678901234567890',
        type: 'Account',
        name: 'Test'
      }

      expect(validate(invalid)).toBe(false)
      expect(validate.errors).toBeDefined()
      expect(validate.errors![0].instancePath).toBe('/id')
    })

    it('rejects account without required name', () => {
      const schema = JSON.parse(
        readFileSync('vault/_schemas/Account.schema.json', 'utf8')
      )
      const validate = ajv.compile(schema)

      const invalid = {
        id: 'acc_01k7djy3vnezx59arwm93xs613',
        type: 'Account'
      }

      expect(validate(invalid)).toBe(false)
    })
  })

  describe('Contact Schema', () => {
    it('validates valid contact data', () => {
      const schema = JSON.parse(
        readFileSync('vault/_schemas/Contact.schema.json', 'utf8')
      )
      const validate = ajv.compile(schema)

      const validContact = {
        id: 'con_01k7djy8myh3ay2qqr9dga0rc4',
        type: 'Contact',
        name: 'Jane Doe',
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        account: '[[accounts/test-corp]]'
      }

      expect(validate(validContact)).toBe(true)
    })

    it('rejects contact with wrong ID prefix', () => {
      const schema = JSON.parse(
        readFileSync('vault/_schemas/Contact.schema.json', 'utf8')
      )
      const validate = ajv.compile(schema)

      const invalid = {
        id: 'acc_123',
        type: 'Contact',
        name: 'John Doe'
      }

      expect(validate(invalid)).toBe(false)
    })
  })

  describe('All Entity Schemas', () => {
    it('compiles all schemas without errors', () => {
      const schemas = [
        'Account',
        'Contact',
        'Lead',
        'Opportunity',
        'Campaign',
        'Product',
        'Quote',
        'Task',
        'Activity'
      ]

      for (const entityType of schemas) {
        const schemaPath = `vault/_schemas/${entityType}.schema.json`
        const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

        // Should compile without throwing
        expect(() => ajv.compile(schema)).not.toThrow()
      }
    })

    it('all schemas have required id, type fields', () => {
      const schemas = [
        'Account',
        'Contact',
        'Lead',
        'Opportunity',
        'Campaign',
        'Product',
        'Quote',
        'Task',
        'Activity'
      ]

      for (const entityType of schemas) {
        const schemaPath = `vault/_schemas/${entityType}.schema.json`
        const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

        expect(schema.required).toContain('id')
        expect(schema.required).toContain('type')
        expect(schema.properties.id).toBeDefined()
        expect(schema.properties.type).toBeDefined()
      }
    })

    it('all schemas have correct ID pattern', () => {
      const prefixes: Record<string, string> = {
        Account: 'acc_',
        Contact: 'con_',
        Lead: 'led_',
        Opportunity: 'opp_',
        Campaign: 'cmp_',
        Product: 'prd_',
        Quote: 'quo_',
        Task: 'tsk_',
        Activity: 'act_'
      }

      for (const [entityType, prefix] of Object.entries(prefixes)) {
        const schemaPath = `vault/_schemas/${entityType}.schema.json`
        const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

        expect(schema.properties.id.pattern).toBe(`^${prefix}`)
      }
    })

    it('all schemas have correct type const', () => {
      const schemas = [
        'Account',
        'Contact',
        'Lead',
        'Opportunity',
        'Campaign',
        'Product',
        'Quote',
        'Task',
        'Activity'
      ]

      for (const entityType of schemas) {
        const schemaPath = `vault/_schemas/${entityType}.schema.json`
        const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

        expect(schema.properties.type.const).toBe(entityType)
      }
    })
  })
})
