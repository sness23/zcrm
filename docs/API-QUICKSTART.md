# API Quickstart

## Start the Services

```bash
# Terminal 1: Start API server
npm run api        # Production mode (port 9600)
npm run api:dev    # Development mode with auto-reload

# Terminal 2: Start worker
npm run worker     # Processes events → markdown + SQLite
npm run worker:dev # Development mode
```

## Create Entities

All mutations go through the event log:

```bash
# Create an account
curl -X POST http://localhost:9600/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "create",
    "entity_type": "Account",
    "data": {
      "name": "Acme Corporation",
      "lifecycle_stage": "prospect"
    }
  }'

# Response:
# {"event_id":"evt_01k7...","status":"queued","timestamp":"2025-10-12T19:50:00.123Z"}
```

### Update an Entity

```bash
curl -X POST http://localhost:9600/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "update",
    "entity_id": "acc_01k7...",
    "changes": {
      "lifecycle_stage": "customer"
    }
  }'
```

### Delete an Entity

```bash
curl -X POST http://localhost:9600/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "delete",
    "entity_id": "acc_01k7..."
  }'
```

### Bulk Operations

```bash
curl -X POST http://localhost:9600/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "bulk",
    "operations": [
      {"type": "create", "entity_type": "Account", "data": {"name": "Company A"}},
      {"type": "create", "entity_type": "Account", "data": {"name": "Company B"}}
    ]
  }'
```

## Query Data

```bash
# Health check
curl http://localhost:9600/health

# List events (filter by status, limit, days)
curl http://localhost:9600/api/events
curl "http://localhost:9600/api/events?status=pending"

# Get event details
curl http://localhost:9600/api/events/evt_01k7...

# List entities by type
curl http://localhost:9600/api/entities/accounts
curl http://localhost:9600/api/entities/contacts

# Get entity by ID
curl http://localhost:9600/api/entities/accounts/acc_01k7...

# Query SQLite directly
sqlite3 vault/crm.db "SELECT name, lifecycle_stage FROM accounts LIMIT 5"
```

## Validate Without Committing

```bash
curl -X POST http://localhost:9600/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "create",
    "entity_type": "Account",
    "data": {"name": "Test Corp"}
  }'

# Response:
# {"valid": true, "errors": [], "warnings": []}
```

## Entity Types

| Type | Directory | ID Prefix |
|------|-----------|-----------|
| Account | `accounts/` | `acc_` |
| Contact | `contacts/` | `con_` |
| Opportunity | `opportunities/` | `opp_` |
| Activity | `activities/` | `act_` |
| Lead | `leads/` | `led_` |
| Task | `tasks/` | `tsk_` |
| Quote | `quotes/` | `quo_` |
| Product | `products/` | `prd_` |
| Campaign | `campaigns/` | `cmp_` |

## Complete Workflow Example

```bash
# 1. Start services
npm run api &
npm run worker &

# 2. Create an account
curl -X POST http://localhost:9600/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"create","entity_type":"Account","data":{"name":"DataFlow Systems","lifecycle_stage":"prospect"}}'

# 3. Worker processes event automatically
# Output: Event evt_01k7...: create Account → accounts/dataflow-systems.md ✓ Applied

# 4. Verify file created
cat vault/accounts/dataflow-systems.md

# 5. Verify git commit
cd vault && git log --oneline -1

# 6. Query via API
curl http://localhost:9600/api/entities/accounts
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| API returns 404 | Check server is running: `curl http://localhost:9600/health` |
| Events not processing | Verify worker is running, check `vault/_logs/events-*.md` |
| Validation errors | Use `/api/validate` to test, check schemas in `vault/_schemas/` |
| Git errors | Ensure vault is a git repo: `cd vault && git status` |
