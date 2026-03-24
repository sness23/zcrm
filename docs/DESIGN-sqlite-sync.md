# Design: SQLite Database Sync

## Architecture Philosophy

**The event log is the single source of truth.** Everything else — markdown files, SQLite database — are projections of that truth.

```
                  ┌─────────────────┐
                  │   Event Log     │ ← Single Source of Truth
                  │  (Append-Only)  │
                  └────────┬────────┘
                           │
                ┌──────────┴──────────┐
                ↓                     ↓
          ┌──────────┐          ┌──────────┐
          │  Vault   │          │  SQLite  │
          │ Markdown │          │ Database │
          └──────────┘          └──────────┘
```

**Why this is better:**
- Event log is immutable and auditable
- Can rebuild any projection from scratch by replaying events
- Can add new projections (Postgres, Elasticsearch, etc.) without changing core
- Time-travel queries possible
- Complete history preserved

## SQLite Schema

Salesforce-like normalized tables with proper relationships:

```sql
-- Core tables
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT, industry TEXT, owner TEXT, lifecycle_stage TEXT,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  email TEXT, phone TEXT, title TEXT,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  name TEXT NOT NULL, stage TEXT,
  amount_acv REAL, close_date TEXT, probability REAL,
  created_at TEXT, updated_at TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Also: leads, activities, tasks, quotes, products, campaigns,
-- events, orders, contracts, assets, cases, knowledge

-- Tracking table
CREATE TABLE event_log_cursor (
  id INTEGER PRIMARY KEY,
  last_processed_event_id TEXT,
  last_processed_timestamp TEXT,
  updated_at TEXT
);
```

Key indexes on foreign keys (`account_id`), query fields (`email`, `status`, `stage`, `close_date`), and composite indexes for common joins.

## Worker Implementation

A single worker reads events and updates both markdown + SQLite atomically:

```typescript
for (const event of pendingEvents) {
  // 1. Validate against schema
  // 2. Apply to markdown file
  // 3. Apply to SQLite (in transaction)
  // 4. Git commit
  // 5. Mark event as applied
}
```

**Why single worker?** Simpler to reason about, guaranteed consistency between projections.

## Link Extraction

Markdown files use wikilinks (`[[accounts/acme-corp]]`), but SQLite needs foreign keys. The worker extracts account IDs from link syntax and resolves them to database foreign keys during sync.

## Rebuilding from Events

One of the key benefits — rebuild the entire database from scratch:

```bash
# Delete database and replay all events
npm run reset
npm run process-events

# Or combined
npm run reseed
```

## Data Consistency

- **Atomic operations**: Update both markdown and SQLite in same transaction
- **Event status**: Only mark event as "applied" after both succeed
- **Idempotent**: Re-running same event is safe (INSERT OR REPLACE)
- **Rollback on error**: If SQLite fails, event stays `pending`

## Performance

SQLite performs well up to ~100GB — more than sufficient for CRM data:
- 1M accounts × 500 bytes ≈ 500MB
- 10M contacts × 300 bytes ≈ 3GB

## Example Queries

```sql
-- Pipeline analysis
SELECT stage, COUNT(*) as count, SUM(amount_acv) as total_acv
FROM opportunities
WHERE stage NOT IN ('closed_lost', 'closed_won')
GROUP BY stage;

-- Top accounts by opportunity value
SELECT a.name, SUM(o.amount_acv) as total_acv, COUNT(o.id) as opp_count
FROM accounts a
JOIN opportunities o ON a.id = o.account_id
GROUP BY a.id, a.name
ORDER BY total_acv DESC
LIMIT 10;

-- Lead conversion rate
SELECT
  COUNT(*) as total_leads,
  SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
  ROUND(100.0 * SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
FROM leads;
```
