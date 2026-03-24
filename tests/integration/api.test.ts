import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs'
import path from 'path'

// Import the app (we'll need to export it from api.ts)
// For now, we'll create a test instance
import { EventLog } from '../../src/lib/event-log.js'
import { Validator } from '../../src/lib/validation.js'

const VAULT = path.join(process.cwd(), 'vault')

// Create a simple test app
function createTestApp() {
  const app = express()
  app.use(express.json())

  const eventLog = new EventLog(VAULT)
  const validator = new Validator(VAULT)

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.post('/api/events', async (req, res) => {
    try {
      const { type, entity_type, entity_id, data, changes } = req.body

      if (!type) {
        return res.status(400).json({ error: 'type is required' })
      }

      const tempEvent: any = {
        id: 'temp',
        timestamp: new Date().toISOString(),
        type,
        entity_type,
        entity_id,
        data,
        changes,
        status: 'pending',
      }

      const validation = await validator.validateEvent(tempEvent)

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: validation.errors,
        })
      }

      const event = await eventLog.createEvent(type, {
        entity_type,
        entity_id,
        data,
        changes,
      })

      res.status(201).json({
        event_id: event.id,
        status: 'queued',
        timestamp: event.timestamp,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.get('/api/events', async (req, res) => {
    try {
      const { limit = '50', status, days = '7' } = req.query

      let events = await eventLog.getRecentEvents(
        parseInt(days as string),
        status as any
      )

      const limitNum = parseInt(limit as string)
      events = events.slice(0, limitNum)

      res.json({
        events: events.map((e) => ({
          event_id: e.id,
          type: e.type,
          entity_type: e.entity_type,
          status: e.status,
          timestamp: e.timestamp,
        })),
        count: events.length,
      })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.get('/api/events/:event_id', async (req, res) => {
    try {
      const { event_id } = req.params
      const events = await eventLog.getRecentEvents(7)
      const event = events.find((e) => e.id === event_id)

      if (!event) {
        return res.status(404).json({ error: 'Event not found' })
      }

      res.json(event)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  app.post('/api/validate', async (req, res) => {
    try {
      const { type, entity_type, data } = req.body

      if (!type) {
        return res.status(400).json({ error: 'type is required' })
      }

      const tempEvent: any = {
        id: 'temp',
        timestamp: new Date().toISOString(),
        type,
        entity_type,
        data,
        status: 'pending',
      }

      const validation = await validator.validateEvent(tempEvent)
      res.json(validation)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  return app
}

describe('REST API Integration Tests', () => {
  let app: express.Application
  let testEventId: string

  beforeAll(() => {
    app = createTestApp()
  })

  afterAll(() => {
    // Clean up test event log file
    const today = new Date().toISOString().slice(0, 10)
    const logPath = path.join(VAULT, '_logs', `events-${today}.md`)

    if (fs.existsSync(logPath)) {
      // Read and filter out test events
      let content = fs.readFileSync(logPath, 'utf8')

      // Remove test events (those with "API Integration Test" in the name)
      const sections = content.split(/^## Event /m)
      const header = sections[0]
      const filtered = sections.slice(1).filter(section => {
        return !section.includes('API Integration Test')
      })

      if (filtered.length > 0) {
        content = header + filtered.map(s => '## Event ' + s).join('')
        fs.writeFileSync(logPath, content, 'utf8')
      } else {
        // If no events left, remove the file
        fs.unlinkSync(logPath)
      }
    }
  })

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
    })
  })

  describe('POST /api/events - Create Event', () => {
    it('should create a new account creation event', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          type: 'create',
          entity_type: 'Account',
          data: {
            name: 'API Integration Test Account',
            lifecycle_stage: 'prospect',
          },
        })
        .expect(201)

      expect(response.body).toHaveProperty('event_id')
      expect(response.body).toHaveProperty('status', 'queued')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body.event_id).toMatch(/^evt_[a-z0-9]{26}$/)

      // Save for later tests
      testEventId = response.body.event_id
    })

    it('should reject event without type', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          entity_type: 'Account',
          data: { name: 'Test' },
        })
        .expect(400)

      expect(response.body).toHaveProperty('error', 'type is required')
    })

    it('should reject event with invalid entity type', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          type: 'create',
          entity_type: 'InvalidType',
          data: { name: 'Test' },
        })
        .expect(400)

      expect(response.body).toHaveProperty('error', 'Validation failed')
      expect(response.body.errors).toContain('Unknown entity type: InvalidType')
    })

    it('should reject event with missing required fields', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({
          type: 'create',
          entity_type: 'Account',
          data: {
            phone: '555-1234',
            // Missing 'name' field (required)
          },
        })
        .expect(400)

      expect(response.body).toHaveProperty('error', 'Validation failed')
      // AJV error format: " must have required property 'name'"
      expect(response.body.errors[0]).toMatch(/name/)
    })
  })

  describe('GET /api/events - List Events', () => {
    it('should list recent events', async () => {
      const response = await request(app)
        .get('/api/events')
        .expect(200)

      expect(response.body).toHaveProperty('events')
      expect(response.body).toHaveProperty('count')
      expect(Array.isArray(response.body.events)).toBe(true)

      // Should include our test event
      const testEvent = response.body.events.find(
        (e: any) => e.event_id === testEventId
      )
      expect(testEvent).toBeDefined()
      expect(testEvent.type).toBe('create')
      expect(testEvent.entity_type).toBe('Account')
    })

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/events?limit=5')
        .expect(200)

      expect(response.body.events.length).toBeLessThanOrEqual(5)
    })

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/events?status=pending')
        .expect(200)

      response.body.events.forEach((event: any) => {
        expect(event.status).toBe('pending')
      })
    })
  })

  describe('GET /api/events/:event_id - Get Event Details', () => {
    it('should get event by ID', async () => {
      const response = await request(app)
        .get(`/api/events/${testEventId}`)
        .expect(200)

      expect(response.body).toHaveProperty('id', testEventId)
      expect(response.body).toHaveProperty('type', 'create')
      expect(response.body).toHaveProperty('entity_type', 'Account')
      expect(response.body).toHaveProperty('status', 'pending')
      expect(response.body.data).toHaveProperty('name', 'API Integration Test Account')
    })

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/api/events/evt_00000000000000000000000000')
        .expect(404)

      expect(response.body).toHaveProperty('error', 'Event not found')
    })
  })

  describe('POST /api/validate - Validate Event', () => {
    it('should validate a valid create event', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({
          type: 'create',
          entity_type: 'Account',
          data: {
            name: 'Valid Account',
            lifecycle_stage: 'customer',
          },
        })
        .expect(200)

      expect(response.body).toHaveProperty('valid', true)
      expect(response.body).toHaveProperty('errors')
      expect(response.body.errors).toHaveLength(0)
    })

    it('should reject invalid data', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({
          type: 'create',
          entity_type: 'Account',
          data: {
            // Missing required 'name' field
            lifecycle_stage: 'prospect',
          },
        })
        .expect(200)

      expect(response.body).toHaveProperty('valid', false)
      expect(response.body.errors.length).toBeGreaterThan(0)
    })

    it('should require type parameter', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({
          entity_type: 'Account',
          data: { name: 'Test' },
        })
        .expect(400)

      expect(response.body).toHaveProperty('error', 'type is required')
    })
  })

  describe('Event Log Persistence', () => {
    it('should persist events to markdown log file', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const logPath = path.join(VAULT, '_logs', `events-${today}.md`)

      expect(fs.existsSync(logPath)).toBe(true)

      const content = fs.readFileSync(logPath, 'utf8')

      // Check for event header
      expect(content).toContain(`## Event ${testEventId}`)
      expect(content).toContain('**Type:** create')
      expect(content).toContain('**Entity:** Account')
      expect(content).toContain('**Status:** pending')
      expect(content).toContain('API Integration Test Account')
    })
  })
})
