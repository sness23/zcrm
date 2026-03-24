# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Slack-like chat interface built with React + TypeScript + Vite that connects to a CRM backend API. The application provides real-time messaging for channels and CRM entities (accounts, contacts, opportunities, etc.) with AI integration powered by Cohere.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 9100)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

## Backend API Connection

This frontend connects to a backend API that runs separately:

- **API Server**: `http://localhost:9600` (REST API + WebSocket)
- **API Commands** (run from parent directory):
  - `npm run api` — Start API server on port 9600
  - `npm run worker` — Start worker process for event-sourced architecture

The backend must be running for the frontend to function. The API provides:
- Event-sourced CRM data (accounts, contacts, opportunities, leads, activities, tasks, quotes, products, campaigns)
- Real-time WebSocket messaging for channels
- AI chat integration with Cohere
- SQLite database projection at `vault/crm.db`

## Architecture

### Frontend Architecture

**State Management:**
- React Context API for authentication (`AuthContext`)
- Local component state with `useState` for UI
- WebSocket connection for real-time updates
- localStorage for pinned channels and message history

**Key Components:**
- `App.tsx` — Main application logic (1900+ lines, handles both channel and entity views)
- `Login.tsx` — Supabase authentication
- `UserProfile.tsx` — User menu with settings
- `NewChannelModal.tsx` — Channel creation dialog
- `SettingsModal.tsx` — User settings

**Custom Hooks:**
- `useAIChat()` — Handles streaming AI responses from Cohere

**Data Flow:**
1. User authenticates via Supabase (`AuthContext`)
2. App connects to WebSocket (`ws://localhost:9600`)
3. Fetches channels, entities, and events via REST API
4. Real-time updates via WebSocket broadcasts
5. AI messages stream via Server-Sent Events (SSE)

### Channel Types

The app supports two distinct channel types:

1. **Chat Channels** (`selectedChannelType === 'channel'`)
   - Traditional Slack-like channels (e.g., `#general`)
   - Direct messages with AI (`@Cohere` DM)
   - Messages stored per-channel with infinite scroll
   - Support `@c <query>` prefix for in-channel AI assistance

2. **Object Channels** (`selectedChannelType === 'object'`)
   - CRM entity views (accounts, contacts, opportunities, etc.)
   - Display entity markdown files and event history
   - Event-sourced timeline of changes
   - Support AI queries with entity context

### AI Integration

**AI Chat Modes:**
- **Direct Chat**: `@Cohere` DM channel for persistent conversations
- **In-Channel AI**: Use `%co <query>` in any channel to invoke AI
- **Entity AI**: Use `%co <query>` in object channels for entity-aware assistance

**AI Command Syntax:**
```
%co <query>         # Ask Cohere AI anything
%ask <query>        # Alias for %co
%explain <topic>    # Request detailed explanation
%summarize <text>   # Request concise summary
```

**Examples:**
```
%co what is this account about?
%ask summarize the last 5 activities
%explain opportunity stages
%summarize this conversation
```

**Legacy Support:**
- `@c <query>` still works but is deprecated (shows console warning)
- Migrating to `%co` recommended to avoid conflicts with mentions

**Implementation:**
- Streaming responses via Server-Sent Events (SSE)
- Token usage tracking (input/output tokens displayed)
- Context-aware (includes entity markdown and event history for object channels)
- Markdown rendering for AI responses using `react-markdown`
- System prompts for specialized commands (`%explain`, `%summarize`)

### WebSocket Message Flow

**Sender (T0→T1):**
1. T0: User clicks send
2. API processes message
3. T1: Response received from API
4. Sender timing posted to `/api/latency/e2e/sender-timing`

**Receiver (T2→T4):**
1. T2: WebSocket message received
2. T3: React state updated
3. T4: Rendered to screen (measured via `requestAnimationFrame`)
4. Complete E2E timing posted to `/api/latency/e2e/record`

### Environment Configuration

Required environment variables (`.env`):
```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

Optional:
```
VITE_API_URL=http://localhost:9600
```

## Key Features

**Real-Time Messaging:**
- WebSocket connection for instant message delivery
- Infinite scroll with lazy loading (50 messages at a time)
- Auto-scroll to bottom (disabled when user scrolls up)
- Message history navigation (Arrow Up/Down)

**Navigation Shortcuts:**
- `Enter` — Send message
- `Shift+Enter` — New line
- `Up/Down` — Navigate message history
- `PageUp/PageDown` — Scroll chat content
- `Home/End` — Jump to top/bottom of chat
- `Shift+Ctrl+S` — Toggle sidebar visibility

**Channel Management:**
- Pinned channels (persisted to localStorage)
- Recent channels (based on event activity)
- Channel sections (Channels, DMs, Pinned, Recent, Objects)
- Entity sections (collapsible, grouped by type)

**Entity Types (9 total):**
- Accounts 🏢
- Contacts 👤
- Opportunities 💰
- Leads 🎯
- Activities 📅
- Tasks ✓
- Quotes 📄
- Products 📦
- Campaigns 📢

## Testing the App

1. Start backend API: `cd .. && npm run api`
2. Start worker: `npm run worker` (in separate terminal)
3. Start frontend: `npm run dev`
4. Open `http://localhost:9100`
5. Sign up/sign in with Supabase credentials
6. Create channels or interact with CRM entities

## Code Conventions

- TypeScript with strict mode
- React 19 with functional components only
- CSS Modules avoided (global CSS in `App.css`)
- Emoji icons used throughout UI (no icon library)
- Markdown support via `react-markdown` for AI responses
- Performance tracking via `performance.now()` timestamps
