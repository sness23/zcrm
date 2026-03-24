# Pocketz Service Setup for Ubuntu

This document outlines options for running Pocketz as a proper system service on Ubuntu that starts automatically and logs to standard locations.

## Current State

- **Manual startup**: Server must be started manually with `npm start`
- **Hardcoded paths**: `$HOME/down` and `$HOME/data/vaults/pocketz`
- **Console logging**: Logs only to console and `server/urls.md`
- **No process management**: No auto-restart on crash
- **User-specific**: Runs as your user account

## Service Requirements

1. **Auto-start on boot**: Service should start when Ubuntu starts
2. **Auto-restart on crash**: If the process dies, it should restart
3. **Standard logging**: Logs should go to `/var/log/pocketz/` or systemd journal
4. **User isolation**: Run as dedicated service user (optional but recommended)
5. **Environment configuration**: Use environment variables instead of hardcoded paths
6. **Process management**: Single source of truth for service state

---

## Option 1: systemd (Recommended)

**Best for**: Production use, standard Ubuntu installations, integration with system

### Why systemd?

- ✅ **Native to Ubuntu**: Built into Ubuntu 16.04+
- ✅ **Standard logging**: Integrates with journald
- ✅ **Auto-restart**: Built-in restart policies
- ✅ **Service management**: Standard `systemctl` commands
- ✅ **Boot integration**: Automatic startup on boot
- ✅ **Resource limits**: Can set memory/CPU limits
- ✅ **Security**: Good sandboxing options

### Implementation Steps

#### 1. Create Environment Configuration

```bash
# Create config directory
sudo mkdir -p /etc/pocketz

# Create environment file
sudo tee /etc/pocketz/pocketz.env > /dev/null << 'EOF'
# Server Configuration
NODE_ENV=production
POCKETZ_PORT=6767
POCKETZ_API_KEY=pocketz-api-key-2024

# Path Configuration
POCKETZ_DOWNLOADS_DIR=$HOME/down
POCKETZ_VAULT_DIR=$HOME/data/vaults/pocketz
POCKETZ_PAPERS_DIR=$HOME/data/vaults/pocketz/papers
POCKETZ_INDEX_FILE=$HOME/data/vaults/pocketz/index.md
POCKETZ_LOG_DIR=/var/log/pocketz
EOF

# Secure the config file
sudo chmod 600 /etc/pocketz/pocketz.env
```

#### 2. Create systemd Service File

```bash
sudo tee /etc/systemd/system/pocketz.service > /dev/null << 'EOF'
[Unit]
Description=Pocketz URL Capture Service
Documentation=https://github.com/sness23/pocketz
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=sness
Group=sness
WorkingDirectory=$HOME/github/sness23/pocketz/server

# Main process
ExecStart=/usr/bin/node server.js

# Restart policy
Restart=always
RestartSec=10

# Environment
EnvironmentFile=/etc/pocketz/pocketz.env

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pocketz

# Security (optional - can be tightened)
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
```

#### 3. Create Log Directory

```bash
sudo mkdir -p /var/log/pocketz
sudo chown sness:sness /var/log/pocketz
sudo chmod 755 /var/log/pocketz
```

#### 4. Enable and Start Service

```bash
# Reload systemd to recognize new service
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable pocketz.service

# Start the service now
sudo systemctl start pocketz.service

# Check status
sudo systemctl status pocketz.service
```

### Service Management Commands

```bash
# Start service
sudo systemctl start pocketz

# Stop service
sudo systemctl stop pocketz

# Restart service
sudo systemctl restart pocketz

# Check status
sudo systemctl status pocketz

# View logs (last 50 lines)
sudo journalctl -u pocketz -n 50

# Follow logs in real-time
sudo journalctl -u pocketz -f

# View logs since last boot
sudo journalctl -u pocketz -b

# View logs from last hour
sudo journalctl -u pocketz --since "1 hour ago"

# Disable auto-start
sudo systemctl disable pocketz

# Check if enabled
sudo systemctl is-enabled pocketz
```

### Logging Options with systemd

#### Option A: Journal Only (Simplest)
Logs go to systemd journal, viewable with `journalctl`.

