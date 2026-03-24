# Database Architecture for doi.bio

## Overview

The doi.bio ecosystem uses a **local-first architecture**:

- **Supabase (PostgreSQL)**: Authentication ONLY (shared SSO across all apps)
- **SQLite**: All business data (local databases for each app)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    login.doi.bio                      │
│                    (Port 9103)                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │      Supabase Auth ONLY (minimal profiles)      │  │
│  │  - Email/password authentication               │  │
│  │  - Google OAuth                                 │  │
│  │  - Session management (JWT tokens)              │  │
│  │  - Basic user profile (email, name, avatar)     │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ (Session shared via localStorage)
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌──────────────────────┐       ┌──────────────────────┐
│  leads.doi.bio     │       │   earn.doi.bio     │
│  (Port 9105)         │       │   (Port 9104)        │
│                      │       │                      │
│  ┌────────────────┐ │       │  ┌────────────────┐ │
│  │    SQLITE      │ │       │  │    SQLITE      │ │
│  │   Local DB     │ │       │  │   Local DB     │ │
│  │                │ │       │  │                │ │
│  │ • Users        │ │       │  │ • Users        │ │
│  │ • Lead Lists   │ │       │  │ • Leads        │ │
│  │ • Purchases    │ │       │  │ • Deals        │ │
│  │ • CRM Sync     │ │       │  │ • Transactions │ │
│  │ • Subscriptions│ │       │  │ • Leaderboard  │ │
│  └────────────────┘ │       │  └────────────────┘ │
└──────────────────────┘       └──────────────────────┘
```

## Why This Architecture?

### Supabase for Auth Only:
- ✅ **Shared SSO**: Single sign-on across all platforms
- ✅ **Google OAuth**: Social login out of the box
- ✅ **Session Management**: JWT tokens in localStorage
- ✅ **Minimal costs**: Only auth, no database usage
- ✅ **Free tier**: Likely stays under free tier limits

### SQLite for All Business Data:
- ✅ **Zero database costs**: Local file storage
- ✅ **Blazing fast**: No network latency
- ✅ **Simple**: No cloud configuration
- ✅ **Portable**: Easy backups (copy file)
- ✅ **Local-first**: Works offline
- ✅ **No vendor lock-in**: Standard SQLite format
- ✅ **Privacy**: Data stays on your server

## Cost Breakdown

| Resource | This Architecture | Traditional Cloud DB |
|----------|------------------|---------------------|
| **Auth (Supabase)** | $0/month (free tier) | $0/month |
| **Database** | $0/month (SQLite) | $50-100/month |
| **Storage** | $0/month (local disk) | $25/month |
| **Bandwidth** | $0/month (no DB API calls) | Variable |
| **Total** | **$0/month** 🎉 | **$75-125/month** |

**Savings: 100%** (vs cloud database approach)

## Setup Instructions

### 1. Supabase Setup (Auth Only)

#### Create Auth Schema

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste `/supabase/auth-only-schema.sql`
5. Run the query

This creates:
- `profiles` table (minimal: id, email, full_name, avatar_url)
- Auto-create profile trigger on signup
- RLS policies for profile access

#### Configure Authentication Providers

In Supabase Dashboard:
1. Go to **Authentication** → **Providers**
2. Enable **Email** (email/password login)
3. Enable **Google** (OAuth)
   - Add your Google OAuth credentials
   - Set redirect URL: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

#### Environment Variables

Create `.env` in `login-app/`:

```bash
# Supabase Auth (shared across all apps)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. SQLite Setup (earn-app)

```bash
# Initialize database
sqlite3 earn-app/database.db < earn-app/schema.sql

# Verify tables
sqlite3 earn-app/database.db ".tables"

# Should see: users, leads, deals, transactions, etc.
```

### 3. SQLite Setup (leads-app)

```bash
# Initialize database
sqlite3 leads-app/database.db < leads-app/schema.sql

# Verify tables
sqlite3 leads-app/database.db ".tables"

# Should see: users, lead_lists, purchases, subscriptions, etc.
```

### 4. Add to .gitignore

```bash
# Don't commit database files
echo "earn-app/database.db*" >> .gitignore
echo "leads-app/database.db*" >> .gitignore
```

## How Authentication Works

### 1. User Signs In (login.doi.bio)
- User enters email/password or clicks "Sign in with Google"
- Supabase creates session → JWT token stored in localStorage
- User sees app launcher

