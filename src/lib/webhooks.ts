/**
 * Webhook management and delivery system
 */
import Database from 'better-sqlite3'
import { ulid } from 'ulidx'

export interface Webhook {
  id: string
  url: string
  events: string[] // Event types to subscribe to (e.g., ['create.Account', 'update.Contact'])
  secret?: string // Optional secret for HMAC signature verification
  active: boolean
  created_at: string
  updated_at: string
  last_triggered_at?: string
  failure_count: number
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event_id: string
  event_type: string
  payload: any
  status: 'pending' | 'success' | 'failed'
  response_code?: number
  response_body?: string
  error?: string
  attempts: number
  created_at: string
  delivered_at?: string
}

export class WebhookService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.initTables()
  }

  private initTables(): void {
    // Webhooks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL, -- JSON array of event patterns
        secret TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_triggered_at TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0
      )
    `)

    // Webhook deliveries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL, -- JSON
        status TEXT NOT NULL DEFAULT 'pending',
        response_code INTEGER,
        response_body TEXT,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
      )
    `)

    // Index for faster queries
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status
      ON webhook_deliveries(status, created_at)
    `)
  }

  /**
   * Register a new webhook
   */
  registerWebhook(url: string, events: string[], secret?: string): Webhook {
    const now = new Date().toISOString()
    const webhook: Webhook = {
      id: 'whk_' + ulid().toLowerCase(),
      url,
      events,
      secret,
      active: true,
      created_at: now,
      updated_at: now,
      failure_count: 0,
    }

    this.db
      .prepare(
        `
      INSERT INTO webhooks (id, url, events, secret, active, created_at, updated_at, failure_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        webhook.id,
        webhook.url,
        JSON.stringify(webhook.events),
        webhook.secret || null,
        webhook.active ? 1 : 0,
        webhook.created_at,
        webhook.updated_at,
        webhook.failure_count
      )

    return webhook
  }

  /**
   * List all webhooks
   */
  listWebhooks(activeOnly = false): Webhook[] {
    const query = activeOnly
      ? 'SELECT * FROM webhooks WHERE active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM webhooks ORDER BY created_at DESC'

    const rows = this.db.prepare(query).all() as any[]

    return rows.map((row) => ({
      id: row.id,
      url: row.url,
      events: JSON.parse(row.events),
      secret: row.secret,
      active: row.active === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_triggered_at: row.last_triggered_at,
      failure_count: row.failure_count,
    }))
  }

  /**
   * Get webhook by ID
   */
  getWebhook(id: string): Webhook | null {
    const row = this.db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any

    if (!row) return null

    return {
      id: row.id,
      url: row.url,
      events: JSON.parse(row.events),
      secret: row.secret,
      active: row.active === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_triggered_at: row.last_triggered_at,
      failure_count: row.failure_count,
    }
  }

  /**
   * Update webhook
   */
  updateWebhook(id: string, updates: Partial<Pick<Webhook, 'url' | 'events' | 'secret' | 'active'>>): boolean {
    const webhook = this.getWebhook(id)
    if (!webhook) return false

    const now = new Date().toISOString()
    const fields: string[] = []
    const values: any[] = []

    if (updates.url !== undefined) {
      fields.push('url = ?')
      values.push(updates.url)
    }
    if (updates.events !== undefined) {
      fields.push('events = ?')
      values.push(JSON.stringify(updates.events))
    }
    if (updates.secret !== undefined) {
      fields.push('secret = ?')
      values.push(updates.secret || null)
    }
    if (updates.active !== undefined) {
      fields.push('active = ?')
      values.push(updates.active ? 1 : 0)
    }

    if (fields.length === 0) return false

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.prepare(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return true
  }

  /**
   * Delete webhook
   */
  deleteWebhook(id: string): boolean {
    const result = this.db.prepare('DELETE FROM webhooks WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Create webhook delivery record
   */
  createDelivery(webhookId: string, eventId: string, eventType: string, payload: any): WebhookDelivery {
    const now = new Date().toISOString()
    const delivery: WebhookDelivery = {
      id: 'wdl_' + ulid().toLowerCase(),
      webhook_id: webhookId,
      event_id: eventId,
      event_type: eventType,
      payload,
      status: 'pending',
      attempts: 0,
      created_at: now,
    }

    this.db
      .prepare(
        `
      INSERT INTO webhook_deliveries
      (id, webhook_id, event_id, event_type, payload, status, attempts, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        delivery.id,
        delivery.webhook_id,
        delivery.event_id,
        delivery.event_type,
        JSON.stringify(delivery.payload),
        delivery.status,
        delivery.attempts,
        delivery.created_at
      )

    return delivery
  }

  /**
   * Update delivery status
   */
  updateDeliveryStatus(
    deliveryId: string,
    status: 'success' | 'failed',
    responseCode?: number,
    responseBody?: string,
    error?: string
  ): void {
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
      UPDATE webhook_deliveries
      SET status = ?, response_code = ?, response_body = ?, error = ?,
          attempts = attempts + 1, delivered_at = ?
      WHERE id = ?
    `
      )
      .run(status, responseCode || null, responseBody || null, error || null, now, deliveryId)
  }

  /**
   * Get pending deliveries
   */
  getPendingDeliveries(limit = 100): WebhookDelivery[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM webhook_deliveries
      WHERE status = 'pending' AND attempts < 3
      ORDER BY created_at ASC
      LIMIT ?
    `
      )
      .all(limit) as any[]

    return rows.map((row) => ({
      id: row.id,
      webhook_id: row.webhook_id,
      event_id: row.event_id,
      event_type: row.event_type,
      payload: JSON.parse(row.payload),
      status: row.status,
      response_code: row.response_code,
      response_body: row.response_body,
      error: row.error,
      attempts: row.attempts,
      created_at: row.created_at,
      delivered_at: row.delivered_at,
    }))
  }

  /**
   * Get deliveries for a webhook
   */
  getDeliveriesForWebhook(webhookId: string, limit = 50): WebhookDelivery[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM webhook_deliveries
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(webhookId, limit) as any[]

    return rows.map((row) => ({
      id: row.id,
      webhook_id: row.webhook_id,
      event_id: row.event_id,
      event_type: row.event_type,
      payload: JSON.parse(row.payload),
      status: row.status,
      response_code: row.response_code,
      response_body: row.response_body,
      error: row.error,
      attempts: row.attempts,
      created_at: row.created_at,
      delivered_at: row.delivered_at,
    }))
  }

  /**
   * Update webhook last triggered time
   */
  updateLastTriggered(webhookId: string): void {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE webhooks SET last_triggered_at = ? WHERE id = ?').run(now, webhookId)
  }

  /**
   * Increment failure count for webhook
   */
  incrementFailureCount(webhookId: string): void {
    this.db
      .prepare(
        `
      UPDATE webhooks
      SET failure_count = failure_count + 1,
          active = CASE WHEN failure_count + 1 >= 10 THEN 0 ELSE active END
      WHERE id = ?
    `
      )
      .run(webhookId)
  }

  /**
   * Reset failure count
   */
  resetFailureCount(webhookId: string): void {
    this.db.prepare('UPDATE webhooks SET failure_count = 0 WHERE id = ?').run(webhookId)
  }

  /**
   * Check if webhook should receive event
   */
  shouldReceiveEvent(webhook: Webhook, eventType: string): boolean {
    if (!webhook.active) return false

    // Check if event type matches any of the webhook's event patterns
    return webhook.events.some((pattern) => {
      // Exact match
      if (pattern === eventType) return true

      // Wildcard match (e.g., "create.*" matches "create.Account")
      if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2)
        return eventType.startsWith(prefix + '.')
      }

      // Match all events
      if (pattern === '*') return true

      return false
    })
  }

  /**
   * Get webhooks that should receive an event
   */
  getWebhooksForEvent(eventType: string): Webhook[] {
    const webhooks = this.listWebhooks(true)
    return webhooks.filter((wh) => this.shouldReceiveEvent(wh, eventType))
  }

  /**
   * Deliver webhook via HTTP POST
   */
  async deliverWebhook(webhook: Webhook, delivery: WebhookDelivery): Promise<void> {
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Zax-CRM-Webhook/1.0',
          'X-Webhook-ID': webhook.id,
          'X-Event-ID': delivery.event_id,
          'X-Event-Type': delivery.event_type,
          ...(webhook.secret && {
            'X-Webhook-Signature': this.generateSignature(webhook.secret, delivery.payload),
          }),
        },
        body: JSON.stringify(delivery.payload),
      })

      const responseBody = await response.text()

      if (response.ok) {
        this.updateDeliveryStatus(delivery.id, 'success', response.status, responseBody)
        this.updateLastTriggered(webhook.id)
        this.resetFailureCount(webhook.id)
      } else {
        this.updateDeliveryStatus(
          delivery.id,
          'failed',
          response.status,
          responseBody,
          `HTTP ${response.status}`
        )
        this.incrementFailureCount(webhook.id)
      }
    } catch (error: any) {
      this.updateDeliveryStatus(delivery.id, 'failed', undefined, undefined, error.message)
      this.incrementFailureCount(webhook.id)
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(secret: string, payload: any): string {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(JSON.stringify(payload))
    return hmac.digest('hex')
  }

  /**
   * Process all pending deliveries
   */
  async processPendingDeliveries(): Promise<void> {
    const deliveries = this.getPendingDeliveries()

    for (const delivery of deliveries) {
      const webhook = this.getWebhook(delivery.webhook_id)
      if (!webhook || !webhook.active) {
        // Mark as failed if webhook was deleted or disabled
        this.updateDeliveryStatus(delivery.id, 'failed', undefined, undefined, 'Webhook inactive')
        continue
      }

      await this.deliverWebhook(webhook, delivery)
    }
  }
}
