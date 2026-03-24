# Design: REST API with Event-Sourced Architecture

## Overview

The REST API receives client requests and writes immutable events to a markdown-based event log. A separate worker process reads events and applies them to the vault.

```
┌─────────────┐
│ REST Client │
└──────┬──────┘
       │ POST /api/events
       ▼
┌──────────────────┐
│   REST API       │──┐
│   (Express.js)   │  │ Append event
└──────────────────┘  │
                      ▼
              ┌───────────────┐
              │  Event Log    │ (immutable, append-only)
              │  _logs/*.md   │
              └───────┬───────┘
                      │ Read & Process
                      ▼
              ┌───────────────┐
              │ Worker Process│
              └───────┬───────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
    Validate    Apply Diff    Git Commit
                      │
                      ▼
              ┌───────────────┐
              │   Vault/*.md  │
              └───────────────┘
```

## Event Types

### Create Entity
```json
{
  "type": "create",
  "entity_type": "Account",
  "data": {
    "name": "Acme Corp",
    "lifecycle_stage": "prospect"
  }
}
```

### Update Entity
```json
{
  "type": "update",
  "entity_id": "acc_01k7...",
  "changes": {
    "lifecycle_stage": "customer"
  }
}
```

### Delete Entity
```json
{
  "type": "delete",
  "entity_id": "acc_01k7..."
}
```

### Bulk Operation
```json
{
  "type": "bulk",
  "operations": [
    {"type": "create", "entity_type": "Account", "data": {...}},
    {"type": "update", "entity_id": "acc_01k7...", "changes": {...}}
  ]
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/events` | Create a new event |
| `GET` | `/api/events` | List recent events (filter by `status`, `limit`, `days`) |
| `GET` | `/api/events/:id` | Get event details |
| `GET` | `/api/entities/:type` | List entities of a type |
| `GET` | `/api/entities/:type/:id` | Get a specific entity |
| `PATCH` | `/api/entities/:type/:id` | Update an entity |
| `POST` | `/api/validate` | Validate without committing |

## Worker Process

The worker:
1. Watches event log for new `pending` events
2. Validates each event against JSON schemas
3. Applies changes to vault markdown files
4. Applies changes to SQLite database
5. Git commits with event reference
6. Updates event status to `applied` or `failed`

### Error Handling

- **Validation failure**: Event marked `failed`, not applied to vault
- **Git failure**: Warning logged, event still applied to file
- **Worker crash**: Events remain `pending`, resumed from last checkpoint
- **Idempotent operations**: Re-running same event is safe

## Why Markdown Event Logs?

1. **Human-readable**: Open in any editor or Obsidian
2. **Machine-parseable**: Structured with clear delimiters
3. **Git-friendly**: Text diffs work well in version control
4. **Auditable**: Full history of all operations
5. **Debuggable**: Can manually inspect and replay events

## Validation Layer

Two-layer validation enforced before any write:

1. **Schema Validation** — Frontmatter checked against JSON Schema (AJV)
2. **Business Rules** — ID prefix format, no duplicate IDs, linked entities exist, file path available

```typescript
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
```

## Security

- **Append-only event log**: No deletions, git tracks all changes
- **ULID event IDs**: Collision-resistant
- **Worker is the only vault writer**: API has read-only access to vault files
- **Validation before any writes**: Schema + business rules checked first
