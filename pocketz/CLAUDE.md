# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pocketz is a URL and web page archival system with two components:

1. **Chrome Extension** (`chrome-extension/`): Captures web pages with assets using Shift+Alt+O
2. **Node.js Server** (`server/`): Receives URLs and organizes downloaded content into an Obsidian vault

The system downloads entire web pages (HTML, images, CSS, JS), extracts text content, finds and downloads PDFs, then organizes everything into timestamped directories with intelligent naming based on the source domain and article ID.

## Architecture

### Chrome Extension (Manifest V3)
- **Keyboard Shortcut**: Shift+Alt+O triggers page capture
- **Content Extraction**: Extracts page text, title, and finds all assets (images, CSS, JS, PDFs)
- **PDF Handling**: Automatically clicks PDF download links (e.g., Nature journal articles)
- **Download Management**: Uses Chrome Downloads API to save all assets to organized directories
- **Directory Naming**: Generates meaningful names like `2025-08-19_143027_nature_s41467-025-62755-1`
- **API Communication**: Sends URL, directory name, and page text to server

### Node.js Server (Express)
- **File Organization**: Moves downloads from `~/down` to Obsidian vault at `~/data/vaults/pocketz`
- **PDF Extraction**: Finds all PDFs and moves them to `papers/` subdirectory
- **Text Storage**: Creates markdown file with extracted page content
- **Index Generation**: Maintains `index.md` with links to all saved content
- **Simple Logging**: Logs to `server/urls.md` and console

### Configuration

The server uses environment variables (with fallback defaults):

```javascript
POCKETZ_PORT              // Default: 6767
POCKETZ_API_KEY           // Default: 'pocketz-api-key-2024'
POCKETZ_DOWNLOADS_DIR     // Default: '$HOME/down'
POCKETZ_VAULT_DIR         // Default: '$HOME/data/vaults/pocketz'
POCKETZ_PAPERS_DIR        // Default: '$HOME/data/vaults/pocketz/papers'
POCKETZ_INDEX_FILE        // Default: '$HOME/data/vaults/pocketz/index.md'
```

Configuration is stored in `/etc/pocketz/pocketz.env` when running as a service.

## Running Pocketz

### As a systemd Service (Recommended for Ubuntu)

Install and configure the service:

```bash
# Install the service (one-time setup)
sudo ./scripts/install-service.sh

# Start the service
sudo systemctl start pocketz

# Enable auto-start on boot
sudo systemctl enable pocketz

# Check status
sudo systemctl status pocketz

# View live logs
sudo journalctl -u pocketz -f

# Stop the service
sudo systemctl stop pocketz

# Restart the service
sudo systemctl restart pocketz
```

Service files:
- Configuration: `/etc/pocketz/pocketz.env`
- Service file: `/etc/systemd/system/pocketz.service`
- Logs: `sudo journalctl -u pocketz`

### Manual Development Mode

```bash
cd server
npm install           # Install dependencies (express, cors)
npm start            # Start production server (port 6767)
npm run dev          # Start with nodemon for auto-reload
```

### Chrome Extension
```bash
# Development workflow:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the chrome-extension/ directory
# 5. After making changes, click reload icon on extension
```

No build process - files used directly by Chrome.

## Key Files

### Chrome Extension
- **manifest.json** (server/package.json:1): Defines permissions (activeTab, scripting, downloads), keyboard command, and service worker
- **background.js** (chrome-extension/background.js:1): Main logic for page capture, asset extraction, download orchestration
  - `downloadPageWithAssets()` (chrome-extension/background.js:130): Orchestrates entire capture process
  - `extractPageText()` (chrome-extension/background.js:272): Extracts readable content from page
  - `extractPageAssets()` (chrome-extension/background.js:224): Finds images, CSS, JS, and clicks PDF links
  - `generateDirectoryName()` (chrome-extension/background.js:344): Creates timestamped directory names
  - `extractDomainAndArticle()` (chrome-extension/background.js:358): Domain-specific article ID extraction
- **content.js**: Currently minimal, most work done in background service worker

### Server
- **server.js** (server/server.js:1): Express server with three main endpoints
  - `/save-url` (server/server.js:21): Main endpoint - receives URL, moves files, updates index
  - `/save-text` (server/server.js:74): Saves extracted page text as markdown
  - `moveDownloadedFiles()` (server/server.js:107): Moves directory from downloads to vault
  - `movePDFsToPapersFolder()` (server/server.js:133): Extracts and organizes PDFs
  - `updateObsidianIndex()` (server/server.js:163): Maintains master index.md
- **package.json** (server/package.json:1): Dependencies and scripts

## Directory Naming Strategy

Format: `YYYY-MM-DD_HHMMSS_<domain>_<article_id>`

### Supported Domain Extractors

The system has intelligent article ID extraction for:
- **Nature**: `/articles/<id>` → `nature_s41467-025-62755-1`
- **arXiv**: `/abs/<id>` → `arxiv_2408.12345v1`
- **GitHub**: `/owner/repo` → `github_microsoft_typescript`
- **YouTube**: `/watch?v=<id>` → `youtube_dQw4w9WgXcQ`
- **PubMed**: `/PMC<id>` → `pubmed_PMC123456`
- **MIT News**: Article slug → `mitnews_<slug>`
- **PNAS**, **bioRxiv**, **medRxiv**: Extract DOI/preprint ID
- **Springer Static Content**: Extract filename from URL

