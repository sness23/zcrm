# Architecture: The "Magic Bus" Event Log

## Overview

zcrm is built on a **filesystem-first, event-sourced architecture** where:

1. **Text files are the Single Source of Truth** — Markdown files with YAML frontmatter in `vault/` contain all CRM data
2. **Immutable append-only log files** — JSONL-formatted `changes.log` records all file modifications
3. **Object-based organization** — One directory per entity type, one file per object
4. **Asynchronous event processing** — Worker watches logs and syncs to SQLite database
5. **Audit trail built-in** — All operations logged to timestamped event logs

## The Dual-Projection Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. MARKDOWN FILES (vault/*.md)                                │
│     Single Source of Truth (SSOT)                              │
│     - Human-readable text format                               │
│     - Version controlled in git                                │
│     - Obsidian-compatible                                      │
│                                                                 │
│                           ▲                                     │
│                           │                                     │
│            ┌──────────────┴──────────────┐                     │
│            │                             │                      │
│            │ 1. API writes entity        │ 2. Worker reads      │
│            │ 2. logChange() appends      │    changes.log       │
│            │    to changes.log           │    and processes     │
│            │                             │                      │
│            ▼                             ▼                      │
│                                                                 │
│  2. CHANGES.LOG (append-only JSONL)                            │
│     Audit trail of all file modifications                      │
│     - Never updated, only appended                             │
│     - Watched by worker process                                │
│     - Source of truth for sync                                 │
│                                                                 │
│                           ▼                                     │
│                                                                 │
│  3. EVENT LOGS (_logs/events-*.md)                             │
│     Structured event records with metadata                     │
│     - One file per day                                         │
│     - Status tracking (pending/applied/failed)                 │
│     - Full CRUD operation details                              │
│                                                                 │
│                           ▼                                     │
│                                                                 │
│  4. SQLite DATABASE (crm.db) — READ-ONLY PROJECTION           │
│     - Derived from markdown files                              │
│     - Built via event processing                               │
│     - Used for fast queries in UI                              │
│     - Can be regenerated from markdown                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Event Log Format

### Primary Log: `vault/changes.log`

JSONL (JSON Lines) — one JSON object per line, immutable append-only:

```json
{"action":"write","filePath":"accounts/acme-corp.md","timestamp":"2025-11-01T06:13:35.720Z"}
{"action":"write","filePath":"contacts/john-doe.md","timestamp":"2025-11-01T06:13:35.721Z"}
{"action":"delete","filePath":"leads/old-lead.md","timestamp":"2025-11-01T06:13:35.722Z"}
```

### Secondary Logs: `vault/_logs/events-YYYY-MM-DD.md`

Markdown with embedded JSON — one file per day:

```markdown
## Event evt_01ABCDEF123456

**Timestamp:** 2025-11-01T06:13:35.720Z
**Type:** create
**Entity:** Contact
**Entity ID:** con_01K8Z0SGZC70Y0FG
**File:** contacts/alex-rives.md
**Status:** applied

### Data

\```json
{
  "id": "con_01K8Z0SGZC70Y0FG",
  "name": "Alex Rives",
  "email": "alex@example.com",
  "title": "Research Scientist"
}
\```
```

## Processing Flow

**Scenario: User creates a new Contact via API**

1. **API receives REST request** — `POST /api/events`
2. **Event created** with status `pending` in `vault/_logs/events-YYYY-MM-DD.md`
3. **Entity markdown file written** — `vault/contacts/john-doe.md`
4. **Change logged** to `vault/changes.log` (JSONL append)
5. **Worker detects change** (watches `changes.log`)
6. **Worker reads markdown file** and parses frontmatter via `gray-matter`
7. **Worker applies event to SQLite** via `crmDb.applyEvent()`
8. **Event status updated** to `applied`

## Entity File Format

Each entity is a markdown file with YAML frontmatter:

```yaml
---
id: con_01k8z0sgzc70y0fgdgffkw10h7
name: Alex Rives
first_name: Alex
last_name: Rives
email: alex@evolutionaryscale.ai
title: Research Scientist
account: '[[accounts/evolutionaryscale]]'
type: Contact
created_at: 2025-11-01T06:13:35.725Z
updated_at: 2025-11-01T06:13:35.725Z
---

# Alex Rives

## Notes
- Experienced in machine learning for protein design
```

**Key conventions:**
- `id` — ULID with type prefix (`con_`, `acc_`, `opp_`, etc.)
- `type` — Entity type name
- Links — Obsidian wiki-links: `[[accounts/acme-corp]]`
- Timestamps — ISO 8601
- Body — Markdown notes and rich text

## Vault Directory Structure

```
vault/
├── accounts/           # One .md file per Account
├── contacts/           # One .md file per Contact
├── opportunities/      # One .md file per Opportunity
├── leads/              # One .md file per Lead
├── activities/         # One .md file per Activity
├── tasks/              # One .md file per Task
├── quotes/             # One .md file per Quote
├── products/           # One .md file per Product
├── campaigns/          # One .md file per Campaign
├── events/             # Calendar events
├── orders/             # Customer orders
├── contracts/          # Legal agreements
├── assets/             # Purchased products
├── cases/              # Support cases
├── knowledge/          # KB articles
├── parties/            # Universal party entities
├── individuals/        # Person-specific data
├── organizations/      # Company/institution data
├── _schemas/           # JSON Schema definitions (AJV validation)
├── _hooks/             # Git hooks (frontmatter & link validators)
├── _logs/              # Event log (source of truth)
│   ├── events-*.md     # Daily event logs
│   └── channels/       # Channel message logs
├── _indexes/           # Generated indexes
├── settings/           # Config files
├── changes.log         # Master append-only change log (JSONL)
├── crm.db              # SQLite projection (derived, rebuildable)
└── crm.db-wal          # WAL mode files for concurrent access
```

## Event Types

| Type | Description |
|------|-------------|
| `create` | New entity created |
| `update` | Existing entity modified |
| `delete` | Entity removed |
| `bulk` | Multiple operations in one transaction |

**Status lifecycle:** `pending` → `applied` or `failed`

## The "Magic Bus"

The "bus" is `changes.log`:
- **One-way channel** from API → Worker
- **JSONL format** — simple, streaming-friendly
- **Append-only** — immutable and safe
- **Watched continuously** — real-time processing

It keeps markdown files and database in sync without complex message queues or distributed systems — just files and timestamps.

## Why This Works

1. **Single Source of Truth**: Markdown files are human-readable, version-controlled, and portable
2. **Immutable Audit Trail**: `changes.log` provides complete history of all operations
3. **Eventual Consistency**: Worker syncs asynchronously, system converges naturally
4. **Simplicity**: No complex message queues — just files and timestamps
5. **Resilience**: Data never lost, can be recovered from git history or logs
6. **Flexibility**: Can add new projections (Postgres, Elasticsearch) without changing core
7. **Replay & Recovery**: Delete `crm.db` and let worker replay all events to rebuild
8. **Time Travel**: Can reconstruct state at any historical point

## Key Implementation Files

| File | Purpose |
|------|---------|
| `src/api.ts` | REST API server, creates events |
| `src/worker.ts` | File watcher, syncs changes to DB |
| `src/index.ts` | CLI tool |
| `src/lib/event-log.ts` | Event log management |
| `src/lib/database.ts` | SQLite operations and event application |
| `src/lib/validation.ts` | Schema validation (AJV) |
