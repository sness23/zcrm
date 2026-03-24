# Pocketz Service Architecture & Deployment Guide

This document provides a comprehensive guide for deploying Pocketz as a system service on Linux and macOS, enabling automatic startup and reliable operation.

## 🏗️ Service Architecture Overview

### Current System Analysis
The existing Pocketz server is a Node.js Express application that:
- Runs on port 3000
- Uses hardcoded paths (`$HOME/down`, `$HOME/data/vaults/pocketz`)
- Requires manual startup
- Has no process management or monitoring
- Lacks configuration management

### Service Architecture Goals
- **Cross-Platform**: Support both Linux (systemd) and macOS (launchd)
- **Auto-Start**: Start automatically on system boot
- **Process Management**: Automatic restart on failure
- **Configuration**: Environment-based configuration
- **Logging**: Structured logging with rotation
- **Monitoring**: Health checks and status reporting
- **Security**: Proper user isolation and permissions

## 🔧 Service Implementation Strategy

### 1. Configuration Management

#### Environment-Based Configuration
Replace hardcoded paths with environment variables:

```bash
# Service Configuration
POCKETZ_PORT=3000
POCKETZ_API_KEY=pocketz-api-key-2024
POCKETZ_USER=pocketz
POCKETZ_GROUP=pocketz

# Path Configuration
POCKETZ_DOWNLOADS_DIR=/var/lib/pocketz/downloads
POCKETZ_VAULT_DIR=/var/lib/pocketz/vault
POCKETZ_PAPERS_DIR=/var/lib/pocketz/papers
POCKETZ_LOG_DIR=/var/log/pocketz
POCKETZ_CONFIG_DIR=/etc/pocketz

# Optional: Custom paths for user-specific deployments
POCKETZ_CUSTOM_DOWNLOADS_DIR=
POCKETZ_CUSTOM_VAULT_DIR=
```

#### Configuration File Structure
```
/etc/pocketz/
├── config.env          # Main configuration
├── config.local.env    # Local overrides (not tracked in git)
└── logging.conf        # Logging configuration
```

### 2. Service User & Permissions

#### Service User Creation
```bash
# Linux
sudo useradd -r -s /bin/false -d /var/lib/pocketz -c "Pocketz Service" pocketz
sudo groupadd pocketz

# macOS
sudo dscl . -create /Users/pocketz
sudo dscl . -create /Users/pocketz UserShell /usr/bin/false
sudo dscl . -create /Users/pocketz RealName "Pocketz Service"
sudo dscl . -create /Users/pocketz UniqueID 501
sudo dscl . -create /Users/pocketz PrimaryGroupID 20
```

#### Directory Permissions
```bash
# Create service directories
sudo mkdir -p /var/lib/pocketz/{downloads,vault,papers}
sudo mkdir -p /var/log/pocketz
sudo mkdir -p /etc/pocketz

# Set ownership
sudo chown -R pocketz:pocketz /var/lib/pocketz
sudo chown -R pocketz:pocketz /var/log/pocketz
sudo chown -R pocketz:pocketz /etc/pocketz

# Set permissions
sudo chmod 755 /var/lib/pocketz
sudo chmod 755 /var/log/pocketz
sudo chmod 755 /etc/pocketz
sudo chmod 600 /etc/pocketz/config.env
```

## 🐧 Linux Service Implementation (systemd)

### systemd Service File
```ini
# /etc/systemd/system/pocketz.service
[Unit]
Description=Pocketz URL Capture Service
Documentation=https://github.com/sness23/pocketz
After=network.target
Wants=network.target

[Service]
Type=simple
User=pocketz
Group=pocketz
WorkingDirectory=/opt/pocketz/server
ExecStart=/usr/bin/node server.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pocketz

# Environment
Environment=NODE_ENV=production
EnvironmentFile=/etc/pocketz/config.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/pocketz /var/log/pocketz /etc/pocketz

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

### Service Management Commands
```bash
# Install and enable service
sudo systemctl daemon-reload
sudo systemctl enable pocketz.service
sudo systemctl start pocketz.service

# Service management
sudo systemctl status pocketz.service
sudo systemctl stop pocketz.service
sudo systemctl restart pocketz.service
sudo systemctl reload pocketz.service

# View logs
sudo journalctl -u pocketz.service -f
sudo journalctl -u pocketz.service --since "1 hour ago"
```

## 🍎 macOS Service Implementation (launchd)

### LaunchDaemon Plist
```xml
<!-- /Library/LaunchDaemons/com.pocketz.service.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pocketz.service</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/opt/pocketz/server/server.js</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/opt/pocketz/server</string>
    
    <key>UserName</key>
    <string>pocketz</string>
    
    <key>GroupName</key>
    <string>pocketz</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>StandardOutPath</key>
    <string>/var/log/pocketz/pocketz.log</string>
    
    <key>StandardErrorPath</key>
    <string>/var/log/pocketz/pocketz.error.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>POCKETZ_PORT</key>
        <string>3000</string>
        <key>POCKETZ_API_KEY</key>
        <string>pocketz-api-key-2024</string>
    </dict>
    
    <key>ProcessType</key>
    <string>Background</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