**Pros**: Automatic rotation, structured logging, integrated with system
**Cons**: Need to use `journalctl` to view logs

#### Option B: Journal + File (Flexible)
Configure rsyslog to also write to files:

```bash
# Create rsyslog configuration
sudo tee /etc/rsyslog.d/30-pocketz.conf > /dev/null << 'EOF'
if $programname == 'pocketz' then /var/log/pocketz/pocketz.log
& stop
EOF

# Restart rsyslog
sudo systemctl restart rsyslog
```

Then set up log rotation:

```bash
sudo tee /etc/logrotate.d/pocketz > /dev/null << 'EOF'
/var/log/pocketz/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 sness sness
    postrotate
        systemctl reload rsyslog > /dev/null 2>&1 || true
    endscript
}
EOF
```

### Code Changes Required

Update `server/server.js` to use environment variables:

```javascript
// Replace hardcoded values with:
const PORT = process.env.POCKETZ_PORT || 3000;
const API_KEY = process.env.POCKETZ_API_KEY || 'pocketz-api-key-2024';
const DOWNLOADS_DIR = process.env.POCKETZ_DOWNLOADS_DIR || '$HOME/down';
const VAULT_DIR = process.env.POCKETZ_VAULT_DIR || '$HOME/data/vaults/pocketz';
const PAPERS_DIR = process.env.POCKETZ_PAPERS_DIR || '$HOME/data/vaults/pocketz/papers';
const INDEX_FILE = process.env.POCKETZ_INDEX_FILE || '$HOME/data/vaults/pocketz/index.md';
```

---

## Option 2: PM2 with systemd

**Best for**: Node.js developers, want monitoring dashboard, need clustering

### Why PM2?

- ✅ **Node.js focused**: Built for Node.js apps
- ✅ **Monitoring**: Built-in dashboard and monitoring
- ✅ **Easy setup**: Simple commands
- ✅ **Log management**: Automatic log rotation
- ✅ **Clustering**: Can run multiple instances
- ✅ **Zero-downtime reload**: For updates

### Implementation Steps

#### 1. Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Or with yarn
sudo yarn global add pm2
```

#### 2. Create PM2 Ecosystem File

```bash
# In pocketz/server/ directory
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'pocketz',
    script: './server.js',
    cwd: '$HOME/github/sness23/pocketz/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      POCKETZ_PORT: 3000,
      POCKETZ_API_KEY: 'pocketz-api-key-2024',
      POCKETZ_DOWNLOADS_DIR: '$HOME/down',
      POCKETZ_VAULT_DIR: '$HOME/data/vaults/pocketz',
      POCKETZ_PAPERS_DIR: '$HOME/data/vaults/pocketz/papers',
      POCKETZ_INDEX_FILE: '$HOME/data/vaults/pocketz/index.md'
    },
    error_file: '/var/log/pocketz/error.log',
    out_file: '/var/log/pocketz/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
EOF
```

#### 3. Start with PM2

```bash
# Create log directory
sudo mkdir -p /var/log/pocketz
sudo chown sness:sness /var/log/pocketz

# Start the app
cd $HOME/github/sness23/pocketz/server
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Generate systemd startup script
pm2 startup systemd

# The above command will output a command to run - run it
# It will look like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u sness --hp /home/sness
```

### PM2 Management Commands

```bash
# Start app
pm2 start pocketz

# Stop app
pm2 stop pocketz

# Restart app
pm2 restart pocketz

# Reload with zero downtime
pm2 reload pocketz

# Delete from PM2
pm2 delete pocketz

# View status
pm2 status

# View logs
pm2 logs pocketz

# View logs (last 100 lines)
pm2 logs pocketz --lines 100

# Monitor in real-time
pm2 monit

# View detailed info
pm2 info pocketz

# Flush logs
pm2 flush
```

### PM2 Log Rotation

PM2 includes automatic log rotation:

```bash
# Install PM2 log rotate module
pm2 install pm2-logrotate

# Configure rotation (optional)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

---

## Option 3: Docker with systemd

**Best for**: Want isolation, deploying to multiple systems, prefer containers