### 2. User Clicks App (earn or leads)
- App loads → checks for Supabase session in localStorage
- If valid session exists → extract `user.id` and `user.email`
- App creates/updates local user record in SQLite:
  ```javascript
  const { data: { user } } = await supabase.auth.getUser()

  // Create local user if doesn't exist
  db.prepare(`
    INSERT INTO users (id, email, full_name, avatar_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      full_name = excluded.full_name,
      updated_at = datetime('now')
  `).run(user.id, user.email, user.user_metadata.full_name, user.user_metadata.avatar_url)
  ```

### 3. Session Expiry
- If session expired → redirect to `login.doi.bio`
- User logs in again → session refreshed
- Returns to intended app

## Database Schemas

### Supabase (auth-only-schema.sql)
```sql
profiles (
  id UUID PRIMARY KEY,           -- From auth.users
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### earn-app (schema.sql)
13 tables including:
- `users` - Local copy of user profiles
- `leads` - User-contributed leads
- `deals` - Revenue tracking
- `transactions` - Payment history
- `leaderboard` - User rankings

### leads-app (schema.sql)
9 tables including:
- `users` - Local copy of user profiles
- `lead_lists` - Curated lead products
- `list_items` - Individual leads
- `purchases` - Transaction history
- `subscriptions` - Recurring plans
- `crm_integrations` - OAuth configs

## Development Workflow

### Starting All Services

```bash
# Start all services at once
npm run start
# or
npm run smart

# Individual services
npm run login:dev    # Port 9103 (SSO portal)
npm run earn:dev     # Port 9104 (lead-to-earn)
npm run leads:dev    # Port 9105 (marketplace)
```

### Database Migrations

#### Supabase (auth only)
- Rarely needed (just basic profile fields)
- If needed: update `auth-only-schema.sql` → run in SQL Editor

#### SQLite (earn & leads)
```bash
# Create migration file
cat > earn-app/migrations/001_add_field.sql <<EOF
ALTER TABLE users ADD COLUMN new_field TEXT;
EOF

# Apply migration
sqlite3 earn-app/database.db < earn-app/migrations/001_add_field.sql

# Or use migration library like better-sqlite3-migrations
```

## Backup Strategy

### Supabase (auth data)
- Automatic backups by Supabase
- Export users via Dashboard → Authentication → Users → Export

### SQLite (business data)

**Daily Backups (recommended):**
```bash
#!/bin/bash
# backup-databases.sh

BACKUP_DIR="./backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Backup earn database
sqlite3 earn-app/database.db ".backup '$BACKUP_DIR/earn-app.db'"

# Backup leads database
sqlite3 leads-app/database.db ".backup '$BACKUP_DIR/leads-app.db'"

# Keep last 30 days
find ./backups -type d -mtime +30 -exec rm -rf {} \;
```

**Automated (cron):**
```cron
# Run daily at 2 AM
0 2 * * * /path/to/sales/backup-databases.sh
```

**Simple File Copy:**
```bash
# Quick backup
cp earn-app/database.db earn-app/database.backup.db
cp leads-app/database.db leads-app/database.backup.db
```

## Security Considerations

### Supabase Auth
- ✅ RLS policies on profiles table
- ✅ HTTPS by default
- ✅ JWT tokens auto-expire (configurable)
- ✅ Anon key is rate-limited (safe to expose)

### SQLite Local Storage
- ⚠️ **File Permissions**: Set to `600` (owner read/write only)
  ```bash
  chmod 600 earn-app/database.db
  chmod 600 leads-app/database.db
  ```
- ⚠️ **Server Access**: Only backend server should access DB files
- ⚠️ **Never Expose**: Don't serve database files via HTTP
- ✅ **Encryption (optional)**: Use SQLCipher for encrypted databases
- ✅ **Backups**: Encrypt backup files before cloud storage

## User Data Sync Flow

```
1. User signs in on login.doi.bio
   ↓
2. Supabase creates session → JWT in localStorage
   ↓
3. User clicks "Earn App"
   ↓
4. earn.doi.bio loads → checks session
   ↓
5. Extract user.id from Supabase JWT
   ↓
6. Check if user exists in local SQLite
   ↓
7. If not → INSERT user from Supabase profile
   If yes → UPDATE user email/name (in case changed)
   ↓
8. App uses local user.id for all queries
```

## Troubleshooting

### "Supabase session not found"
```bash
# Check localStorage in browser dev tools
# Should see: sb-xxxxx-auth-token

# Verify Supabase URL and anon key in .env
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

### "SQLite database locked"
```bash
# Check for open connections
lsof | grep database.db

# If needed, kill processes
fuser -k earn-app/database.db
```

### "Database file doesn't exist"
```bash
# Re-initialize from schema
sqlite3 earn-app/database.db < earn-app/schema.sql
sqlite3 leads-app/database.db < leads-app/schema.sql
```

### "User not synced to local database"
```javascript
// Force sync user on app load
const syncUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    window.location.href = 'http://localhost:9103' // Redirect to login (Port 9103)
    return
  }

  // Upsert user to local SQLite
  await db.exec(`
    INSERT INTO users (id, email, full_name, avatar_url)
    VALUES ('${user.id}', '${user.email}', '${user.user_metadata.full_name}', '${user.user_metadata.avatar_url}')
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      updated_at = datetime('now')
  `)
}
```

## Files Reference

```
sales/
├── supabase/
│   ├── auth-only-schema.sql      # ← RUN THIS (minimal auth setup)
│   ├── leads-schema.sql          # ← OLD (don't use)
│   ├── unified-schema.sql        # ← OLD (don't use)
│   └── drop-*.sql                # ← Cleanup scripts
├── earn-app/
│   ├── schema.sql                # ← SQLite schema for earn
│   └── database.db               # ← Created after running schema
├── leads-app/
│   ├── schema.sql                # ← SQLite schema for leads
│   └── database.db               # ← Created after running schema
└── login-app/
    └── .env                      # ← Supabase auth config
```

## Migration from Cloud to Local

If you already have data in Supabase:

```bash
# 1. Export from Supabase
# Go to Table Editor → Select table → Export as CSV

# 2. Import to SQLite
sqlite3 earn-app/database.db
.mode csv
.import exported_leads.csv leads

# 3. Verify
SELECT COUNT(*) FROM leads;
```

## Next Steps

1. ✅ Run Supabase auth schema (`auth-only-schema.sql`)
2. ✅ Initialize SQLite databases (`schema.sql` for each app)
3. ⏳ Install `better-sqlite3` in earn-app and leads-app
4. ⏳ Create database client utilities
5. ⏳ Implement user sync on app load
6. ⏳ Set up automated backups
7. ⏳ Add seed data scripts

---

**Questions?** Check individual app READMEs or open an issue.

**Why local-first?** Simple, fast, free, and you own your data.
