import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '../../src/api.js'
import fs from 'fs'
import path from 'path'

const VAULT = path.join(process.cwd(), 'vault')

describe('Activity Stream Integration Tests', () => {
  let testEntityId: string
  let testFilePath: string

  beforeAll(async () => {
    // Import ulidx to generate ID
    const { ulid } = await import('ulidx')

    // Create test entity ID
    testEntityId = `acc_${ulid()}`
    const slug = 'activity-stream-test-account'
    testFilePath = `accounts/${slug}.md`

    // Create the test file directly
    const fullPath = path.join(VAULT, testFilePath)
    const frontmatter = {
      id: testEntityId,
      name: 'Activity Stream Test Account',
      lifecycle_stage: 'prospect',
      type: 'Account',
    }

    const fileContent = `---
id: ${testEntityId}
name: Activity Stream Test Account
lifecycle_stage: prospect
type: Account
---
# Activity Stream Test Account

This is a test account for activity stream integration tests.
`

    fs.writeFileSync(fullPath, fileContent, 'utf8')
  })

  afterAll(() => {
    // Clean up test files
    if (testFilePath) {
      const fullPath = path.join(VAULT, testFilePath)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    }

    // Clean up event log
    const today = new Date().toISOString().slice(0, 10)
    const logPath = path.join(VAULT, '_logs', `events-${today}.md`)

    if (fs.existsSync(logPath)) {
      let content = fs.readFileSync(logPath, 'utf8')
      const sections = content.split(/^## Event /m)
      const header = sections[0]
      const filtered = sections.slice(1).filter(section => {
        return !section.includes('Activity Stream Test Account')
      })

      if (filtered.length > 0) {
        content = header + filtered.map(s => '## Event ' + s).join('')
        fs.writeFileSync(logPath, content, 'utf8')
      } else {
        fs.unlinkSync(logPath)
      }
    }
  })

  describe('GET /api/documents/by-entity/:entity_type/:entity_id', () => {
    it('should return document for an existing entity', async () => {
      const response = await request(app)
        .get(`/api/documents/by-entity/accounts/${testEntityId}`)
        .expect(200)

      expect(response.body).toHaveProperty('path')
      expect(response.body).toHaveProperty('frontmatter')
      expect(response.body).toHaveProperty('content')
      expect(response.body).toHaveProperty('last_modified')
      expect(response.body).toHaveProperty('content_length')

      expect(response.body.frontmatter.id).toBe(testEntityId)
      expect(response.body.frontmatter.name).toBe('Activity Stream Test Account')
      expect(response.body.frontmatter.type).toBe('Account')
    })

    it('should return 404 for non-existent entity', async () => {
      const response = await request(app)
        .get('/api/documents/by-entity/accounts/acc_nonexistent123')
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('not found')
    })

    it('should return 400 for unknown entity type', async () => {
      const response = await request(app)
        .get('/api/documents/by-entity/unknown_type/some_id')
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Unknown entity type')
    })

    it('should handle all supported entity types', async () => {
      const entityTypes = [
        'accounts', 'contacts', 'opportunities', 'activities',
        'leads', 'tasks', 'quotes', 'products', 'campaigns'
      ]

      for (const entityType of entityTypes) {
        const response = await request(app)
          .get(`/api/documents/by-entity/${entityType}/test_id`)

        // Should either return 404 (entity not found) or 200 (entity found)
        // But should NOT return 400 (invalid entity type)
        expect([200, 404]).toContain(response.status)
      }
    })
  })

  describe('POST /api/messages', () => {
    it('should create a new message for an entity', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: 'This is a test message',
          author: 'test_user',
          author_name: 'Test User',
        })
        .expect(201)

      expect(response.body).toHaveProperty('message_id')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('status', 'applied')
      expect(response.body.message_id).toMatch(/^evt_[a-z0-9]{26}$/)
    })

    it('should require entity_id', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_type: 'Account',
          text: 'Test message',
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('entity_id')
    })

    it('should require entity_type', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          text: 'Test message',
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('entity_type')
    })

    it('should require text', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('text')
    })

    it('should reject empty text', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: '   ',
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('empty')
    })

    it('should enforce character limit', async () => {
      const longText = 'a'.repeat(2001)

      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: longText,
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('2000 characters')
    })

    it('should trim whitespace from text', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: '  Test message with whitespace  ',
        })
        .expect(201)

      // Verify the event was created with trimmed text
      const events = await request(app)
        .get('/api/events?limit=1')
        .expect(200)

      const latestEvent = events.body.events[0]
      expect(latestEvent.data.text).toBe('Test message with whitespace')
    })

    it('should store message_type metadata', async () => {
      await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: 'Test message type',
        })
        .expect(201)

      // Verify the event has message_type in data
      const events = await request(app)
        .get('/api/events?limit=1')
        .expect(200)

      const latestEvent = events.body.events[0]
      expect(latestEvent.data.message_type).toBe('user_message')
    })
  })

  describe('GET /api/files', () => {
    it('should return file tree structure', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true)

      // Check that file tree has expected structure
      response.body.forEach((dir: any) => {
        expect(dir).toHaveProperty('name')
        expect(dir).toHaveProperty('path')
        expect(dir).toHaveProperty('type')
        expect(dir.type).toBe('directory')

        if (dir.children) {
          expect(Array.isArray(dir.children)).toBe(true)
          dir.children.forEach((file: any) => {
            expect(file).toHaveProperty('name')
            expect(file).toHaveProperty('path')
            expect(file).toHaveProperty('type', 'file')
            expect(file.name).toMatch(/\.md$/)
          })
        }
      })
    })

    it('should include our test account file', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(200)

      const accountsDir = response.body.find((d: any) => d.name === 'accounts')
      expect(accountsDir).toBeDefined()
      expect(accountsDir.children).toBeDefined()

      const testFile = accountsDir.children.find((f: any) =>
        f.path === testFilePath
      )
      expect(testFile).toBeDefined()
    })
  })

  describe('GET /api/files/*', () => {
    it('should return file content with frontmatter', async () => {
      const response = await request(app)
        .get(`/api/files/${testFilePath}`)
        .expect(200)

      expect(response.body).toHaveProperty('path', testFilePath)
      expect(response.body).toHaveProperty('frontmatter')
      expect(response.body).toHaveProperty('content')

      expect(response.body.frontmatter.id).toBe(testEntityId)
      expect(response.body.frontmatter.name).toBe('Activity Stream Test Account')
    })

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/accounts/nonexistent-file.md')
        .expect(404)

      expect(response.body).toHaveProperty('error', 'File not found')
    })

    it('should prevent path traversal attacks', async () => {
      const response = await request(app)
        .get('/api/files/../../../etc/passwd')

      // Should either return 403 (access denied) or 404 (file not found after resolution)
      expect([403, 404]).toContain(response.status)
    })

    it('should handle special characters in paths', async () => {
      // Just verify it doesn't crash
      await request(app)
        .get('/api/files/accounts/file%20with%20spaces.md')
    })
  })

  describe('PUT /api/files/*', () => {
    it('should update file content', async () => {
      const newContent = '# Updated Content\n\nThis is updated content.'

      const response = await request(app)
        .put(`/api/files/${testFilePath}`)
        .send({
          content: newContent,
          frontmatter: {
            id: testEntityId,
            name: 'Activity Stream Test Account',
            lifecycle_stage: 'prospect',
            type: 'Account',
          },
        })
        .expect(200)

      expect(response.body).toHaveProperty('success', true)
      expect(response.body).toHaveProperty('path', testFilePath)

      // Verify the file was actually updated
      const getResponse = await request(app)
        .get(`/api/files/${testFilePath}`)
        .expect(200)

      // Trim both to handle any trailing newline differences
      expect(getResponse.body.content.trim()).toBe(newContent.trim())
    })

    it('should require content parameter', async () => {
      const response = await request(app)
        .put(`/api/files/${testFilePath}`)
        .send({
          frontmatter: {},
        })
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('content')
    })

    it('should create event log entry for file changes', async () => {
      const newContent = '# Test Event Logging\n\nContent for event log test.'

      await request(app)
        .put(`/api/files/${testFilePath}`)
        .send({
          content: newContent,
          frontmatter: {
            id: testEntityId,
            name: 'Activity Stream Test Account',
            lifecycle_stage: 'prospect',
            type: 'Account',
          },
        })
        .expect(200)

      // Check that an event was created
      const events = await request(app)
        .get(`/api/events?limit=5`)
        .expect(200)

      const updateEvent = events.body.events.find(
        (e: any) => e.type === 'update' && e.entity_id === testEntityId
      )

      expect(updateEvent).toBeDefined()
    })

    it('should prevent path traversal in PUT', async () => {
      const response = await request(app)
        .put('/api/files/../../../tmp/malicious.md')
        .send({
          content: 'malicious content',
        })

      // Should return 400 (bad request), 403 (access denied), or 404 (not found)
      // The important thing is it doesn't succeed (200) or create the file
      expect([400, 403, 404]).toContain(response.status)
    })

    it('should handle empty content', async () => {
      const response = await request(app)
        .put(`/api/files/${testFilePath}`)
        .send({
          content: '',
          frontmatter: {
            id: testEntityId,
            name: 'Activity Stream Test Account',
            type: 'Account',
          },
        })
        .expect(200)

      expect(response.body.success).toBe(true)
    })
  })

  describe('Event Stream for Activity Feed', () => {
    it('should list messages for an entity', async () => {
      // Create a few messages
      await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: 'First message',
        })

      await request(app)
        .post('/api/messages')
        .send({
          entity_id: testEntityId,
          entity_type: 'Account',
          text: 'Second message',
        })

      // Get all recent events
      const response = await request(app)
        .get('/api/events?limit=100')
        .expect(200)

      // Filter to our entity
      const entityEvents = response.body.events.filter(
        (e: any) => e.entity_id === testEntityId
      )

      expect(entityEvents.length).toBeGreaterThan(0)

      // Should include message events
      const messageEvents = entityEvents.filter(
        (e: any) => e.data?.message_type === 'user_message'
      )

      expect(messageEvents.length).toBeGreaterThanOrEqual(2)
    })

    it('should include all event metadata', async () => {
      const response = await request(app)
        .get('/api/events?limit=100')
        .expect(200)

      const events = response.body.events.filter(
        (e: any) => e.entity_id === testEntityId
      )

      events.forEach((event: any) => {
        expect(event).toHaveProperty('event_id')
        expect(event).toHaveProperty('type')
        expect(event).toHaveProperty('entity_type')
        expect(event).toHaveProperty('entity_id')
        expect(event).toHaveProperty('status')
        expect(event).toHaveProperty('timestamp')
      })
    })
  })
})
