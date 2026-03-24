# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

zcrm is a filesystem-first, Obsidian-native AI CRM system using **event-sourced architecture** where Markdown files are the human-readable projection and SQLite provides queryable data. The event log (`vault/_logs/*.md`) is the single source of truth.

**Core Philosophy:**
- Event log = immutable source of truth
- Markdown files = human-readable projection (Obsidian-compatible)
- SQLite database = queryable projection (normalized tables)
- Git-backed vault for version control
- JSON Schema validation for data integrity

## Build and Run Commands

```bash
# Core CLI
npm run build                    # Build TypeScript CLI to dist/
npm run dev -- [command]         # Run CLI directly during development
node dist/index.js [command]     # Run compiled CLI

# Backend Services
npm run api                      # Start REST API server (port 9600, or PORT env var)
npm run api:dev                  # Start API in dev mode with tsx
npm run worker                   # Start event worker (syncs events → markdown + SQLite)
npm run worker:dev               # Start worker in dev mode

# Data Management
npm run seed                     # Seed test data
npm run seed:slow                # Seed with delays (for testing real-time updates)
npm run seed:real                # Seed with real production data
npm run seed:metrics             # Seed metrics data
npm run seed:feeds               # Seed RSS feeds
npm run import-scholars          # Import scholar data (use BATCH_SIZE, MIN_H_INDEX, DRY_RUN env vars)
npm run reset                    # Clear all vault data
npm run process-events           # Process pending events
npm run sync-files               # Sync all markdown files to database
npm run reseed                   # reset + seed + process-events + sync-files
npm run reseed:slow              # Full reseed with slow seeding
npm run reseed:real              # reset + seed:real + process-events + sync-files
npm run start                    # Start all services (API + worker + frontend apps)

# Frontend Apps (see "Frontend Apps" section for full list)
npm run [app]:dev                # Start app dev server (e.g., npm run leads:dev)
npm run [app]:build              # Build app for production
npm run [app]:preview            # Preview production build

# Elasticsearch
npm run es:dev                   # Start ES app dev server
npm run es:index                 # Index data to Elasticsearch

# Testing
npm test                         # Run all vitest tests
npm run test:watch               # Run tests in watch mode
npm run test:coverage            # Run tests with coverage report
npm run test:unit                # Run unit tests only
npm run test:validators          # Run validator tests only
npm run test:vault               # Run vault integrity tests
npm run test:integration         # Run integration tests

# Playwright E2E Tests (per-app)
npm run test:integration:[app]          # Run tests headless
npm run test:integration:[app]:headed   # Run with visible browser
npm run test:integration:[app]:ui       # Interactive test explorer
npm run test:integration:[app]:debug    # Step-through debugging
# Available apps: docs, comms, tables, search, root, contact, login, analytics, leads, party

# User Flow Tests
npm run test:flow:main           # Main navigation flow (all apps)
npm run test:flow:main:headed    # Same, with visible browser
npm run test:flow:main:ui        # Interactive test explorer
npm run test:flow:main:debug     # Step-through debugging

# Run All Integration Tests
npm run test:integration:all:headed  # Run all app tests sequentially

# Git Hooks
npm run hooks:enable             # Enable git hooks
npm run hooks:disable            # Disable git hooks
npm run hooks:status             # Check hook status
```

## CLI Commands

The `fscrm` CLI (compiled to `dist/index.js`) provides:

```bash
# Initialize vault structure
node dist/index.js init

# Create new records
node dist/index.js new account "Company Name"
node dist/index.js new contact --account acme-co "Jane Doe" --email jane@example.com
node dist/index.js new opportunity --account acme-co "2025 Deal"
node dist/index.js new lead "Sarah Johnson" --email sarah@example.com --company "TechCo"

# Git integration flags
--no-commit    # Create file but don't commit to git
--no-push      # Commit but don't push to remote

# Validation
node dist/index.js validate      # Run frontmatter + link validators

# Git hooks
node dist/index.js install-hooks # Install pre-commit/pre-push hooks

# Cleanup
node dist/index.js clean --force # Clear all vault data
```

## Architecture

### Event-Sourced Design

```
Client → REST API → Event Log (immutable, append-only)
                         ↓
                    Worker Process
                         ↓
                   ┌─────┴─────┐
                   ↓           ↓
              Markdown      SQLite
               Files       Database
                   ↓
                  Git
```

