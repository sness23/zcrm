/**
 * Bulk import/export functionality for CRM data
 */
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import type Database from 'better-sqlite3'
import { ulid } from 'ulidx'

export interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export class ImportExportService {
  constructor(private db: Database.Database) {}

  /**
   * Import accounts from CSV
   * Expected columns: name, website, industry, owner, lifecycle_stage
   */
  importAccounts(csvData: string): ImportResult {
    const result: ImportResult = { success: 0, failed: 0, errors: [] }

    try {
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })

      const stmt = this.db.prepare(`
        INSERT INTO accounts (id, name, website, industry, owner, lifecycle_stage, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const transaction = this.db.transaction((rows: any[]) => {
        for (const row of rows) {
          try {
            const now = new Date().toISOString()
            stmt.run(
              'acc_' + ulid().toLowerCase(),
              row.name || '',
              row.website || null,
              row.industry || null,
              row.owner || null,
              row.lifecycle_stage || 'prospect',
              now,
              now
            )
            result.success++
          } catch (error: any) {
            result.failed++
            result.errors.push(`Row ${result.success + result.failed}: ${error.message}`)
          }
        }
      })

      transaction(records)
    } catch (error: any) {
      result.errors.push(`Parse error: ${error.message}`)
    }

    return result
  }

  /**
   * Import contacts from CSV
   * Expected columns: first_name, last_name, email, phone, title, company_name
   */
  importContacts(csvData: string): ImportResult {
    const result: ImportResult = { success: 0, failed: 0, errors: [] }

    try {
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })

      const stmt = this.db.prepare(`
        INSERT INTO contacts (id, name, first_name, last_name, email, phone, title, account_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const transaction = this.db.transaction((rows: any[]) => {
        for (const row of rows) {
          try {
            const now = new Date().toISOString()
            const name = `${row.first_name || ''} ${row.last_name || ''}`.trim()

            // Try to find account by company name
            let accountId = null
            if (row.company_name) {
              const account: any = this.db
                .prepare('SELECT id FROM accounts WHERE name = ? LIMIT 1')
                .get(row.company_name)
              accountId = account?.id || null
            }

            stmt.run(
              'con_' + ulid().toLowerCase(),
              name,
              row.first_name || null,
              row.last_name || null,
              row.email || null,
              row.phone || null,
              row.title || null,
              accountId,
              now,
              now
            )
            result.success++
          } catch (error: any) {
            result.failed++
            result.errors.push(`Row ${result.success + result.failed}: ${error.message}`)
          }
        }
      })

      transaction(records)
    } catch (error: any) {
      result.errors.push(`Parse error: ${error.message}`)
    }

    return result
  }

  /**
   * Import opportunities from CSV
   * Expected columns: name, company_name, stage, amount_acv, close_date, probability
   */
  importOpportunities(csvData: string): ImportResult {
    const result: ImportResult = { success: 0, failed: 0, errors: [] }

    try {
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })

      const stmt = this.db.prepare(`
        INSERT INTO opportunities (id, name, account_id, stage, amount_acv, close_date, probability, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const transaction = this.db.transaction((rows: any[]) => {
        for (const row of rows) {
          try {
            const now = new Date().toISOString()

            // Find account by company name
            let accountId = null
            if (row.company_name) {
              const account: any = this.db
                .prepare('SELECT id FROM accounts WHERE name = ? LIMIT 1')
                .get(row.company_name)
              accountId = account?.id || null
            }

            stmt.run(
              'opp_' + ulid().toLowerCase(),
              row.name || '',
              accountId,
              row.stage || 'qualification',
              parseFloat(row.amount_acv) || null,
              row.close_date || null,
              parseFloat(row.probability) || null,
              now,
              now
            )
            result.success++
          } catch (error: any) {
            result.failed++
            result.errors.push(`Row ${result.success + result.failed}: ${error.message}`)
          }
        }
      })

      transaction(records)
    } catch (error: any) {
      result.errors.push(`Parse error: ${error.message}`)
    }

    return result
  }

  /**
   * Export accounts to CSV
   */
  exportAccounts(): string {
    const accounts = this.db
      .prepare(
        `
      SELECT id, name, website, industry, owner, lifecycle_stage, created_at, updated_at
      FROM accounts
      ORDER BY created_at DESC
    `
      )
      .all()

    return stringify(accounts, { header: true })
  }

  /**
   * Export contacts to CSV
   */
  exportContacts(): string {
    const contacts = this.db
      .prepare(
        `
      SELECT
        c.id, c.name, c.first_name, c.last_name, c.email, c.phone, c.title,
        a.name as company_name,
        c.created_at, c.updated_at
      FROM contacts c
      LEFT JOIN accounts a ON c.account_id = a.id
      ORDER BY c.created_at DESC
    `
      )
      .all()

    return stringify(contacts, { header: true })
  }

  /**
   * Export opportunities to CSV
   */
  exportOpportunities(): string {
    const opportunities = this.db
      .prepare(
        `
      SELECT
        o.id, o.name,
        a.name as company_name,
        o.stage, o.amount_acv, o.close_date, o.probability,
        o.created_at, o.updated_at
      FROM opportunities o
      LEFT JOIN accounts a ON o.account_id = a.id
      ORDER BY o.created_at DESC
    `
      )
      .all()

    return stringify(opportunities, { header: true })
  }

  /**
   * Export all data as JSON
   */
  exportAllJSON(): {
    accounts: any[]
    contacts: any[]
    opportunities: any[]
    leads: any[]
    activities: any[]
    tasks: any[]
  } {
    return {
      accounts: this.db.prepare('SELECT * FROM accounts').all(),
      contacts: this.db.prepare('SELECT * FROM contacts').all(),
      opportunities: this.db.prepare('SELECT * FROM opportunities').all(),
      leads: this.db.prepare('SELECT * FROM leads').all(),
      activities: this.db.prepare('SELECT * FROM activities').all(),
      tasks: this.db.prepare('SELECT * FROM tasks').all(),
    }
  }

  /**
   * Get import statistics
   */
  getImportStats(): {
    total_accounts: number
    total_contacts: number
    total_opportunities: number
    total_leads: number
  } {
    return {
      total_accounts: (this.db.prepare('SELECT COUNT(*) as count FROM accounts').get() as any)
        .count,
      total_contacts: (this.db.prepare('SELECT COUNT(*) as count FROM contacts').get() as any)
        .count,
      total_opportunities: (
        this.db.prepare('SELECT COUNT(*) as count FROM opportunities').get() as any
      ).count,
      total_leads: (this.db.prepare('SELECT COUNT(*) as count FROM leads').get() as any).count,
    }
  }
}