### Why Docker?

- ✅ **Isolation**: Separate from host system
- ✅ **Portable**: Easy to move between systems
- ✅ **Reproducible**: Same environment everywhere
- ✅ **Easy cleanup**: Remove container = clean system

### Implementation Steps

#### 1. Create Dockerfile

```dockerfile
# In pocketz/server/ directory
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy server code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
```

#### 2. Create docker-compose.yml

```yaml
# In pocketz/ directory
version: '3.8'

services:
  pocketz:
    build: ./server
    container_name: pocketz-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - $HOME/down:/app/downloads
      - $HOME/data/vaults/pocketz:/app/vault
      - /var/log/pocketz:/app/logs
    environment:
      - NODE_ENV=production
      - POCKETZ_PORT=3000
      - POCKETZ_API_KEY=pocketz-api-key-2024
      - POCKETZ_DOWNLOADS_DIR=/app/downloads
      - POCKETZ_VAULT_DIR=/app/vault
      - POCKETZ_PAPERS_DIR=/app/vault/papers
      - POCKETZ_INDEX_FILE=/app/vault/index.md
      - POCKETZ_LOG_DIR=/app/logs
```

#### 3. Create systemd Service for Docker

```bash
sudo tee /etc/systemd/system/pocketz-docker.service > /dev/null << 'EOF'
[Unit]
Description=Pocketz Docker Container
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$HOME/github/sness23/pocketz
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pocketz-docker
sudo systemctl start pocketz-docker
```

### Docker Management

```bash
# Start container
docker-compose up -d

# Stop container
docker-compose down

# View logs
docker-compose logs -f pocketz

# Restart container
docker-compose restart pocketz

# Rebuild and restart
docker-compose up -d --build
```

---

## Comparison Matrix

| Feature | systemd | PM2 | Docker |
|---------|---------|-----|--------|
| **Setup Complexity** | Medium | Easy | Medium-High |
| **Native to Ubuntu** | ✅ Yes | ❌ Needs install | ❌ Needs Docker |
| **Auto-restart** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Log Management** | journald | Built-in rotation | Container logs |
| **Monitoring** | Basic | ✅ Dashboard | Docker stats |
| **Resource Usage** | Low | Low-Medium | Medium-High |
| **Isolation** | Limited | None | ✅ Strong |
| **Clustering** | Manual | ✅ Built-in | Docker Swarm |
| **Zero-downtime** | ❌ No | ✅ Yes | ❌ No |
| **Learning Curve** | Medium | Low | High |

---

## Recommended Approach

### For Your Setup: systemd (Option 1)

**Reasons:**
1. **Native to Ubuntu**: No additional software needed
2. **Standard logging**: Easy to view with `journalctl`
3. **System integration**: Works with Ubuntu's service management
4. **Simple**: Just one service file and one config file
5. **Secure**: Good security options available
6. **Familiar**: Same commands as other system services

**Steps to Implement:**
1. Update `server.js` to use environment variables
2. Create `/etc/pocketz/pocketz.env` config file
3. Create `/etc/systemd/system/pocketz.service` file
4. Enable and start: `sudo systemctl enable --now pocketz`
5. View logs: `sudo journalctl -u pocketz -f`

### Alternative: PM2 if you want...
- Built-in monitoring dashboard
- Easier log management
- More Node.js-specific features

### Alternative: Docker if you want...
- Complete isolation
- Plan to deploy to multiple systems
- Want containerized architecture

---

## Next Steps

1. **Choose approach** (recommend systemd)
2. **Update server.js** to use environment variables
3. **Create service files** for chosen approach
4. **Test service** start/stop/restart
5. **Verify logging** works as expected
6. **Test auto-start** by rebooting
7. **Update CLAUDE.md** with service management commands

---

## Testing Checklist

After setup, verify:

- [ ] Service starts automatically after reboot
- [ ] Service restarts automatically if it crashes
- [ ] Logs are being written to expected location
- [ ] Can view logs with standard commands
- [ ] Extension can connect to server
- [ ] URLs are being saved correctly
- [ ] Service stops cleanly with stop command
- [ ] Environment variables are being read correctly