**Event Flow:**
1. Events created via REST API (`POST /api/events`) or CLI
2. Events written to `vault/_logs/*.md` (one file per day)
3. Worker reads pending events from log
4. Worker applies events to both:
   - Markdown files in `vault/{entity-type}/*.md` (via `gray-matter`)
   - SQLite database in `vault/crm.db` (via `better-sqlite3`)
5. Git commits markdown changes
6. Event marked as `applied` or `failed`

**Benefits:**
- Complete audit trail of all operations
- Can rebuild markdown or SQLite from event log
- Both projections stay in sync automatically
- Time-travel queries possible
- Easy to add new projections (Postgres, Elasticsearch, etc.)

### Vault Structure

```
vault/
  _schemas/           # JSON Schema definitions (AJV validation)
  _hooks/             # Git hooks (validate_frontmatter.mjs, validate_links.py)
  _automation/        # AI agent configs and prompts
  _logs/              # Event log (source of truth)
    *.md              # Daily event log files (YYYY-MM-DD.md)
    channels.db       # Channel messages database
  _indexes/           # Generated indexes
  settings/           # Config files (crm.yaml)
  accounts/           # Account markdown records
  contacts/           # Contact markdown records
  opportunities/      # Opportunity markdown records
  activities/         # Activity markdown records
  leads/              # Lead markdown records
  tasks/              # Task markdown records
  quotes/             # Quote markdown records
  products/           # Product markdown records
  campaigns/          # Campaign markdown records
  events/             # Event markdown records
  orders/             # Order markdown records
  contracts/          # Contract markdown records
  assets/             # Asset markdown records
  cases/              # Case markdown records
  knowledge/          # Knowledge article markdown records
  line-items/         # Opportunity line items
  quote-lines/        # Quote line items
  crm.db              # SQLite database projection
  changes.log         # Change log (tracked by worker)
```

### Entity Types (17 total)

Salesforce-compatible entities with ULID IDs and type prefixes:

| Entity Type | Prefix | Directory | Description |
|-------------|--------|-----------|-------------|
| Account | `acc_` | accounts/ | Companies/organizations |
| Contact | `con_` | contacts/ | People (linked to accounts) |
| Opportunity | `opp_` | opportunities/ | Sales deals |
| Activity | `act_` | activities/ | Meetings, calls, notes |
| Lead | `led_` | leads/ | Prospective customers |
| Task | `tsk_` | tasks/ | To-do items |
| Quote | `quo_` | quotes/ | Price quotes |
| Product | `prd_` | products/ | Catalog items |
| Campaign | `cmp_` | campaigns/ | Marketing campaigns |
| OpportunityLineItem | `oli_` | line-items/ | Opportunity products |
| QuoteLineItem | `qli_` | quote-lines/ | Quote products |
| Event | `evt_` | events/ | Calendar events |
| Order | `ord_` | orders/ | Customer orders |
| Contract | `ctr_` | contracts/ | Legal agreements |
| Asset | `ast_` | assets/ | Purchased products |
| Case | `cas_` | cases/ | Support cases |
| Knowledge | `kav_` | knowledge/ | KB articles |

### Data Model

**Frontmatter (YAML):**
- Validated against JSON Schemas in `vault/_schemas/{Type}.schema.json`
- Uses `gray-matter` for parsing/serialization
- Required fields: `id`, `type`, `name` (or entity-specific fields)

**Typed Links:**
- Syntax: `[[folder/slug]]` (Obsidian-native)
- Example: `[[accounts/acme-co]]` for account reference
- Link validation via `vault/_hooks/validate_links.py`

**IDs:**
- ULID-based with type prefixes (generated by `idFor(kind)`)
- Example: `acc_01hmexz5kz2q9w3n0y7g8r6ktb`

**File Naming:**
- kebab-case slugs (via `slugify()`)
- Example: `acme-corp.md` for "Acme Corp"

### Key Implementation Files

**Core CLI (`src/index.ts`):**
- `ensureVault()` — Creates vault directory structure
- `idFor(kind)` — Generates ULID with type prefix
- `slugify(s)` — Converts names to kebab-case filenames
- `writeMarkdown()` — Serializes frontmatter + body with `gray-matter`
- `gitCommitAndPush()` — Auto-commits to vault git repo

