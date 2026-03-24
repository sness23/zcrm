import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CRMDatabase } from '../../src/lib/database.js'
import type { Event } from '../../src/lib/event-log.js'
import fs from 'fs'
import path from 'path'

const TEST_DB_PATH = path.join(process.cwd(), 'test-crm.db')

describe('CRMDatabase', () => {
  let db: CRMDatabase

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
    if (fs.existsSync(TEST_DB_PATH + '-shm')) {
      fs.unlinkSync(TEST_DB_PATH + '-shm')
    }
    if (fs.existsSync(TEST_DB_PATH + '-wal')) {
      fs.unlinkSync(TEST_DB_PATH + '-wal')
    }

    db = new CRMDatabase(TEST_DB_PATH)
  })

  afterEach(() => {
    db.close()
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
    if (fs.existsSync(TEST_DB_PATH + '-shm')) {
      fs.unlinkSync(TEST_DB_PATH + '-shm')
    }
    if (fs.existsSync(TEST_DB_PATH + '-wal')) {
      fs.unlinkSync(TEST_DB_PATH + '-wal')
    }
  })

  describe('Database Initialization', () => {
    it('should create database file', () => {
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true)
    })

    it('should create all 9 tables', () => {
      const sqlite = db.getDb()
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[]

      const tableNames = tables.map((t) => t.name)
      expect(tableNames).toContain('accounts')
      expect(tableNames).toContain('contacts')
      expect(tableNames).toContain('opportunities')
      expect(tableNames).toContain('leads')
      expect(tableNames).toContain('activities')
      expect(tableNames).toContain('tasks')
      expect(tableNames).toContain('quotes')
      expect(tableNames).toContain('products')
      expect(tableNames).toContain('campaigns')
    })

    it('should have foreign keys enabled', () => {
      const sqlite = db.getDb()
      const result = sqlite.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
      expect(result.foreign_keys).toBe(1)
    })

    it('should have WAL mode enabled', () => {
      const sqlite = db.getDb()
      const result = sqlite.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
      expect(result.journal_mode).toBe('wal')
    })
  })

  describe('Create Account', () => {
    it('should insert account into database', () => {
      const event: Event = {
        id: 'evt_test',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01test123',
          name: 'Test Corp',
          website: 'https://test.com',
          industry: 'Technology',
          lifecycle_stage: 'prospect',
          type: 'Account',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const account = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01test123') as any

      expect(account).toBeTruthy()
      expect(account.name).toBe('Test Corp')
      expect(account.website).toBe('https://test.com')
      expect(account.industry).toBe('Technology')
      expect(account.lifecycle_stage).toBe('prospect')
    })

    it('should set timestamps on account creation', () => {
      const event: Event = {
        id: 'evt_test',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01test456',
          name: 'Test Corp 2',
          type: 'Account',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const account = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01test456') as any

      expect(account.created_at).toBeTruthy()
      expect(account.updated_at).toBeTruthy()
    })
  })

  describe('Create Contact', () => {
    it('should insert contact into database', () => {
      // First create an account
      const accountEvent: Event = {
        id: 'evt_acc',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01testaccount',
          name: 'Test Account',
          type: 'Account',
        },
      }
      db.applyEvent(accountEvent)

      // Then create a contact
      const contactEvent: Event = {
        id: 'evt_con',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Contact',
        status: 'pending',
        data: {
          id: 'con_01testcontact',
          name: 'John Doe',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@test.com',
          account: '[[accounts/test-account]]',
          type: 'Contact',
        },
      }

      db.applyEvent(contactEvent)

      const sqlite = db.getDb()
      const contact = sqlite
        .prepare('SELECT * FROM contacts WHERE id = ?')
        .get('con_01testcontact') as any

      expect(contact).toBeTruthy()
      expect(contact.name).toBe('John Doe')
      expect(contact.first_name).toBe('John')
      expect(contact.last_name).toBe('Doe')
      expect(contact.email).toBe('john@test.com')
      expect(contact.account_id).toBe('acc_01testaccount')
    })
  })

  describe('Create Opportunity', () => {
    it('should insert opportunity into database', () => {
      // Create account first
      const accountEvent: Event = {
        id: 'evt_acc',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01testaccount2',
          name: 'Test Account',
          type: 'Account',
        },
      }
      db.applyEvent(accountEvent)

      // Create opportunity
      const oppEvent: Event = {
        id: 'evt_opp',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Opportunity',
        status: 'pending',
        data: {
          id: 'opp_01testopp',
          name: 'Big Deal',
          stage: 'qualification',
          amount_acv: 50000,
          close_date: '2025-12-31',
          probability: 0.5,
          account: '[[accounts/test-account]]',
          type: 'Opportunity',
        },
      }

      db.applyEvent(oppEvent)

      const sqlite = db.getDb()
      const opp = sqlite
        .prepare('SELECT * FROM opportunities WHERE id = ?')
        .get('opp_01testopp') as any

      expect(opp).toBeTruthy()
      expect(opp.name).toBe('Big Deal')
      expect(opp.stage).toBe('qualification')
      expect(opp.amount_acv).toBe(50000)
      expect(opp.probability).toBe(0.5)
      expect(opp.account_id).toBe('acc_01testaccount2')
    })
  })

  describe('Create Lead', () => {
    it('should insert lead into database', () => {
      const event: Event = {
        id: 'evt_lead',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Lead',
        status: 'pending',
        data: {
          id: 'led_01testlead',
          name: 'Jane Smith',
          email: 'jane@example.com',
          company: 'Example Corp',
          status: 'new',
          type: 'Lead',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const lead = sqlite
        .prepare('SELECT * FROM leads WHERE id = ?')
        .get('led_01testlead') as any

      expect(lead).toBeTruthy()
      expect(lead.name).toBe('Jane Smith')
      expect(lead.email).toBe('jane@example.com')
      expect(lead.company).toBe('Example Corp')
      expect(lead.status).toBe('new')
    })
  })

  describe('Create Activity', () => {
    it('should insert activity into database', () => {
      const event: Event = {
        id: 'evt_act',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Activity',
        status: 'pending',
        data: {
          id: 'act_01testact',
          name: 'Demo Call',
          kind: 'call',
          when: '2025-10-15T10:00:00Z',
          summary: 'Product demo with prospect',
          duration_min: 60,
          type: 'Activity',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const activity = sqlite
        .prepare('SELECT * FROM activities WHERE id = ?')
        .get('act_01testact') as any

      expect(activity).toBeTruthy()
      expect(activity.name).toBe('Demo Call')
      expect(activity.kind).toBe('call')
      expect(activity.duration_min).toBe(60)
    })
  })

  describe('Create Task', () => {
    it('should insert task into database', () => {
      const event: Event = {
        id: 'evt_task',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Task',
        status: 'pending',
        data: {
          id: 'tsk_01testtask',
          name: 'Follow up email',
          subject: 'RE: Demo',
          status: 'open',
          priority: 'high',
          due_date: '2025-10-20',
          type: 'Task',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const task = sqlite
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get('tsk_01testtask') as any

      expect(task).toBeTruthy()
      expect(task.name).toBe('Follow up email')
      expect(task.status).toBe('open')
      expect(task.priority).toBe('high')
    })
  })

  describe('Create Quote', () => {
    it('should insert quote into database', () => {
      // Create account and opportunity first
      const accountEvent: Event = {
        id: 'evt_acc',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01testaccount3',
          name: 'Quote Test Account',
          type: 'Account',
        },
      }
      db.applyEvent(accountEvent)

      const oppEvent: Event = {
        id: 'evt_opp',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Opportunity',
        status: 'pending',
        data: {
          id: 'opp_01testopp2',
          name: 'Quote Deal',
          type: 'Opportunity',
        },
      }
      db.applyEvent(oppEvent)

      // Create quote
      const quoteEvent: Event = {
        id: 'evt_quote',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Quote',
        status: 'pending',
        data: {
          id: 'quo_01testquote',
          name: 'Q4 2025 Quote',
          status: 'draft',
          amount: 75000,
          valid_until: '2025-12-31',
          type: 'Quote',
        },
      }

      db.applyEvent(quoteEvent)

      const sqlite = db.getDb()
      const quote = sqlite
        .prepare('SELECT * FROM quotes WHERE id = ?')
        .get('quo_01testquote') as any

      expect(quote).toBeTruthy()
      expect(quote.name).toBe('Q4 2025 Quote')
      expect(quote.status).toBe('draft')
      expect(quote.total_amount).toBe(75000)
    })
  })

  describe('Create Product', () => {
    it('should insert product into database', () => {
      const event: Event = {
        id: 'evt_prod',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Product',
        status: 'pending',
        data: {
          id: 'prd_01testprod',
          name: 'Enterprise License',
          price: 10000,
          is_active: true,
          type: 'Product',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const product = sqlite
        .prepare('SELECT * FROM products WHERE id = ?')
        .get('prd_01testprod') as any

      expect(product).toBeTruthy()
      expect(product.name).toBe('Enterprise License')
      expect(product.price).toBe(10000)
      expect(product.is_active).toBe(1)
    })
  })

  describe('Create Campaign', () => {
    it('should insert campaign into database', () => {
      const event: Event = {
        id: 'evt_camp',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Campaign',
        status: 'pending',
        data: {
          id: 'cmp_01testcamp',
          name: 'Q4 Webinar Series',
          status: 'active',
          campaign_type: 'webinar',
          start_date: '2025-10-01',
          budget: 25000,
          num_leads: 0,
          type: 'Campaign',
        },
      }

      db.applyEvent(event)

      const sqlite = db.getDb()
      const campaign = sqlite
        .prepare('SELECT * FROM campaigns WHERE id = ?')
        .get('cmp_01testcamp') as any

      expect(campaign).toBeTruthy()
      expect(campaign.name).toBe('Q4 Webinar Series')
      expect(campaign.status).toBe('active')
      expect(campaign.budget).toBe(25000)
    })
  })

  describe('Update Events', () => {
    it('should update account fields', () => {
      // Create account
      const createEvent: Event = {
        id: 'evt_create',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01updatetest',
          name: 'Update Test Corp',
          lifecycle_stage: 'prospect',
          type: 'Account',
        },
      }
      db.applyEvent(createEvent)

      // Update account
      const updateEvent: Event = {
        id: 'evt_update',
        timestamp: new Date().toISOString(),
        type: 'update',
        entity_id: 'acc_01updatetest',
        status: 'pending',
        changes: {
          lifecycle_stage: 'customer',
          owner: 'Alice Smith',
        },
      }
      db.applyEvent(updateEvent)

      const sqlite = db.getDb()
      const account = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01updatetest') as any

      expect(account.lifecycle_stage).toBe('customer')
      expect(account.owner).toBe('Alice Smith')
      expect(account.name).toBe('Update Test Corp') // Unchanged field
    })

    it('should update updated_at timestamp', async () => {
      const createEvent: Event = {
        id: 'evt_create',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01timestamptest',
          name: 'Timestamp Test',
          type: 'Account',
        },
      }
      db.applyEvent(createEvent)

      const sqlite = db.getDb()
      const before = sqlite
        .prepare('SELECT updated_at FROM accounts WHERE id = ?')
        .get('acc_01timestamptest') as any

      // Wait a moment to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updateEvent: Event = {
        id: 'evt_update',
        timestamp: new Date().toISOString(),
        type: 'update',
        entity_id: 'acc_01timestamptest',
        status: 'pending',
        changes: {
          lifecycle_stage: 'customer',
        },
      }
      db.applyEvent(updateEvent)

      const after = sqlite
        .prepare('SELECT updated_at FROM accounts WHERE id = ?')
        .get('acc_01timestamptest') as any

      expect(after.updated_at).not.toBe(before.updated_at)
    })
  })

  describe('Delete Events', () => {
    it('should delete account from database', () => {
      // Create account
      const createEvent: Event = {
        id: 'evt_create',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01deletetest',
          name: 'Delete Test Corp',
          type: 'Account',
        },
      }
      db.applyEvent(createEvent)

      // Verify it exists
      const sqlite = db.getDb()
      let account = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01deletetest') as any
      expect(account).toBeTruthy()

      // Delete account
      const deleteEvent: Event = {
        id: 'evt_delete',
        timestamp: new Date().toISOString(),
        type: 'delete',
        entity_id: 'acc_01deletetest',
        status: 'pending',
      }
      db.applyEvent(deleteEvent)

      // Verify it's gone
      account = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01deletetest') as any
      expect(account).toBeUndefined()
    })
  })

  describe('Bulk Events', () => {
    it('should apply multiple operations in bulk', () => {
      const bulkEvent: Event = {
        id: 'evt_bulk',
        timestamp: new Date().toISOString(),
        type: 'bulk',
        status: 'pending',
        operations: [
          {
            id: 'evt_bulk_1',
            timestamp: new Date().toISOString(),
            type: 'create',
            entity_type: 'Account',
            status: 'pending',
            data: {
              id: 'acc_01bulk1',
              name: 'Bulk Account 1',
              type: 'Account',
            },
          },
          {
            id: 'evt_bulk_2',
            timestamp: new Date().toISOString(),
            type: 'create',
            entity_type: 'Account',
            status: 'pending',
            data: {
              id: 'acc_01bulk2',
              name: 'Bulk Account 2',
              type: 'Account',
            },
          },
        ],
      }

      db.applyEvent(bulkEvent)

      const sqlite = db.getDb()
      const account1 = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01bulk1') as any
      const account2 = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01bulk2') as any

      expect(account1).toBeTruthy()
      expect(account1.name).toBe('Bulk Account 1')
      expect(account2).toBeTruthy()
      expect(account2.name).toBe('Bulk Account 2')
    })
  })

  describe('Link Extraction', () => {
    it('should extract account ID from wikilink', () => {
      // Create account
      const accountEvent: Event = {
        id: 'evt_acc',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01linktest',
          name: 'Link Test Account',
          type: 'Account',
        },
      }
      db.applyEvent(accountEvent)

      // Create contact with wikilink
      const contactEvent: Event = {
        id: 'evt_con',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Contact',
        status: 'pending',
        data: {
          id: 'con_01linktest',
          name: 'Link Test Contact',
          first_name: 'Link',
          last_name: 'Test',
          account: '[[accounts/link-test-account]]',
          type: 'Contact',
        },
      }
      db.applyEvent(contactEvent)

      const sqlite = db.getDb()
      const contact = sqlite
        .prepare('SELECT * FROM contacts WHERE id = ?')
        .get('con_01linktest') as any

      expect(contact.account_id).toBe('acc_01linktest')
    })

    it('should handle missing account link gracefully', () => {
      const contactEvent: Event = {
        id: 'evt_con',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Contact',
        status: 'pending',
        data: {
          id: 'con_01nolink',
          name: 'No Link Contact',
          first_name: 'No',
          last_name: 'Link',
          type: 'Contact',
        },
      }

      db.applyEvent(contactEvent)

      const sqlite = db.getDb()
      const contact = sqlite
        .prepare('SELECT * FROM contacts WHERE id = ?')
        .get('con_01nolink') as any

      expect(contact).toBeTruthy()
      expect(contact.account_id).toBeNull()
    })
  })

  describe('ID to Table Mapping', () => {
    it('should map account ID prefix to accounts table', () => {
      const event: Event = {
        id: 'evt_test',
        timestamp: new Date().toISOString(),
        type: 'create',
        entity_type: 'Account',
        status: 'pending',
        data: {
          id: 'acc_01prefix',
          name: 'Prefix Test',
          type: 'Account',
        },
      }
      db.applyEvent(event)

      // Update should work based on ID prefix
      const updateEvent: Event = {
        id: 'evt_update',
        timestamp: new Date().toISOString(),
        type: 'update',
        entity_id: 'acc_01prefix',
        status: 'pending',
        changes: {
          lifecycle_stage: 'customer',
        },
      }
      db.applyEvent(updateEvent)

      const sqlite = db.getDb()
      const account = sqlite
        .prepare('SELECT * FROM accounts WHERE id = ?')
        .get('acc_01prefix') as any
      expect(account.lifecycle_stage).toBe('customer')
    })
  })
})
