# Pocketz Worker

Local worker service that connects to the EC2 server and processes URL download jobs by automating a Chrome browser with the Pocketz extension.

## Overview

The Pocketz Worker is designed to run on your local machine and handle web page archiving through the Pocketz browser extension. It receives download jobs from the EC2 server via WebSocket, automates Chrome to visit URLs and trigger the Pocketz extension, then reports completion status back to the server.

## Architecture

```
EC2 Server (WebSocket) → Local Worker → Chrome + Pocketz Extension → Pocketz Server → Vault
```

1. **EC2 Server** pushes download jobs via authenticated WebSocket
2. **Local Worker** receives jobs and automates Chrome with Playwright
3. **Chrome + Pocketz Extension** captures pages when Shift+Alt+O is triggered
4. **Pocketz Server** (localhost:6767) saves captured content to vault
5. **Worker** reports success/failure back to EC2 server

## Prerequisites

1. **Node.js 20+**
2. **Pocketz Extension** installed in Chrome
3. **Pocketz Server** running locally (systemd service on port 6767)
4. **Chrome/Chromium** browser running with remote debugging enabled

## Installation

```bash
# Navigate to worker directory
cd pocketz-worker

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Starting Chrome with Remote Debugging

The worker connects to your existing Chrome instance via CDP (Chrome DevTools Protocol). Start Chrome with remote debugging enabled:

```bash
# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/path/to/project

# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/path/to/project

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\chrome\9222
```

**Important:**
- Use a **separate user-data-dir** to avoid conflicts with your regular Chrome profile
- Keep this Chrome window open while the worker is running
- Make sure Pocketz extension is installed in this Chrome instance

## Configuration

Edit `.env` file:

```bash
# WebSocket URL for EC2 server
EC2_WEBSOCKET_URL=ws://your-ec2-ip:9600

# Authentication token (MUST match server-side POCKETZ_WORKER_TOKEN)
POCKETZ_WORKER_TOKEN=your-secret-token-here

# Chrome CDP URL (default: http://localhost:9222)
CHROME_CDP_URL=http://localhost:9222

# Local Pocketz server URL (default: http://localhost:6767)
POCKETZ_SERVER_URL=http://localhost:6767

# Reconnection delay in milliseconds (default: 5000)
RECONNECT_DELAY=5000

# Download timeout in milliseconds (default: 15000)
DOWNLOAD_TIMEOUT=15000
```

**Generate a secure token:**
```bash
openssl rand -hex 32
```

Make sure to use the **same token** on both the EC2 server and local worker.

## Running the Worker

### Development Mode

```bash
npm run dev
```

This uses `tsx` to run TypeScript directly without compilation.

### Production Mode

```bash
# Build TypeScript to JavaScript
npm run build

# Run compiled code
npm start
```

### As a Background Service

You can run the worker as a systemd service on Linux or use `pm2`:

**Using PM2:**
```bash
# Install pm2 globally
npm install -g pm2

# Start worker
pm2 start npm --name pocketz-worker -- start

# View logs
pm2 logs pocketz-worker

# Auto-start on boot
pm2 startup
pm2 save
```

## How It Works

### 1. Initialization
- Worker launches Chrome browser with Pocketz extension loaded
- Connects to EC2 server WebSocket with authentication token
- Waits for download jobs

### 2. Job Processing
When a download job arrives:

1. **Report Started**: Sends `download_started` message to server
2. **Navigate**: Uses Playwright to navigate to URL
3. **Trigger Pocketz**: Simulates `Shift+Alt+O` keypress
4. **Wait**: Waits for configured timeout (default 15 seconds)
5. **Report Completion**: Sends `download_completed` message with success/error

### 3. Error Handling
- Automatic WebSocket reconnection if connection drops
- Browser errors are caught and reported to server
- Failed jobs are marked in database for retry

## Project Structure

```
pocketz-worker/
├── src/
│   ├── index.ts        # Main entry point
│   ├── config.ts       # Configuration management
│   ├── types.ts        # TypeScript interfaces
│   ├── browser.ts      # Playwright browser automation
│   └── websocket.ts    # WebSocket client
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Logging

The worker logs to console with prefixes for easy filtering:

- `[Worker]` - Main application logs
- `[Browser]` - Playwright/browser operations
- `[WebSocket]` - WebSocket connection events
- `[Config]` - Configuration loading

