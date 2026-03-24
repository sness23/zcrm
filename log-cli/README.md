# Zax CRM Log Viewer

A simple, real-time log viewer for Zax CRM events. Just displays events as they come in - no filtering, no commands, just pure event streaming.

## Features

- **Simple Display**: Clean, scrollable event log
- **Real-Time Updates**: Automatically watches for new events
- **Smart Auto-Scroll**: Like Slack/Discord - only scrolls if you're at the bottom
- **Date Dividers**: Organized by day (Today, Yesterday, etc.)
- **Color Coding**: Events colored by action and status
- **Keyboard Navigation**: Scroll through history easily

## Installation

```bash
cd log-cli
npm install
npm run build
```

## Usage

```bash
# Start the log viewer
npm run dev

# Or after building
npm start

# With custom options
npm start -- --vault ../vault --days 7

# Disable file watching
npm start -- --no-watch
```

## Options

- `--vault <path>` - Path to vault directory (default: `../vault`)
- `--days <number>` - Number of days to load (default: `7`)
- `--watch` - Watch for new events (default: `true`)
- `--no-watch` - Disable file watching

## Keyboard Shortcuts

- **q** or **Ctrl+C** - Quit
- **r** or **Ctrl+R** - Refresh events
- **↑/↓** - Scroll up/down
- **PgUp/PgDn** - Page up/down
- **Home/End** - Jump to top/bottom

## Display Format

Each event is displayed with:
- **Timestamp** (HH:mm:ss)
- **Emoji** indicating action type (✨ create, ✏️ update, 🗑️ delete)
- **Message** describing the event
- **Details** (up to 3 key fields)
- **Status** badge ([applied]/[pending]/[failed])
- **Event ID** (shortened)

Example:
```
10:32:45 ✨ Created Account
         name: Acme Corp
         industry: Technology
         lifecycle: prospect
         [applied] [acc_01jax...]

10:33:12 ✏️ Updated Opportunity
         stage: proposal → negotiation
         amount: $50,000
         [applied] [opp_01jay...]
```

## Data Source

Reads from: `vault/_logs/events-YYYY-MM-DD.md`

The viewer:
1. Loads events from the last N days (default: 7)
2. Displays them in chronological order
3. Watches for new events and appends them in real-time
4. Automatically scrolls to show newest events

## How It Works

1. **Parse**: Reads markdown files with YAML frontmatter
2. **Format**: Converts events to colored, readable text
3. **Display**: Shows in a scrollable blessed log widget
4. **Watch**: Uses chokidar to detect file changes
5. **Update**: Appends new events as they're written
6. **Smart Scroll**: Only auto-scrolls if you're viewing the latest events (like Slack/Discord)

## Comparison to IRC CLI

| Feature | IRC CLI | Log CLI |
|---------|---------|---------|
| UI Complexity | 3-pane layout | Single log view |
| Commands | 30+ IRC commands | None |
| Filtering | Search, filter, channels | None |
| Navigation | Channel switching | Scrolling only |
| Use Case | Interactive CRM exploration | Passive log monitoring |
| File Size | 22 source files | 2 source files |

## When to Use

Use **log-cli** when you want to:
- Monitor events in real-time
- Simple, distraction-free viewing
- Quick check of recent activity
- Debugging event processing
- Watching during development

Use **irc-cli** when you want to:
- Explore entities interactively
- Search and filter events
- Switch between different channels
- Deep dive into specific entities

## Technical Details

- **Framework**: Blessed (terminal UI)
- **File Watching**: Chokidar
- **Date Formatting**: date-fns
- **Parsing**: gray-matter (YAML frontmatter)
- **Language**: TypeScript

## Examples

### Basic Usage
```bash
npm run dev
```

### Watch Last 30 Days
```bash
npm start -- --days 30
```

### Static View (No Watching)
```bash
npm start -- --no-watch
```

### Custom Vault Path
```bash
npm start -- --vault /path/to/my/vault
```

## Status Bar

Bottom of screen shows:
- Event count
- Watching status
- Available shortcuts

Example: `Events: 142 | Watching | q: quit | r: refresh | ↑↓: scroll`

## Performance

- Handles 1000+ events smoothly
- Real-time updates < 100ms latency
- Efficient incremental parsing
- Low memory footprint

## License

MIT
