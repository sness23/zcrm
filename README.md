# zcrm

A filesystem-first, Obsidian-native CRM with event-sourced architecture. Your data lives as markdown files in a git-backed vault — human-readable, version-controlled, and portable. SQLite provides fast queries as a derived projection.

## Why zcrm?

**Your CRM data should be files you own**, not rows locked in someone else's database.

- **Markdown files** are the source of truth — open them in Obsidian, VS Code, or any text editor
- **Event log** captures every change immutably — complete audit trail, time-travel, replay
- **SQLite** is just a queryable view — delete it and rebuild from the event log anytime
- **Git** tracks every change — revert mistakes, see history, collaborate
- **Salesforce-compatible** entity model — Account, Contact, Opportunity, Lead, and 13 more

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

## Quickstart

```bash
# Prerequisites: Node 20+, Python 3.10+
npm install
npm run build

# Initialize vault structure and git hooks
node dist/index.js init

# Create records via CLI
node dist/index.js new account "Acme Corp"
node dist/index.js new contact --account acme-corp "Jane Doe" --email jane@acme.co
node dist/index.js new opportunity --account acme-corp "Q1 2025 Deal"

# Validate the vault
node dist/index.js validate
```

Open `vault/` as an Obsidian vault to browse your CRM with backlinks, graph view, and Dataview queries.

## REST API

```bash
# Start the API server and worker
npm run api      # Port 9600
npm run worker   # Syncs events → markdown + SQLite
```

```bash
# Create an account
curl -X POST http://localhost:9600/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"create","entity_type":"Account","data":{"name":"Acme Corp","lifecycle_stage":"prospect"}}'

# Query accounts
curl http://localhost:9600/api/entities/accounts

# Or query SQLite directly
sqlite3 vault/crm.db "SELECT name, lifecycle_stage FROM accounts"
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Create vault directory structure and default config |
| `new <type> <name>` | Create a record (auto-commits to git) |
| `validate` | Run schema + link validators |
| `install-hooks` | Enable pre-commit validation hooks |

**Entity types:** account, contact, opportunity, activity, lead, task, quote, product, campaign

**Flags:** `--no-commit` (skip git), `--no-push` (commit but don't push)

## Frontend Apps

zcrm includes 19 React + TypeScript + Vite frontend apps:

| App | Port | Description |
|-----|------|-------------|
| comms-app | 9100 | Slack-like chat with AI (Cohere) |
| tables-app | 9101 | Data grid views |
| docs-app | 9102 | Documentation viewer |
| login-app | 9103 | Supabase authentication |
| leads-app | 9105 | Lead management |
| search-app | 9106 | Search interface |
| contact-app | 9107 | Contact management |
| graph-app | 9007 | Relationship graph visualization |
| analytics-app | 9112 | Analytics dashboards |
| party-app | 9115 | Party entity management |
| ... | | and 9 more |

```bash
npm run comms:dev    # Start any app in dev mode
npm run leads:build  # Build for production
```

## Entity Model

17 Salesforce-compatible entity types with ULID IDs:

| Entity | Prefix | Directory |
|--------|--------|-----------|
| Account | `acc_` | `accounts/` |
| Contact | `con_` | `contacts/` |
| Opportunity | `opp_` | `opportunities/` |
| Lead | `led_` | `leads/` |
| Activity | `act_` | `activities/` |
| Task | `tsk_` | `tasks/` |
| Campaign | `cmp_` | `campaigns/` |
| Quote | `quo_` | `quotes/` |
| Product | `prd_` | `products/` |
| Order | `ord_` | `orders/` |
| Contract | `ctr_` | `contracts/` |
| Event | `evt_` | `events/` |
| Case | `cas_` | `cases/` |
| Knowledge | `kav_` | `knowledge/` |
| Asset | `ast_` | `assets/` |
| Party | `pty_` | `parties/` |
| Individual | `ind_` | `individuals/` |

Each entity is a markdown file with YAML frontmatter, validated against JSON Schema:

```yaml
---
id: acc_01k7djy3vnezx59arwm93xs613
type: Account
name: Acme Corp
lifecycle_stage: prospect
created_at: 2025-10-12T19:50:00.123Z
---
# Acme Corp

## Notes
- Enterprise prospect, 500+ employees
```

Entities link to each other using Obsidian wiki-links: `account: '[[accounts/acme-corp]]'`

## Data Management

```bash
npm run seed          # Seed test data
npm run reset         # Clear all vault data
npm run process-events # Replay pending events
npm run sync-files    # Sync markdown → database
npm run reseed        # Full reset + seed + process + sync
```

## Testing

```bash
npm test              # Run all vitest tests
npm run test:unit     # Unit tests only
npm run test:integration  # API integration tests
npm run test:vault    # Markdown integrity checks

# Playwright E2E (per app)
npm run test:integration:comms:headed
npm run test:integration:docs:ui
```

## Documentation

| Document | Description |
|----------|-------------|
| [Philosophy](docs/PHILOSOPHY.md) | The "Helpful Web" — our vision for ads that help instead of interrupt |
| [Architecture](docs/ARCHITECTURE.md) | The "Magic Bus" event-sourced design |
| [Vault Entities](docs/ARCHITECTURE-vault-entities.md) | Entity relationships and knowledge graph patterns |
| [REST API Design](docs/DESIGN-rest-api.md) | Event-sourced REST API architecture |
| [SQLite Sync](docs/DESIGN-sqlite-sync.md) | How the database projection works |
| [Git-Backed Vault](docs/DESIGN-git-backed-vault.md) | Automatic version control for CRM data |
| [API Quickstart](docs/API-QUICKSTART.md) | curl examples for all operations |
| [Webhooks](docs/API-WEBHOOKS.md) | Real-time notifications with HMAC signatures |
| [Salesforce Reference](docs/REFERENCE-salesforce-entities.md) | Entity type mapping to Salesforce objects |

## Key Dependencies

- `gray-matter` — YAML frontmatter parsing
- `better-sqlite3` — SQLite database
- `ajv` — JSON Schema validation
- `express` v5 — REST API
- `ws` — WebSocket server
- `cohere-ai` — AI chat integration
- `vitest` / `@playwright/test` — testing

## License

MIT
