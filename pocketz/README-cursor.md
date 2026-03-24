# Pocketz - URL Capture & Archive System

Pocketz is a comprehensive web content archiving system that captures URLs, downloads associated assets, and organizes them into a structured Obsidian vault. The system consists of a Chrome extension and a Node.js server that work together to create a personal knowledge management solution.

## 🏗️ Architecture Overview

The system has two main components:

1. **Chrome Extension** (`chrome-extension/`): Captures URLs and downloads web content
2. **Node.js Server** (`server/`): Receives URLs, processes downloads, and organizes content

## 🚀 Key Features

- **One-Click Capture**: Press `Shift+Alt+O` to capture any webpage
- **Complete Asset Download**: Downloads HTML, images, CSS, JavaScript, and PDFs
- **Smart Organization**: Creates timestamped directories with descriptive names
- **Obsidian Integration**: Automatically organizes content into an Obsidian vault
- **PDF Management**: Separates PDFs into a dedicated papers folder
- **Content Extraction**: Saves page text as markdown for easy reading
- **Index Generation**: Creates an index file linking all captured content

## 📁 Project Structure

```
pocketz/
├── chrome-extension/          # Chrome extension files
│   ├── manifest.json         # Extension configuration
│   ├── background.js         # Main extension logic
│   └── content.js            # Content script (placeholder)
├── server/                   # Node.js server
│   ├── server.js             # Express server with API endpoints
│   ├── package.json          # Server dependencies
│   └── urls.md               # URL log file
├── CLAUDE.md                 # Project documentation
└── README.md                 # Basic project info
```

## 🔧 Chrome Extension Details

### Manifest Configuration
- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: `activeTab`, `scripting`, `downloads`
- **Keyboard Shortcut**: `Shift+Alt+O` (configurable)
- **Service Worker**: Handles background processing

### Core Functionality

#### URL Capture Process
1. **Keyboard Trigger**: User presses `Shift+Alt+O`
2. **Content Extraction**: Extracts page text before any navigation
3. **Asset Discovery**: Finds images, CSS, JS files, and PDF links
4. **PDF Handling**: Automatically clicks PDF download links
5. **Download Management**: Downloads HTML and all assets
6. **Server Communication**: Sends URL and directory info to server

#### Smart Directory Naming
The extension generates descriptive directory names using the format:
```
YYYY-MM-DD_HHMMSS_domain_articleid
```

Examples:
- `2025-08-20_093452_nature_s41467-025-62739-1`
- `2025-08-24_134530_youtube_VC8Qhvrq0Sk`

#### Domain-Specific Logic
The extension includes specialized handling for:
- **Nature.com**: Extracts article IDs from URLs
- **arXiv**: Handles paper identifiers
- **PubMed**: Processes medical article IDs
- **GitHub**: Captures repository information
- **YouTube**: Extracts video IDs
- **MIT News**: Handles news article URLs
- **PNAS**: Processes scientific paper identifiers

## 🖥️ Server Details

### API Endpoints

#### POST `/save-url`
Saves URL information and triggers file processing.

**Headers:**
```
X-API-Key: pocketz-api-key-2024
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com",
  "directoryName": "2025-08-20_093452_example_page"
}
```

**Response:**
```json
{
  "success": true,
  "message": "URL saved successfully"
}
```

#### POST `/save-text`
Saves extracted page text as markdown.

**Headers:**
```
X-API-Key: pocketz-api-key-2024
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Page Title",
  "content": "Extracted page content...",
  "url": "https://example.com",
  "directoryName": "2025-08-20_093452_example_page"
}
```

### File Organization System

The server organizes downloaded content into a structured Obsidian vault:

```
$HOME/data/vaults/pocketz/
├── index.md                  # Main index file
├── papers/                   # PDF files (renamed with directory prefix)
│   ├── 2025-08-20_093452_nature_s41467-025-62739-1_paper.pdf
│   └── ...
└── 2025-08-20_093452_nature_s41467-025-62739-1/  # Article directory
    ├── 2025-08-20_093452_nature_s41467-025-62739-1.md  # Main content
    ├── page.html            # Downloaded HTML
    └── assets/              # Images, CSS, JS files
        ├── image1.jpg
        ├── styles.css
        └── script.js
```

### Processing Pipeline

1. **URL Reception**: Server receives URL and directory name
2. **File Movement**: Moves downloaded files from downloads folder to vault
3. **PDF Separation**: Extracts PDFs to dedicated papers folder
4. **Index Update**: Updates Obsidian index with new entry
5. **Content Organization**: Creates structured markdown files

## 🛠️ Development Setup

### Server Setup
```bash
cd server
npm install
npm start          # Production server (port 3000)
npm run dev        # Development server with nodemon
```

### Chrome Extension Setup
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome-extension/` directory
4. The extension will be loaded and ready to use

### Configuration

#### Server Paths (in `server.js`)
```javascript
const DOWNLOADS_DIR = '$HOME/down';           // Downloads folder
const VAULT_DIR = '$HOME/data/vaults/pocketz'; // Obsidian vault
const PAPERS_DIR = '$HOME/data/vaults/pocketz/papers'; // PDF folder
const INDEX_FILE = '$HOME/data/vaults/pocketz/index.md'; // Index file
```

#### API Key
The system uses a hardcoded API key: `pocketz-api-key-2024`

## 📊 Usage Examples

### Capturing a Nature Article
1. Navigate to a Nature article
2. Press `Shift+Alt+O`
3. Extension downloads HTML, assets, and clicks PDF links
4. Server organizes content into timestamped directory
5. PDFs are moved to papers folder
6. Index is updated with new entry

### Capturing a YouTube Video
1. Navigate to YouTube video
2. Press `Shift+Alt+O`
3. Extension captures video page and assets
4. Directory named: `2025-08-24_134530_youtube_VC8Qhvrq0Sk`

## 🔍 Technical Details

### Download Management
- **Timeout Handling**: 60 seconds for regular downloads, 2 minutes for PDFs
- **Progress Monitoring**: Tracks download completion status
- **Error Handling**: Graceful handling of failed downloads
- **Concurrent Downloads**: Manages multiple simultaneous downloads

### Content Extraction
- **Text Extraction**: Extracts main content using common selectors
- **Asset Discovery**: Finds images, CSS, JS files, and PDF links
- **PDF Detection**: Automatically clicks PDF download links
- **Content Cleaning**: Removes excessive whitespace and truncates large content

### File Naming Strategy
- **Timestamp**: ISO date format for chronological organization
- **Domain Mapping**: Converts domains to readable identifiers
- **Article ID Extraction**: Uses URL patterns to extract meaningful identifiers
- **Fallback Handling**: Uses title or generic names when extraction fails

## 🚨 Error Handling

The system includes comprehensive error handling:
- **Network Errors**: Graceful handling of connection issues
- **Download Failures**: Continues processing even if some downloads fail
- **File System Errors**: Handles missing directories and permission issues
- **API Errors**: Validates API keys and request formats

## 🔐 Security

- **API Key Authentication**: All requests require valid API key
- **CORS Support**: Configured for cross-origin requests
- **Input Validation**: Validates required fields and data types
- **Error Sanitization**: Prevents sensitive information leakage

## 📈 Performance Considerations

- **Async Processing**: Non-blocking file operations
- **Concurrent Downloads**: Parallel asset downloading
- **Content Truncation**: Limits text content to 100KB
- **Efficient Monitoring**: Optimized download status checking

## 🎯 Use Cases

- **Research**: Capture scientific papers and articles
- **Learning**: Save educational content and tutorials
- **Reference**: Build a personal knowledge base
- **Archival**: Preserve web content for offline access
- **Organization**: Maintain structured collections of web resources

This system provides a powerful solution for researchers, students, and knowledge workers who need to capture and organize web content efficiently.