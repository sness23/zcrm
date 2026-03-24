# Webhook API

Webhooks allow external services to receive real-time notifications when CRM events occur.

## Event Patterns

Subscribe to specific event types:

| Pattern | Description |
|---------|-------------|
| `*` | All events |
| `create.*` | All creates |
| `update.*` | All updates |
| `delete.*` | All deletes |
| `create.Account` | Only account creations |
| `update.Contact` | Only contact updates |

## Webhook Management

### Register
```bash
curl -X POST http://localhost:9600/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-service.com/webhook",
    "events": ["create.*", "update.*"],
    "secret": "your-webhook-secret"
  }'
```

### List
```bash
curl http://localhost:9600/api/webhooks?active=true
```

### Update
```bash
curl -X PUT http://localhost:9600/api/webhooks/whk_01... \
  -H "Content-Type: application/json" \
  -d '{"events": ["*"], "active": false}'
```

### Delete
```bash
curl -X DELETE http://localhost:9600/api/webhooks/whk_01...
```

### Test
```bash
curl -X POST http://localhost:9600/api/webhooks/whk_01.../test
```

### Delivery History
```bash
curl http://localhost:9600/api/webhooks/whk_01.../deliveries?limit=10
```

## Webhook Payload

When an event occurs, your endpoint receives:

```json
{
  "event_id": "evt_01...",
  "event_type": "create.Account",
  "timestamp": "2025-01-15T12:45:00.000Z",
  "entity_type": "Account",
  "entity_id": "acc_01...",
  "data": {
    "id": "acc_01...",
    "name": "Acme Corporation",
    "lifecycle_stage": "customer",
    "type": "Account"
  },
  "changes": null
}
```

### HTTP Headers

```
Content-Type: application/json
User-Agent: FS-CRM-Webhook/1.0
X-Webhook-ID: whk_01...
X-Event-ID: evt_01...
X-Event-Type: create.Account
X-Webhook-Signature: <hmac-sha256-signature>
```

## HMAC Signature Verification

When a `secret` is configured, verify the `X-Webhook-Signature` header:

### Node.js
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

### Python
```python
import hmac, hashlib, json

def verify_signature(payload, signature, secret):
    expected = hmac.new(
        secret.encode(), json.dumps(payload, separators=(',', ':')).encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## Delivery & Retry

- Your endpoint should respond with HTTP 2xx within 30 seconds
- Failed deliveries are retried up to 3 times
- Webhooks with 10+ consecutive failures are automatically disabled
- Re-enable with: `PUT /api/webhooks/:id {"active": true}`

## Examples

### Slack Notification on New Accounts
```javascript
app.post('/slack-webhook', async (req, res) => {
  const { data } = req.body;
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `New account: ${data.name}` })
  });
  res.json({ received: true });
});
```

### Multi-System Sync
```javascript
app.post('/sync-webhook', async (req, res) => {
  const { event_type, entity_type, data, changes } = req.body;
  if (event_type.startsWith('create')) {
    await externalSystem.create(entity_type, data);
  } else if (event_type.startsWith('update')) {
    await externalSystem.update(entity_type, data.id, changes);
  }
  res.json({ received: true });
});
```

## Best Practices

1. **Use HTTPS** for webhook endpoints
2. **Verify signatures** when using secrets
3. **Return 200 immediately**, process asynchronously
4. **Handle duplicates** using `event_id` for idempotency
5. **Implement rate limiting** on your endpoint