**REST API (`src/api.ts`):**
- Express server on port 9600 (default, configurable via PORT env var)
- Event creation: `POST /api/events`
- Entity queries: `GET /api/entities/{type}`
- WebSocket server for real-time updates
- Channel messaging endpoints
- AI chat integration with Cohere
- Vault file serving via `/vault/` endpoint

**Integrations (`src/integrations/`, `src/services/`):**
- **ORCID** (`src/integrations/orcid/`) — Scholar identity enrichment
- **Cohere** (`src/services/cohere.ts`) — AI chat and tool calling
- **Discord** (`src/services/discord.ts`, `src/db/discord-sync.ts`) — Bot and message sync
- **Elasticsearch** (`src/lib/elasticsearch.ts`) — Search indexing
- **Gmail** (`src/lib/gmail.ts`) — Email integration
- **RSS Feeds** (`src/lib/rss-feeds.ts`) — News aggregation

**Worker (`src/worker.ts`):**
- Reads `vault/changes.log` for new events
- Syncs markdown files to SQLite database
- Uses `CRMDatabase.applyEvent()` for all DB operations
- Tracks processed log entries

**Database (`src/lib/database.ts`):**
- `CRMDatabase` class wraps `better-sqlite3`
- `applyEvent()` — Central event handler for all entity types
- `applyCreate()`, `applyUpdate()`, `applyDelete()` — Operation handlers
- Schema defined in `createTables()`

**Event Log (`src/lib/event-log.ts`):**
- `EventLog` class manages `vault/_logs/*.md` files
- `createEvent()` — Appends events to daily log
- `getPendingEvents()` — Returns unapplied events
- Event types: `create`, `update`, `delete`, `batch`

**Validation (`src/lib/validation.ts`):**
- `Validator` class using AJV for JSON Schema validation
- `validateEvent()` — Validates events before processing
- `validateFrontmatter()` — Validates markdown frontmatter
- Integration with `vault/_hooks/validate_frontmatter.mjs`

### SQLite Schema

Normalized Salesforce-like tables with foreign keys:

```sql
-- Core tables: accounts, contacts, opportunities, leads,
-- activities, tasks, quotes, products, campaigns

-- Relationship tables: line_items, quote_lines

-- Extended tables: events, orders, contracts, assets,
-- cases, knowledge

-- Metadata: event_log_cursor (tracks processed events)
```

See `docs/DESIGN-sqlite-sync.md` for complete schema.

### Validation System

Two-layer validation enforced by git hooks:

1. **Frontmatter validation** (`vault/_hooks/validate_frontmatter.mjs`):
   - Node.js script using AJV
   - Validates YAML frontmatter against JSON Schemas
   - Checks required fields, types, patterns (e.g., ID prefixes)

2. **Link validation** (`vault/_hooks/validate_links.py`):
   - Python script for link integrity
   - Extracts typed links from file bodies and frontmatter
   - Verifies target files exist in correct directories
   - Prevents dangling references

Run both with: `npm run validate` or `node dist/index.js validate`

### Frontend Apps

Multiple Vite apps in `*-app/` directories (dev server ports from vite.config.ts):

| App | Port | Subdomain | Description |
|-----|------|-----------|-------------|
| graph-app | 9007 | — | Graph visualization |
| news-app | 9008 | — | News aggregation |
| comms-app | 9100 | comms.doi.bio | Slack-like chat (WebSocket + Cohere AI) |
| tables-app | 9101 | tables.doi.bio | Data table/grid views |
| docs-app | 9102 | docs.doi.bio | Documentation viewer |
| login-app | 9103 | login.doi.bio | Supabase authentication |
| earn-app | 9104 | — | Earnings tracking |
| leads-app | 9105 | leads.doi.bio | Lead management |
| search-app | 9106 | — | Search interface |
| contact-app | 9107 | — | Contact management |
| vid-app | 9109 | doi.bio, www.doi.bio | Main website |
| es-app | 9110 | — | Elasticsearch interface |
| email-app | 9111 | — | Email integration |
| analytics-app | 9112 | — | Analytics dashboard |
| ads-app | 9113 | — | Advertising management |
| blog-app | 9114 | — | Blog publishing |
| party-app | 9115 | — | Party/entity management |
| obsidian-app | 9116 | — | Obsidian integration |
| pocketz-app | 5173 | — | Pocket integration (Vite default) |
| cli-app | — | — | CLI tool (not a web app) |