### Fallback Chain
1. Domain-specific article ID pattern
2. Last URL path segment
3. Sanitized page title (first 30 chars)
4. Default: 'page'

Implementation: `extractDomainAndArticle()` in background.js:358

## API

### POST /save-url
Moves downloaded directory to vault and updates index.

**Request:**
```json
{
  "url": "https://example.com/article",
  "directoryName": "2025-08-19_143027_nature_s41467-025-62755-1"
}
```
**Headers:** `X-API-Key: pocketz-api-key-2024`

**Process:**
1. Validates API key
2. Logs URL to server/urls.md
3. Moves directory from DOWNLOADS_DIR to VAULT_DIR
4. Finds all PDFs and moves to papers/ with prefixed names
5. Updates index.md with entry and wikilinks

### POST /save-text
Saves extracted page text as markdown file.

**Request:**
```json
{
  "title": "Page Title",
  "content": "Full page text...",
  "url": "https://example.com",
  "directoryName": "2025-08-19_143027_nature_s41467-025-62755-1"
}
```

**Process:**
1. Creates directory in vault if needed
2. Writes `<directoryName>.md` with title, URL, timestamp, and content
3. File becomes the index for that capture

## How a Capture Works

1. **User presses Shift+Alt+O** on a web page
2. **Extension extracts page text** before any navigation (important for PDF links)
3. **Extension finds assets** - images, CSS, JS, and PDF download links
4. **Extension clicks PDF links** to trigger downloads
5. **Extension downloads main HTML** and all assets to `~/down/<directory_name>/`
6. **Extension waits** for all downloads to complete (up to 2 minutes)
7. **Extension sends URL + directory name** to server `/save-url`
8. **Extension sends page text** to server `/save-text`
9. **Server moves directory** from `~/down/` to vault
10. **Server extracts PDFs** and moves to `papers/` folder with prefixed names
11. **Server creates markdown file** with page text and metadata
12. **Server updates index.md** with wikilinks to the new content

## File Organization

After capture, files are organized as:

```
~/data/vaults/pocketz/
├── index.md                                    # Master index with all captures
├── papers/
│   └── 2025-08-19_143027_nature_s41467_article.pdf
└── 2025-08-19_143027_nature_s41467-025-62755-1/
    ├── 2025-08-19_143027_nature_s41467-025-62755-1.md  # Page text
    ├── Viral_proteins_suppress.html                      # Main HTML
    └── assets/
        ├── image1.jpg
        ├── styles.css
        └── script.js
```

## Common Development Tasks

### Adding a New Domain Extractor

Edit `extractDomainAndArticle()` in background.js:358:

1. Add domain to `domainMap` object
2. Add extraction function to `extractors` object
3. Test with URLs from that domain

### Changing Configuration Paths

When running as a service:
```bash
sudo nano /etc/pocketz/pocketz.env
sudo systemctl restart pocketz
```

When running manually, set environment variables:
```bash
export POCKETZ_DOWNLOADS_DIR=/custom/path
export POCKETZ_VAULT_DIR=/custom/vault
npm start
```

### Debugging Extension

1. Open chrome://extensions/
2. Click "Inspect views: background page" on Pocketz extension
3. View console logs from background.js
4. Check chrome://downloads/ for download status

### Testing PDF Downloads

Nature articles are a good test case - they have PDFs that get auto-clicked and downloaded.

## Known Limitations

- **Single user**: No multi-user support
- **API key**: Same key used by all clients (hardcoded in extension)
- **No error recovery**: Failed downloads aren't retried
- **Local only**: Server must run on localhost:6767
- **No database**: Everything is flat files
- **Download timing**: 2-minute timeout may not be enough for large PDFs
- **Frame removal**: PDF clicks can remove frames, causing extraction warnings

## Service Management

### Viewing Logs

```bash
# View recent logs
sudo journalctl -u pocketz -n 50

# Follow live logs
sudo journalctl -u pocketz -f

# View logs since last boot
sudo journalctl -u pocketz -b

# View logs from last hour
sudo journalctl -u pocketz --since "1 hour ago"
```

### Troubleshooting

If the service won't start:
```bash
# Check service status
sudo systemctl status pocketz

# View detailed logs
sudo journalctl -u pocketz -n 100

# Check configuration
sudo cat /etc/pocketz/pocketz.env

# Test manually
cd $HOME/github/sness23/pocketz/server
node server.js
```

### Updating Configuration

```bash
# Edit configuration
sudo nano /etc/pocketz/pocketz.env

# Restart to apply changes
sudo systemctl restart pocketz

# Verify changes took effect
sudo journalctl -u pocketz -n 20
```

## Future Plans

See `docs/PLAN-future-pocketz.md` for:
- Docker deployment
- Multi-user support
- Database integration
- Cloud deployment options
- Advanced monitoring