```

### macOS Service Management
```bash
# Load and start service
sudo launchctl load /Library/LaunchDaemons/com.pocketz.service.plist
sudo launchctl start com.pocketz.service

# Service management
sudo launchctl list | grep pocketz
sudo launchctl stop com.pocketz.service
sudo launchctl unload /Library/LaunchDaemons/com.pocketz.service.plist

# View logs
tail -f /var/log/pocketz/pocketz.log
tail -f /var/log/pocketz/pocketz.error.log
```

## 📦 Enhanced Server Implementation

### Modified Server.js with Service Features
```javascript
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const winston = require('winston');

const execAsync = promisify(exec);

// Configuration from environment
const config = {
  port: process.env.POCKETZ_PORT || 3000,
  apiKey: process.env.POCKETZ_API_KEY || 'pocketz-api-key-2024',
  downloadsDir: process.env.POCKETZ_DOWNLOADS_DIR || '/var/lib/pocketz/downloads',
  vaultDir: process.env.POCKETZ_VAULT_DIR || '/var/lib/pocketz/vault',
  papersDir: process.env.POCKETZ_PAPERS_DIR || '/var/lib/pocketz/papers',
  logDir: process.env.POCKETZ_LOG_DIR || '/var/log/pocketz',
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Configure logging
const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(config.logDir, 'pocketz-error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(config.logDir, 'pocketz-combined.log') 
    })
  ]
});

