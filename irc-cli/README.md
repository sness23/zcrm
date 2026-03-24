# FS-CRM IRC

A classic IRC-style terminal interface for FS-CRM that brings old-school IRC aesthetics to your CRM workflow.

## Features

- **Classic IRC Layout**: Three-pane interface with channel list, messages, and status bar
- **Real-Time Updates**: File watching with instant event notifications
- **IRC-Style Commands**: All interactions via `/` commands (e.g., `/join`, `/search`, `/info`)
- **Entity Channels**: Browse accounts, contacts, opportunities as IRC channels
- **Multiple Themes**: Classic IRC, Monokai, Solarized Dark, Nord
- **Search & Filter**: Full-text search across all events and entities
- **Keyboard Shortcuts**: Navigate like a pro with Alt+1-9, Ctrl+N/P, etc.

## Installation

```bash
cd irc-cli
npm install
npm run build
```

## Usage

```bash
# Start the IRC interface
npm run dev

# Or after building
npm start

# With options
npm start -- --theme monokai --vault ../vault
```

### Command Line Options

- `--theme <name>` - Color theme (default, monokai, solarized-dark, nord)
- `--no-watch` - Disable file watching
- `--vault <path>` - Path to vault directory
- `--api-url <url>` - API server URL

## IRC Commands

### Navigation
- `/join <channel>` - Switch to channel
- `/part` - Leave current channel
- `/list [filter]` - List all channels
- `/next` or `/n` - Next channel
- `/prev` or `/p` - Previous channel
- `/pin [channel]` - Pin/unpin channel
- `/close` - Close current channel

### Information
- `/info [channel]` - Show channel info
- `/whois <id>` - Show entity details
- `/events [n]` - Show last n events
- `/status` - Show system status
- `/stats` - Show statistics

### Search
- `/search <query>` - Full-text search
- `/find <type> <name>` - Find entity by type
- `/filter <status>` - Filter by status (pending/applied/failed)
- `/grep <pattern>` - Grep current channel

### Display
- `/clear` - Clear messages
- `/scroll <n>` - Scroll up n lines
- `/top` - Jump to top
- `/bottom` - Jump to bottom
- `/expand` - Toggle sidebar
- `/theme <name>` - Switch theme

### System
- `/refresh` - Refresh from logs
- `/reconnect` - Reconnect to API
- `/watch` - Toggle file watching
- `/config [key] [val]` - Get/set config
- `/help [command]` - Show help
- `/quit` or `/q` - Exit

## Keyboard Shortcuts

- **Alt+1-9** - Switch to pinned channels 1-9
- **Ctrl+N/P** - Next/previous channel
- **Ctrl+R** - Refresh from logs
- **Ctrl+F** - Enter search mode
- **Ctrl+I** - Show channel info
- **Ctrl+L** - Clear screen
- **Ctrl+Q** or **Ctrl+D** - Quit
- **Arrow keys** - Scroll messages
- **Page Up/Down** - Scroll page
- **Home/End** - Jump to top/bottom

## Configuration

Config file: `~/.config/fscrm-irc/config.yaml`

```yaml
# Display settings
theme: default
show_timestamps: true
show_event_ids: true

# Behavior
auto_scroll: true
poll_interval: 5000
max_buffer_size: 1000

# Data sources
api_url: http://localhost:9600
vault_path: ../vault
watch_logs: true

# Pinned channels
pinned:
  - acme-corp
  - john-doe

# Aliases
aliases:
  j: join
  i: info
  s: search
  q: quit
```

## Themes

Available themes:
- **default** - Classic IRC (black background, bright colors)
- **monokai** - Monokai-inspired theme
- **solarized-dark** - Solarized Dark
- **nord** - Nord theme

Switch themes:
```
/theme monokai
```

## Data Sources

The IRC interface reads from multiple sources:

1. **Event Logs** (Primary): `vault/_logs/events-YYYY-MM-DD.md`
2. **API Server** (Optional): `http://localhost:9600/api/`
3. **Direct Files**: Reads entity files from `vault/` directories

## Development

```bash
# Install dependencies
npm install

# Run in dev mode with auto-restart
npm run dev

# Build TypeScript
npm run build

# Watch mode
npm run watch
```

## Architecture

```
irc-cli/
├── src/
│   ├── app.ts              # Main application orchestrator
│   ├── index.ts            # Entry point
│   ├── ui/                 # UI widgets (screen, sidebar, messages, etc.)
│   ├── data/               # Data managers (events, entities, API, watcher)
│   ├── commands/           # Command handlers
│   ├── utils/              # Utilities (parser, formatter, config, colors)
│   └── types/              # TypeScript type definitions
├── themes/                 # Color theme definitions
├── config/                 # Default configuration
└── bin/                    # Executable script
```

## Troubleshooting

**No events showing:**
- Check that `vault/_logs/` contains event files
- Verify vault path: `/config vault_path`
- Try manual refresh: `/refresh`

**API not connecting:**
- Check API is running: `npm run api`
- Verify URL: `/config api_url`
- App works without API using log files

**File watching not working:**
- Enable watching: `/watch`
- Check config: `/config watch_logs`
- Restart app if needed

## License

MIT
