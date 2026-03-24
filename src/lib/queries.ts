/**
 * Pre-built SQL queries for CRM analytics
 */
import type Database from 'better-sqlite3'

export interface PipelineStage {
  stage: string
  count: number
  total_value: number
  avg_probability: number
}

export interface AccountsByStage {
  lifecycle_stage: string
  count: number
}

export interface RecentActivity {
  id: string
  name: string
  kind: string
  when_timestamp: string
  duration_min: number
}

export interface LeadConversion {
  status: string
  count: number
}

export interface TopAccount {
  id: string
  name: string
  industry: string
  lifecycle_stage: string
  total_opportunities: number
  total_value: number
}

export interface OverdueTask {
  id: string
  name: string
  subject: string
  priority: string
  due_date: string
  days_overdue: number
}

export interface ContactActivity {
  contact_id: string
  contact_name: string
  account_name: string
  activity_count: number
  last_activity: string
}

export interface RevenueForecast {
  month: string
  expected_revenue: number
  weighted_revenue: number
  deal_count: number
}

export class QueryService {
  constructor(private db: Database.Database) {}

  /**
   * Get pipeline value by stage
   */
  getPipelineValue(): PipelineStage[] {
    const query = `
      SELECT
        stage,
        COUNT(*) as count,
        COALESCE(SUM(amount_acv), 0) as total_value,
        COALESCE(AVG(probability), 0) as avg_probability
      FROM opportunities
      WHERE stage != 'closed_lost' AND stage != 'closed_won'
      GROUP BY stage
      ORDER BY total_value DESC
    `

    return this.db.prepare(query).all() as PipelineStage[]
  }

  /**
   * Get accounts grouped by lifecycle stage
   */
  getAccountsByStage(): AccountsByStage[] {
    const query = `
      SELECT
        COALESCE(lifecycle_stage, 'unknown') as lifecycle_stage,
        COUNT(*) as count
      FROM accounts
      GROUP BY lifecycle_stage
      ORDER BY count DESC
    `

    return this.db.prepare(query).all() as AccountsByStage[]
  }

  /**
   * Get recent activities (last N days)
   */
  getRecentActivities(days: number = 7): RecentActivity[] {
    const query = `
      SELECT
        id,
        name,
        kind,
        when_timestamp,
        duration_min
      FROM activities
      WHERE when_timestamp >= date('now', '-${days} days')
      ORDER BY when_timestamp DESC
      LIMIT 50
    `

    return this.db.prepare(query).all() as RecentActivity[]
  }

  /**
   * Get lead conversion statistics
   */
  getLeadConversion(): LeadConversion[] {
    const query = `
      SELECT
        COALESCE(status, 'unknown') as status,
        COUNT(*) as count
      FROM leads
      GROUP BY status
      ORDER BY count DESC
    `

    return this.db.prepare(query).all() as LeadConversion[]
  }

