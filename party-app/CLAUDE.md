# CLAUDE.md

This file provides guidance to Claude Code when working with the party-app.

## Overview

The **party-app** is a Customer 360 view application for displaying unified Party records with chat, history, relationships, and related data. It provides feature parity with Salesforce Customer 360 / Service Cloud Console.

## Key Features

- Multi-party tab system (browser-like tabs at top)
- Two-column collapsible layout (history left, tabbed content right)
- Unified history (chat + event log + activities + system updates)
- Contact points management (emails, phones, addresses)
- Relationships visualization
- Related records (opportunities, cases, activities)
- Real-time updates via WebSocket
- Large font accessibility (18px base)

## Tech Stack

- React 19 with TypeScript
- Vite (dev server + build)
- TailwindCSS (18px base font for accessibility)
- React Query (data fetching/caching)
- Zustand (tab state management)
- React Router (routing)
- Lucide React (icons)

## Commands

```bash
npm run dev          # Start dev server (port 9115)
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
```

## Architecture

### Two-Column Layout

```
Left Panel (40%):                Right Panel (60%):
- Unified History                - Tabs: Highlights, Profile, Contact Points, etc.
- Chat messages                  - Selected tab content
- Event log entries
- Activities
- System updates
- Chat input at bottom
```

### State Management

**Tab State (Zustand):**
- `tabStore.ts` - Manages open party tabs, active tab, recently viewed
- Persisted to localStorage

**UI State (Zustand):**
- `uiStore.ts` - Panel collapse state, widths, active right tab
- Persisted to localStorage

**Server State (React Query):**
- Party data
- Contact points
- History events
- Relationships
- Related records

## Important Design Decisions

1. **Accessibility First:** 18px base font, high contrast, generous spacing
2. **Two Columns Only:** No three-column layout (user needs large fonts)
3. **Unified History:** Left panel shows chat + event log + activities all in one
4. **Multi-Party Tabs:** Browser-like tabs at top for multiple open parties
5. **Collapsible Panels:** Both left and right panels can collapse for max space

## File Organization

- `components/layout/` - Layout components (PartyLayout, LeftPanel, RightPanel)
- `components/tabs/` - Tab system components
- `components/history/` - Unified history components
- `components/highlights/` - Highlights panel
- `components/profile/` - Profile tab
- `components/contact-points/` - Contact points tab
- `components/relationships/` - Relationships tab
- `components/related/` - Related records tab
- `hooks/` - Custom React hooks
- `services/` - API client, WebSocket client
- `store/` - Zustand stores
- `types/` - TypeScript types
- `utils/` - Utility functions

## API Integration

**Base URL:** `http://localhost:9600/api`

**Endpoints:**
- `GET /api/parties/:id` - Get party by ID
- `GET /api/parties/:id/history` - Get unified history
- `GET /api/parties/:id/contact-points/emails` - Get emails
- `GET /api/parties/:id/contact-points/phones` - Get phones
- `GET /api/parties/:id/contact-points/addresses` - Get addresses
- `GET /api/parties/:id/relationships` - Get relationships
- `GET /api/parties/:id/opportunities` - Get opportunities

**WebSocket:** Connected to same server for real-time updates

## Phase Progress

- ✅ Phase 1: Foundation (Week 1) - **COMPLETE**
- ⏳ Phase 2: Contact Points (Week 2) - NEXT
- ⏳ Phase 3: Unified History (Week 3)
- ⏳ Phase 4: Multi-Party Tabs (Week 4)
- ⏳ Phase 5: Relationships (Week 5)
- ⏳ Phase 6: Related Records (Week 6)
- ⏳ Phase 7: Polish & Performance (Week 7)

## Development Notes

- Always use 18px+ fonts (defined in tailwind.config.js)
- Test with browser zoom at 200% for accessibility
- Use semantic HTML and ARIA labels
- Implement keyboard shortcuts (Cmd+1-9 for tab switching)
- Persist UI state to localStorage
- Use React Query for all server state
- Use Zustand for client state (tabs, UI)

## Current Status

**Phase 1 Complete!** ✅

The foundation is built with:
- ✅ Two-column collapsible layout
- ✅ Multi-party tab system
- ✅ Tab state management (Zustand + localStorage)
- ✅ UI state management (panel collapse, widths)
- ✅ API client structure
- ✅ Type definitions (Party, ContactPoints, History)
- ✅ TailwindCSS with 18px base font
- ✅ React Query setup

**Next Steps:**
1. Test Phase 1 (run `npm run dev`)
2. Build Phase 2 (Highlights & Profile panels)
3. Add contact points CRUD
4. Implement unified history (Phase 3)

## Reference Documents

- `docs/RESEARCH-party-app.md` - Feature research and Salesforce comparison
- `docs/PLAN-party-app.md` - Detailed implementation plan
- `docs/RESEARCH-salesperson-party.md` - Party model for salespeople
