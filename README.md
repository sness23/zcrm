# Zax CRM

Filesystem-first, Obsidian-native AI CRM (SSOT). This repo contains:
- A sample Obsidian vault structure with 9 Salesforce-compatible entity types
- JSON Schemas for core entities
- Git-backed vault with automatic version control
- Git hook validators (frontmatter & link checks)
- A minimal TypeScript CLI (`zcrm`) to scaffold records, validate, and install hooks
- A Postgres adapter stub

## Quickstart

```bash
# 1) Install Node 20+ and Python 3.10+
cd zcrm

# 2) Install CLI deps
npm i

# 3) Build CLI
npm run build

# 4) Initialize the vault & install git hooks
node dist/index.js init

# 5) (Optional) Set up git for the vault
cd vault
git init
git remote add origin <your-vault-repo-url>
cd ..

# 6) Create sample records (auto-commits & pushes if vault is git repo)
node dist/index.js new account "Acme Co"
node dist/index.js new contact --account acme-co "Jane Doe" --email jane@acme.example

# 7) Validate the vault
node dist/index.js validate

# 8) (Optional) Link git hooks into .git/hooks
node dist/index.js install-hooks
```

Open `vault/` as an Obsidian vault.

---

## CLI Commands

- `init` — ensure folder layout, write default config.
- `new <entity-type> <name>` — create a record from a template.
  - **Entity types**: account, contact, opportunity, activity, lead, task, quote, product, campaign
  - **Git flags**: `--no-commit` (skip git), `--no-push` (commit but don't push)
  - **Examples**:
    - `new account "Acme Corp"`
    - `new contact --account acme-corp "Jane Doe" --email jane@acme.co`
    - `new opportunity --account acme-corp "Q1 2025 Deal"`
    - `new lead "Sarah Johnson" --email sarah@example.com --company "TechCo"`
- `validate` — run schema + link validators.
- `install-hooks` — symlink `vault/_hooks/*` into `.git/hooks/`.
- `sync postgres` — stub for DB mirror (dry run).

## REST API

The CRM includes a REST API with event-sourced architecture for programmatic access.

### Start API Server

```bash
npm run api
# API available at http://localhost:3000
```

### Start Worker Process

```bash
npm run worker
# Processes events and updates both markdown files AND SQLite database
# Database created at vault/crm.db
```

### Quick Example

```bash
# Create an account via API
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"create","entity_type":"Account","data":{"name":"Acme Corp","lifecycle_stage":"prospect"}}'

# List recent events
curl http://localhost:3000/api/events

# Get all accounts
curl http://localhost:3000/api/entities/accounts

# Query SQLite database directly
sqlite3 vault/crm.db "SELECT name, lifecycle_stage FROM accounts LIMIT 5"
```

**See:**
- `docs/QUICKSTART-rest-api.md` for complete REST API documentation
- `docs/DESIGN-sqlite-sync.md` for SQLite architecture details

---

## Architecture

**Event Log = Single Source of Truth**

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

The system uses an **event-sourced architecture**:
1. **Event Log** (`vault/_logs/*.md`) is the immutable source of truth
2. **Worker** reads events and applies them to:
   - **Markdown files** in `vault/` (human-readable, Obsidian-compatible)
   - **SQLite database** in `vault/crm.db` (queryable, normalized tables)
3. **Git** tracks all changes to markdown files

**Benefits:**
- Complete audit trail of all operations
- Can rebuild markdown or SQLite from event log
- Both projections stay in sync automatically
- Easy to add more projections (Postgres, Elasticsearch, etc.)

## Design Notes

- **Event-Sourced**: Event log is single source of truth; markdown and SQLite are projections
- **Git-Backed Vault**: Each entity creation automatically commits with message `"Create Account: Acme Corp"`
- **Schema Validation**: Frontmatter validated by JSON Schema (AJV); link integrity checked by Python
- **Obsidian-Native Links**: Wikilinks use `[[folder/slug]]` format (e.g., `[[accounts/acme-corp]]`)
- **SQLite Database**: Normalized Salesforce-like tables for rich SQL queries
- **ULID IDs**: IDs use ULID prefixes: `acc_`, `con_`, `opp_`, `act_`, `led_`, `tsk_`, `quo_`, `prd_`, `cmp_`
- **9 Entity Types**: Account, Contact, Opportunity, Activity, Lead, Task, Quote, Product, Campaign
- **TypeScript Types**: Strong typing throughout with JSON Schema validation

MIT License.