  /**
   * Get top accounts by opportunity value
   */
  getTopAccounts(limit: number = 10): TopAccount[] {
    const query = `
      SELECT
        a.id,
        a.name,
        a.industry,
        a.lifecycle_stage,
        COUNT(o.id) as total_opportunities,
        COALESCE(SUM(o.amount_acv), 0) as total_value
      FROM accounts a
      LEFT JOIN opportunities o ON a.id = o.account_id
      GROUP BY a.id, a.name, a.industry, a.lifecycle_stage
      ORDER BY total_value DESC
      LIMIT ?
    `

    return this.db.prepare(query).all(limit) as TopAccount[]
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(): OverdueTask[] {
    const query = `
      SELECT
        id,
        name,
        subject,
        priority,
        due_date,
        CAST(julianday('now') - julianday(due_date) as INTEGER) as days_overdue
      FROM tasks
      WHERE due_date < date('now')
        AND status != 'completed'
      ORDER BY priority DESC, due_date ASC
    `

    return this.db.prepare(query).all() as OverdueTask[]
  }

  /**
   * Get contact engagement (activity count)
   */
  getContactActivity(limit: number = 20): ContactActivity[] {
    const query = `
      SELECT
        c.id as contact_id,
        c.name as contact_name,
        a.name as account_name,
        COUNT(act.id) as activity_count,
        MAX(act.when_timestamp) as last_activity
      FROM contacts c
      LEFT JOIN accounts a ON c.account_id = a.id
      LEFT JOIN activities act ON act.name LIKE '%' || c.name || '%'
      GROUP BY c.id, c.name, a.name
      HAVING activity_count > 0
      ORDER BY activity_count DESC, last_activity DESC
      LIMIT ?
    `

    return this.db.prepare(query).all(limit) as ContactActivity[]
  }

  /**
   * Get revenue forecast by month
   */
  getRevenueForecast(months: number = 6): RevenueForecast[] {
    const query = `
      SELECT
        strftime('%Y-%m', close_date) as month,
        SUM(amount_acv) as expected_revenue,
        SUM(amount_acv * probability) as weighted_revenue,
        COUNT(*) as deal_count
      FROM opportunities
      WHERE close_date >= date('now')
        AND close_date <= date('now', '+${months} months')
        AND stage != 'closed_lost'
      GROUP BY strftime('%Y-%m', close_date)
      ORDER BY month ASC
    `

    return this.db.prepare(query).all() as RevenueForecast[]
  }

  /**
   * Get closed won deals summary
   */
  getClosedWonSummary(): {
    total_deals: number
    total_value: number
    avg_deal_size: number
  } {
    const query = `
      SELECT
        COUNT(*) as total_deals,
        COALESCE(SUM(amount_acv), 0) as total_value,
        COALESCE(AVG(amount_acv), 0) as avg_deal_size
      FROM opportunities
      WHERE stage = 'closed_won'
    `

    return this.db.prepare(query).get() as any
  }

  /**
   * Get sales velocity (average days to close)
   */
  getSalesVelocity(): {
    avg_days_to_close: number
    deal_count: number
  } {
    const query = `
      SELECT
        AVG(CAST(julianday(close_date) - julianday(created_at) as INTEGER)) as avg_days_to_close,
        COUNT(*) as deal_count
      FROM opportunities
      WHERE stage = 'closed_won'
        AND created_at IS NOT NULL
        AND close_date IS NOT NULL
    `

    return this.db.prepare(query).get() as any
  }

  /**
   * Get win rate by stage
   */
  getWinRate(): {
    total_opportunities: number
    closed_won: number
    closed_lost: number
    win_rate: number
  } {
    const query = `
      SELECT
        COUNT(*) as total_opportunities,
        SUM(CASE WHEN stage = 'closed_won' THEN 1 ELSE 0 END) as closed_won,
        SUM(CASE WHEN stage = 'closed_lost' THEN 1 ELSE 0 END) as closed_lost,
        CAST(SUM(CASE WHEN stage = 'closed_won' THEN 1 ELSE 0 END) as FLOAT) /
          NULLIF(SUM(CASE WHEN stage IN ('closed_won', 'closed_lost') THEN 1 ELSE 0 END), 0) * 100 as win_rate
      FROM opportunities
    `

    return this.db.prepare(query).get() as any
  }

  /**
   * Execute custom SQL query (with restrictions for safety)
   */
  executeCustomQuery(sql: string): any[] {
    // Only allow SELECT queries
    const trimmed = sql.trim().toUpperCase()
    if (!trimmed.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed')
    }

    // Prevent multiple statements
    if (sql.includes(';') && sql.indexOf(';') !== sql.lastIndexOf(';')) {
      throw new Error('Multiple statements not allowed')
    }

    try {
      return this.db.prepare(sql).all()
    } catch (error: any) {
      throw new Error(`Query error: ${error.message}`)
    }
  }
}