**Example output:**
```
╔═══════════════════════════════════════════════════════════╗
║           Pocketz Worker - Local Download Agent          ║
╚═══════════════════════════════════════════════════════════╝

Configuration loaded:
  EC2 WebSocket URL: ws://192.168.1.100:9600
  Chrome CDP URL: http://localhost:9222
  Pocketz Extension Path: /path/to/project/pocketz/chrome-extension
  Pocketz Server URL: http://localhost:6767
  Reconnect Delay: 5000 ms
  Download Timeout: 15000 ms

[Browser] Connecting to Chrome via CDP...
[Browser] CDP URL: http://localhost:9222
[Browser] ✅ Connected to Chrome successfully
[Browser] ✅ Using existing browser context
[Browser] ✅ Using existing page
[Browser] ✅ Browser ready

[WebSocket] Connecting to: ws://192.168.1.100:9600
[WebSocket] ✅ Connected to EC2 server

✅ Worker initialized and ready
💡 Waiting for download jobs from EC2 server...

[Worker] 📥 Received job dlq_01hmexz5kz2q9w3n0y7g8r6ktb
[Worker] URL: https://example.com
[Browser] Processing job dlq_01hmexz5kz2q9w3n0y7g8r6ktb: https://example.com
[Browser] Navigating to: https://example.com
[Browser] ✅ Page loaded
[Browser] Triggering Pocketz capture (Shift+Alt+O)...
[Browser] ✅ Pocketz triggered
[Browser] Waiting 15000ms for download to complete...
[Browser] ✅ Job dlq_01hmexz5kz2q9w3n0y7g8r6ktb completed successfully
[Worker] ✅ Job dlq_01hmexz5kz2q9w3n0y7g8r6ktb completed successfully
```

## Troubleshooting

### Worker won't connect to EC2 server

**Check:**
- Is EC2_WEBSOCKET_URL correct?
- Is POCKETZ_WORKER_TOKEN matching the server?
- Is EC2 server WebSocket listening on port 9600?
- Are firewall rules allowing WebSocket connections?

**Test WebSocket manually:**
```bash
# Install wscat
npm install -g wscat

# Test connection
wscat -c ws://your-ec2-ip:9600 -H "x-pocketz-token: your-token"
```

### Worker can't connect to Chrome

**Error:** `Failed to connect to browser`

**Check:**
1. Is Chrome running with remote debugging?
   ```bash
   # Check if port 9222 is listening
   lsof -i :9222
   # Or on Linux
   netstat -tuln | grep 9222
   ```

2. Is CDP URL correct in `.env`?
   ```bash
   cat .env | grep CHROME_CDP_URL
   ```

3. Test CDP connection manually:
   ```bash
   # Should return JSON with version info
   curl http://localhost:9222/json/version
   ```

4. Start Chrome if not running:
   ```bash
   google-chrome --remote-debugging-port=9222 --user-data-dir=/path/to/project
   ```

### Pocketz not capturing pages

**Check:**
- Is Pocketz server running? `sudo systemctl status pocketz`
- Is Pocketz extension loaded? Check chrome://extensions/
- Try manually triggering Shift+Alt+O in the automated browser
- Check Pocketz server logs: `sudo journalctl -u pocketz -f`

### Jobs timing out

**Increase timeout:**
```bash
# In .env
DOWNLOAD_TIMEOUT=30000  # 30 seconds
```

Large pages with many assets or PDFs may need more time.

## Development

### Build TypeScript
```bash
npm run build
```

### Run tests
```bash
npm test  # (once tests are added)
```

### Clean build artifacts
```bash
npm run clean
```

## Integration with EC2 Server

The EC2 server must implement:

1. **WebSocket Authentication**: Check `x-pocketz-token` header
2. **Job Queue**: `download_queue` table in `channels.db`
3. **Job Push**: Send `download_job` messages to worker
4. **Status Updates**: Handle `download_started` and `download_completed` messages

See `docs/RESEARCH-url-links.md` for complete server-side implementation details.

## Security

- **Token Authentication**: WebSocket connection requires valid token
- **Local Only**: Worker only processes jobs from authenticated EC2 server
- **No External Access**: Pocketz server (port 6767) only accessible locally
- **Environment Variables**: Sensitive config stored in .env (gitignored)

## License

MIT

## Support

For issues or questions, check:
- Main docs: `/docs/RESEARCH-url-links.md`
- Pocketz docs: `/pocketz/CLAUDE.md`
- Project README: `/CLAUDE.md`