Each app:
- Built with React + TypeScript + Vite
- Proxies `/api/` requests to API server (port 9600)
- Uses Supabase for authentication
- Independent `package.json` and config

**Comms-App AI Commands:**

The comms-app supports AI assistance via Cohere using the following syntax:

```bash
%co <query>         # Ask Cohere AI anything
%ask <query>        # Alias for %co
%explain <topic>    # Request detailed explanation
%summarize <text>   # Request concise summary
```

Examples:
```bash
%co what is this account about?
%ask summarize the last 5 activities
%explain opportunity stages
%summarize this conversation
```

**Legacy Support:** The old `@c` prefix still works but shows a deprecation warning. Use `%co` to avoid conflicts with Discord/Slack mentions.

See `comms-app/CLAUDE.md` for full documentation.

### Testing Strategy

**Vitest (unit + integration):**
- `tests/unit/` — Unit tests for utilities, database, webhooks
- `tests/vault/` — Markdown integrity, schema compliance
- `tests/validators/` — Frontmatter validation tests
- `tests/integration/` — API integration tests
- Coverage config in `vitest.config.ts`

**Playwright (E2E):**
- `playwright.config.docs.ts` — Docs app E2E tests
- `playwright.config.comms.ts` — Comms app E2E tests
- `playwright.config.tables.ts` — Tables app E2E tests
- Latency tests in `tests/latency/`

Run with specific npm scripts (see "Build and Run Commands" above).

## Git Workflow

**Vault as Git Repo:**
- `vault/` should be initialized as git repo
- CLI auto-commits on record creation (unless `--no-commit`)
- Commit message format: `"Create {EntityType}: {name}"`
- Auto-pushes to remote (unless `--no-push`)

**Git Hooks:**
- Pre-commit: Run validators (frontmatter + links)
- Pre-push: Additional validation
- Install: `node dist/index.js install-hooks`
- Hooks located in `vault/_hooks/`

## Obsidian Integration

Open `vault/` as an Obsidian vault to:
- Visualize backlinks between entities
- Use Dataview queries for dashboards
- Navigate typed links (`Cmd+Click` on `[[accounts/acme-co]]`)
- Leverage templates for consistent record creation
- View git history per file

## Important Notes

**Event-Sourced Architecture:**
- Never modify markdown files or SQLite directly
- Always create events via API or CLI
- Worker syncs events to both projections
- Event log is immutable (append-only)

**Type Mappings:**
```typescript
KIND_DIR = {
  account: "accounts",
  contact: "contacts",
  opportunity: "opportunities",
  activity: "activities",
  lead: "leads",
  task: "tasks",
  quote: "quotes",
  product: "products",
  campaign: "campaigns",
  "line-item": "line-items",
  "quote-line": "quote-lines",
  event: "events",
  order: "orders",
  contract: "contracts",
  asset: "assets",
  case: "cases",
  knowledge: "knowledge"
}
```

**Database Location:**
- Main CRM database: `vault/crm.db`
- Channels database: `vault/_logs/channels.db`

**Environment:**
- TypeScript: ES2022 modules with strict mode
- Node.js: 20+
- Python: 3.10+ (for link validator)

## Common Development Tasks

**Adding a New Entity Type:**
1. Add entry to `KIND_DIR` in `src/index.ts`
2. Create JSON Schema in `vault/_schemas/{Entity}.schema.json`
3. Add ID prefix to `idFor()` function
4. Add table creation in `src/lib/database.ts:createTables()`
5. Add case to `applyCreate()`, `applyUpdate()`, `applyDelete()`
6. Update validators to include new entity type
7. Update this documentation

**Rebuilding Database from Events:**
```bash
# Clear database
npm run reset

# Replay all events
npm run process-events

# Or use combined command
npm run reseed
```

**Testing Real-Time Updates:**
```bash
# Terminal 1: Start API
npm run api

# Terminal 2: Start worker
npm run worker

# Terminal 3: Start frontend app
cd comms-app && npm run dev

# Terminal 4: Create events
node dist/index.js new account "Test Corp"
```

## Key Dependencies

- `gray-matter` — YAML frontmatter parsing/serialization
- `better-sqlite3` — SQLite database
- `ajv` — JSON Schema validation
- `cohere-ai` — AI chat and tool calling
- `express` v5 — REST API server
- `ws` — WebSocket server
- `vitest` / `@playwright/test` — Testing

See `package.json` for complete dependency list.