// Add console transport for development
if (config.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Existing API endpoints with enhanced error handling and logging
// ... (rest of the existing server code with logger integration)

const server = app.listen(config.port, () => {
  logger.info(`Pocketz server running on port ${config.port}`, {
    port: config.port,
    nodeEnv: config.nodeEnv,
    downloadsDir: config.downloadsDir,
    vaultDir: config.vaultDir
  });
});
```

## 🚀 Installation Scripts

### Linux Installation Script
```bash
#!/bin/bash
# install-linux.sh

set -e

echo "Installing Pocketz Service on Linux..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Detect distribution
if command -v apt-get &> /dev/null; then
    PACKAGE_MANAGER="apt"
elif command -v yum &> /dev/null; then
    PACKAGE_MANAGER="yum"
elif command -v dnf &> /dev/null; then
    PACKAGE_MANAGER="dnf"
else
    echo "Unsupported package manager"
    exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    if [[ $PACKAGE_MANAGER == "apt" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [[ $PACKAGE_MANAGER == "yum" || $PACKAGE_MANAGER == "dnf" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        $PACKAGE_MANAGER install -y nodejs
    fi
fi

# Create service user
echo "Creating service user..."
useradd -r -s /bin/false -d /var/lib/pocketz -c "Pocketz Service" pocketz || true
groupadd pocketz || true

# Create directories
echo "Creating directories..."
mkdir -p /opt/pocketz/server
mkdir -p /var/lib/pocketz/{downloads,vault,papers}
mkdir -p /var/log/pocketz
mkdir -p /etc/pocketz

# Copy application files
echo "Installing application files..."
cp -r server/* /opt/pocketz/server/
cd /opt/pocketz/server
npm install --production

# Install additional dependencies for service features
npm install winston

# Set permissions
chown -R pocketz:pocketz /var/lib/pocketz
chown -R pocketz:pocketz /var/log/pocketz
chown -R pocketz:pocketz /etc/pocketz
chown -R pocketz:pocketz /opt/pocketz

chmod 755 /var/lib/pocketz
chmod 755 /var/log/pocketz
chmod 755 /etc/pocketz
chmod 600 /etc/pocketz/config.env

# Create configuration file
cat > /etc/pocketz/config.env << EOF
POCKETZ_PORT=3000
POCKETZ_API_KEY=pocketz-api-key-2024
POCKETZ_DOWNLOADS_DIR=/var/lib/pocketz/downloads
POCKETZ_VAULT_DIR=/var/lib/pocketz/vault
POCKETZ_PAPERS_DIR=/var/lib/pocketz/papers
POCKETZ_LOG_DIR=/var/log/pocketz
NODE_ENV=production
EOF

# Install systemd service
echo "Installing systemd service..."
cp scripts/pocketz.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable pocketz.service

echo "Installation complete!"
echo "To start the service: sudo systemctl start pocketz.service"
echo "To check status: sudo systemctl status pocketz.service"
echo "To view logs: sudo journalctl -u pocketz.service -f"
```

### macOS Installation Script
```bash
#!/bin/bash
# install-macos.sh

set -e

echo "Installing Pocketz Service on macOS..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    if command -v brew &> /dev/null; then
        brew install node
    else
        echo "Please install Homebrew first: https://brew.sh/"
        exit 1
    fi
fi

# Create service user
echo "Creating service user..."
dscl . -create /Users/pocketz || true
dscl . -create /Users/pocketz UserShell /usr/bin/false
dscl . -create /Users/pocketz RealName "Pocketz Service"
dscl . -create /Users/pocketz UniqueID 501
dscl . -create /Users/pocketz PrimaryGroupID 20

# Create directories
echo "Creating directories..."
mkdir -p /opt/pocketz/server
mkdir -p /var/lib/pocketz/{downloads,vault,papers}
mkdir -p /var/log/pocketz
mkdir -p /etc/pocketz

# Copy application files
echo "Installing application files..."
cp -r server/* /opt/pocketz/server/
cd /opt/pocketz/server
npm install --production

# Install additional dependencies
npm install winston

# Set permissions
chown -R pocketz:staff /var/lib/pocketz
chown -R pocketz:staff /var/log/pocketz
chown -R pocketz:staff /etc/pocketz
chown -R pocketz:staff /opt/pocketz

# Create configuration file
cat > /etc/pocketz/config.env << EOF
POCKETZ_PORT=3000
POCKETZ_API_KEY=pocketz-api-key-2024
POCKETZ_DOWNLOADS_DIR=/var/lib/pocketz/downloads
POCKETZ_VAULT_DIR=/var/lib/pocketz/vault
POCKETZ_PAPERS_DIR=/var/lib/pocketz/papers
POCKETZ_LOG_DIR=/var/log/pocketz
NODE_ENV=production
EOF

# Install launchd service
echo "Installing launchd service..."
cp scripts/com.pocketz.service.plist /Library/LaunchDaemons/
launchctl load /Library/LaunchDaemons/com.pocketz.service.plist

echo "Installation complete!"
echo "To start the service: sudo launchctl start com.pocketz.service"
echo "To check status: sudo launchctl list | grep pocketz"
echo "To view logs: tail -f /var/log/pocketz/pocketz.log"
```

## 📊 Monitoring & Maintenance

### Health Monitoring
```bash
# Health check endpoint
curl http://localhost:3000/health

# Service status
# Linux
sudo systemctl status pocketz.service

# macOS
sudo launchctl list | grep pocketz
```

### Log Management
```bash
# Log rotation configuration
# /etc/logrotate.d/pocketz
/var/log/pocketz/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 pocketz pocketz
    postrotate
        systemctl reload pocketz.service
    endscript
}
```

### Backup Strategy
```bash
#!/bin/bash
# backup-pocketz.sh

BACKUP_DIR="/backup/pocketz"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup vault data
tar -czf "$BACKUP_DIR/pocketz_vault_$DATE.tar.gz" /var/lib/pocketz/vault

# Backup configuration
tar -czf "$BACKUP_DIR/pocketz_config_$DATE.tar.gz" /etc/pocketz

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/pocketz_vault_$DATE.tar.gz"
```

## 🔒 Security Considerations

### Network Security
- **Firewall Configuration**: Only allow port 3000 from localhost
- **API Key Security**: Use strong, unique API keys
- **HTTPS**: Consider reverse proxy with SSL termination

### File System Security
- **User Isolation**: Run service as non-privileged user
- **Directory Permissions**: Restrict access to service directories
- **File Validation**: Validate uploaded content types

### Process Security
- **Resource Limits**: Set memory and CPU limits
- **Sandboxing**: Use systemd security features
- **Logging**: Monitor for suspicious activity

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Review and customize configuration
- [ ] Set strong API key
- [ ] Configure firewall rules
- [ ] Set up log rotation
- [ ] Plan backup strategy

### Deployment
- [ ] Run installation script
- [ ] Verify service starts correctly
- [ ] Test API endpoints
- [ ] Check log files
- [ ] Verify file permissions

### Post-Deployment
- [ ] Monitor service status
- [ ] Test Chrome extension integration
- [ ] Verify file organization
- [ ] Set up monitoring alerts
- [ ] Document custom configurations

## 🔧 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service status
sudo systemctl status pocketz.service

# Check logs
sudo journalctl -u pocketz.service -n 50

# Check configuration
sudo -u pocketz node /opt/pocketz/server/server.js
```

#### Permission Issues
```bash
# Fix ownership
sudo chown -R pocketz:pocketz /var/lib/pocketz
sudo chown -R pocketz:pocketz /var/log/pocketz

# Fix permissions
sudo chmod 755 /var/lib/pocketz
sudo chmod 755 /var/log/pocketz
```

#### Port Conflicts
```bash
# Check port usage
sudo netstat -tlnp | grep :3000

# Change port in configuration
sudo nano /etc/pocketz/config.env
sudo systemctl restart pocketz.service
```

This service architecture provides a robust, production-ready deployment of Pocketz that can run reliably on both Linux and macOS systems with proper process management, logging, and security features.