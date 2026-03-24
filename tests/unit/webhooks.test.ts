import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebhookService } from '../../src/lib/webhooks.js'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

describe('WebhookService', () => {
  let db: Database.Database
  let webhookService: WebhookService
  const testDbPath = path.join(process.cwd(), 'test-webhooks.db')

  beforeEach(() => {
    // Create a fresh in-memory database for each test
    db = new Database(testDbPath)
    webhookService = new WebhookService(db)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  describe('Webhook Registration', () => {
    it('should register a new webhook', () => {
      const webhook = webhookService.registerWebhook(
        'https://example.com/webhook',
        ['create.*', 'update.*']
      )

      expect(webhook.id).toMatch(/^whk_/)
      expect(webhook.url).toBe('https://example.com/webhook')
      expect(webhook.events).toEqual(['create.*', 'update.*'])
      expect(webhook.active).toBe(true)
      expect(webhook.failure_count).toBe(0)
    })

    it('should register webhook with secret', () => {
      const webhook = webhookService.registerWebhook(
        'https://example.com/webhook',
        ['*'],
        'my-secret'
      )

      expect(webhook.secret).toBe('my-secret')
    })

    it('should generate unique IDs for webhooks', () => {
      const webhook1 = webhookService.registerWebhook('https://example.com/1', ['*'])
      const webhook2 = webhookService.registerWebhook('https://example.com/2', ['*'])

      expect(webhook1.id).not.toBe(webhook2.id)
    })
  })

  describe('Webhook Retrieval', () => {
    it('should list all webhooks', () => {
      webhookService.registerWebhook('https://example.com/1', ['create.*'])
      webhookService.registerWebhook('https://example.com/2', ['update.*'])

      const webhooks = webhookService.listWebhooks()

      expect(webhooks).toHaveLength(2)
      expect(webhooks[0].url).toBe('https://example.com/2') // Most recent first
      expect(webhooks[1].url).toBe('https://example.com/1')
    })

    it('should filter active webhooks only', () => {
      const webhook1 = webhookService.registerWebhook('https://example.com/1', ['*'])
      const webhook2 = webhookService.registerWebhook('https://example.com/2', ['*'])

      webhookService.updateWebhook(webhook1.id, { active: false })

      const activeWebhooks = webhookService.listWebhooks(true)

      expect(activeWebhooks).toHaveLength(1)
      expect(activeWebhooks[0].id).toBe(webhook2.id)
    })

    it('should get webhook by ID', () => {
      const registered = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const webhook = webhookService.getWebhook(registered.id)

      expect(webhook).not.toBeNull()
      expect(webhook!.id).toBe(registered.id)
      expect(webhook!.url).toBe('https://example.com/webhook')
    })

    it('should return null for non-existent webhook', () => {
      const webhook = webhookService.getWebhook('whk_nonexistent')

      expect(webhook).toBeNull()
    })
  })

  describe('Webhook Updates', () => {
    it('should update webhook URL', () => {
      const webhook = webhookService.registerWebhook('https://example.com/old', ['*'])

      const updated = webhookService.updateWebhook(webhook.id, {
        url: 'https://example.com/new',
      })

      expect(updated).toBe(true)

      const retrieved = webhookService.getWebhook(webhook.id)
      expect(retrieved!.url).toBe('https://example.com/new')
    })

    it('should update webhook events', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['create.*'])

      webhookService.updateWebhook(webhook.id, {
        events: ['update.*', 'delete.*'],
      })

      const retrieved = webhookService.getWebhook(webhook.id)
      expect(retrieved!.events).toEqual(['update.*', 'delete.*'])
    })

    it('should update webhook active status', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      webhookService.updateWebhook(webhook.id, { active: false })

      const retrieved = webhookService.getWebhook(webhook.id)
      expect(retrieved!.active).toBe(false)
    })

    it('should return false when updating non-existent webhook', () => {
      const updated = webhookService.updateWebhook('whk_nonexistent', {
        url: 'https://example.com/new',
      })

      expect(updated).toBe(false)
    })
  })

  describe('Webhook Deletion', () => {
    it('should delete webhook', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const deleted = webhookService.deleteWebhook(webhook.id)

      expect(deleted).toBe(true)

      const retrieved = webhookService.getWebhook(webhook.id)
      expect(retrieved).toBeNull()
    })

    it('should return false when deleting non-existent webhook', () => {
      const deleted = webhookService.deleteWebhook('whk_nonexistent')

      expect(deleted).toBe(false)
    })
  })

  describe('Event Matching', () => {
    it('should match exact event type', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'create.Account',
      ])

      expect(webhookService.shouldReceiveEvent(webhook, 'create.Account')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'create.Contact')).toBe(false)
      expect(webhookService.shouldReceiveEvent(webhook, 'update.Account')).toBe(false)
    })

    it('should match wildcard patterns', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['create.*'])

      expect(webhookService.shouldReceiveEvent(webhook, 'create.Account')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'create.Contact')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'update.Account')).toBe(false)
    })

    it('should match all events with *', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      expect(webhookService.shouldReceiveEvent(webhook, 'create.Account')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'update.Contact')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'delete.Opportunity')).toBe(true)
    })

    it('should match multiple patterns', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', [
        'create.*',
        'update.Account',
      ])

      expect(webhookService.shouldReceiveEvent(webhook, 'create.Account')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'create.Contact')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'update.Account')).toBe(true)
      expect(webhookService.shouldReceiveEvent(webhook, 'update.Contact')).toBe(false)
    })

    it('should not match when webhook is inactive', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])
      webhookService.updateWebhook(webhook.id, { active: false })

      const updated = webhookService.getWebhook(webhook.id)!
      expect(webhookService.shouldReceiveEvent(updated, 'create.Account')).toBe(false)
    })

    it('should get webhooks for event', () => {
      webhookService.registerWebhook('https://example.com/1', ['create.*'])
      webhookService.registerWebhook('https://example.com/2', ['update.*'])
      webhookService.registerWebhook('https://example.com/3', ['*'])

      const webhooks = webhookService.getWebhooksForEvent('create.Account')

      expect(webhooks).toHaveLength(2) // create.* and *
      expect(webhooks.some((w) => w.url === 'https://example.com/1')).toBe(true)
      expect(webhooks.some((w) => w.url === 'https://example.com/3')).toBe(true)
    })
  })

  describe('Webhook Deliveries', () => {
    it('should create delivery record', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const payload = {
        event_id: 'evt_test',
        event_type: 'create.Account',
        data: { name: 'Test' },
      }

      const delivery = webhookService.createDelivery(
        webhook.id,
        'evt_test',
        'create.Account',
        payload
      )

      expect(delivery.id).toMatch(/^wdl_/)
      expect(delivery.webhook_id).toBe(webhook.id)
      expect(delivery.event_id).toBe('evt_test')
      expect(delivery.event_type).toBe('create.Account')
      expect(delivery.status).toBe('pending')
      expect(delivery.attempts).toBe(0)
    })

    it('should get pending deliveries', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const payload = { test: true }
      const delivery1 = webhookService.createDelivery(webhook.id, 'evt_1', 'create.Account', payload)
      const delivery2 = webhookService.createDelivery(webhook.id, 'evt_2', 'create.Contact', payload)

      const pending = webhookService.getPendingDeliveries()

      expect(pending).toHaveLength(2)
      expect(pending[0].id).toBe(delivery1.id)
      expect(pending[1].id).toBe(delivery2.id)
    })

    it('should update delivery status to success', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])
      const delivery = webhookService.createDelivery(
        webhook.id,
        'evt_test',
        'create.Account',
        {}
      )

      webhookService.updateDeliveryStatus(delivery.id, 'success', 200, 'OK')

      const deliveries = webhookService.getDeliveriesForWebhook(webhook.id)
      expect(deliveries[0].status).toBe('success')
      expect(deliveries[0].response_code).toBe(200)
      expect(deliveries[0].response_body).toBe('OK')
      expect(deliveries[0].attempts).toBe(1)
    })

    it('should update delivery status to failed', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])
      const delivery = webhookService.createDelivery(
        webhook.id,
        'evt_test',
        'create.Account',
        {}
      )

      webhookService.updateDeliveryStatus(delivery.id, 'failed', 500, 'Internal Server Error', 'Connection failed')

      const deliveries = webhookService.getDeliveriesForWebhook(webhook.id)
      expect(deliveries[0].status).toBe('failed')
      expect(deliveries[0].response_code).toBe(500)
      expect(deliveries[0].error).toBe('Connection failed')
      expect(deliveries[0].attempts).toBe(1)
    })

    it('should get delivery history for webhook', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const payload = { test: true }
      webhookService.createDelivery(webhook.id, 'evt_1', 'create.Account', payload)
      webhookService.createDelivery(webhook.id, 'evt_2', 'create.Contact', payload)

      const deliveries = webhookService.getDeliveriesForWebhook(webhook.id)

      expect(deliveries).toHaveLength(2)
    })

    it('should limit delivery history', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const payload = { test: true }
      for (let i = 0; i < 10; i++) {
        webhookService.createDelivery(webhook.id, `evt_${i}`, 'create.Account', payload)
      }

      const deliveries = webhookService.getDeliveriesForWebhook(webhook.id, 5)

      expect(deliveries).toHaveLength(5)
    })
  })

  describe('Webhook Tracking', () => {
    it('should update last triggered timestamp', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      expect(webhook.last_triggered_at).toBeUndefined()

      webhookService.updateLastTriggered(webhook.id)

      const updated = webhookService.getWebhook(webhook.id)
      expect(updated!.last_triggered_at).toBeTruthy()
    })

    it('should increment failure count', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      expect(webhook.failure_count).toBe(0)

      webhookService.incrementFailureCount(webhook.id)

      const updated = webhookService.getWebhook(webhook.id)
      expect(updated!.failure_count).toBe(1)
    })

    it('should reset failure count', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      webhookService.incrementFailureCount(webhook.id)
      webhookService.incrementFailureCount(webhook.id)

      webhookService.resetFailureCount(webhook.id)

      const updated = webhookService.getWebhook(webhook.id)
      expect(updated!.failure_count).toBe(0)
    })

    it('should auto-disable webhook after 10 failures', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      // Increment failure count 10 times
      for (let i = 0; i < 10; i++) {
        webhookService.incrementFailureCount(webhook.id)
      }

      const updated = webhookService.getWebhook(webhook.id)
      expect(updated!.active).toBe(false)
      expect(updated!.failure_count).toBe(10)
    })
  })

  describe('Pending Delivery Filtering', () => {
    it('should not return deliveries with 3+ attempts', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const delivery = webhookService.createDelivery(webhook.id, 'evt_test', 'create.Account', {})

      // Simulate 3 failed attempts
      webhookService.updateDeliveryStatus(delivery.id, 'failed', 500, '', 'Attempt 1')
      webhookService.updateDeliveryStatus(delivery.id, 'failed', 500, '', 'Attempt 2')
      webhookService.updateDeliveryStatus(delivery.id, 'failed', 500, '', 'Attempt 3')

      const pending = webhookService.getPendingDeliveries()

      expect(pending).toHaveLength(0) // Should not retry after 3 attempts
    })

    it('should not return successful deliveries', () => {
      const webhook = webhookService.registerWebhook('https://example.com/webhook', ['*'])

      const delivery = webhookService.createDelivery(webhook.id, 'evt_test', 'create.Account', {})

      webhookService.updateDeliveryStatus(delivery.id, 'success', 200, 'OK')

      const pending = webhookService.getPendingDeliveries()

      expect(pending).toHaveLength(0)
    })
  })
})
