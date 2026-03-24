# Future Pocketz Plans & Architecture

This document contains planned features, architectural improvements, and implementation options for Pocketz. These are aspirational and not yet implemented.

---

## Table of Contents

1. [Implementation Options](#implementation-options)
2. [Service Architecture](#service-architecture)
3. [Output Directory Naming Specification](#output-directory-naming)

---

## Implementation Options

Multiple implementation options for Pocketz, designed for users with different technical backgrounds and requirements.

### Target User Personas

1. **Casual Users** - Basic computer skills, simple one-click setup
2. **Tech-Savvy Users** - Comfortable with command line, customizable setup
3. **Power Users** - System administration experience, production-grade solution
4. **Developers** - Full-stack development, custom integrations

### Deployment Options Overview

| Option | Difficulty | Setup Time | Maintenance | Best For |
|--------|------------|------------|-------------|----------|
| **Docker Desktop** | ⭐ | 5 min | None | Casual users |
| **One-Click Installer** | ⭐⭐ | 10 min | Minimal | Tech-savvy users |
| **Cloud Deployment** | ⭐⭐⭐ | 30 min | Low | Remote access |
| **Local Service** | ⭐⭐⭐⭐ | 60 min | Medium | Power users |
| **Enterprise Setup** | ⭐⭐⭐⭐⭐ | 2-4 hours | High | Teams/orgs |

### Option 1: Docker Desktop

**Perfect for**: Casual users, quick testing, Windows/Mac users

Benefits:
- Zero configuration required
- Cross-platform compatibility
- Isolated environment
- Easy updates

```yaml
# docker-compose.yml
version: '3.8'

services:
  pocketz:
    image: node:18-alpine
    container_name: pocketz-server
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./server:/app
      - ${POCKETZ_DOWNLOADS_DIR}:/app/downloads
      - ${POCKETZ_VAULT_DIR}:/app/vault
      - ${POCKETZ_PAPERS_DIR}:/app/papers
    environment:
      - NODE_ENV=production
      - POCKETZ_API_KEY=${POCKETZ_API_KEY}
```

### Option 2: One-Click Installer

**Perfect for**: Tech-savvy users, developers, Linux/Mac users

Features:
- Native performance
- Automated installation script
- Customizable configuration
- Lightweight resource usage

Installation script would:
- Check prerequisites (Node.js, Git)
- Create service user
- Set up directories
- Configure systemd/launchd service
- Generate API keys

### Option 3: Cloud Deployment

**Perfect for**: Remote access, team collaboration

Platforms:
- Railway (easiest)
- DigitalOcean App Platform
- AWS EC2 (advanced)
- Heroku
- Vercel/Netlify (serverless)

### Option 4: Local Service

**Perfect for**: Power users, production deployments

Advanced features:
- Multi-user support
- Database integration (PostgreSQL)
- Redis caching
- Load balancing
- Advanced monitoring (Prometheus/Grafana)

### Option 5: Development Setup

For contributors and custom integrations:

```bash
git clone https://github.com/sness23/pocketz.git
cd pocketz
npm install
npm run dev
```

---

## Service Architecture

Planned production-ready deployment with systemd/launchd service management.

### Configuration Management

Environment-based configuration to replace hardcoded paths:

```bash
# Planned Environment Variables
POCKETZ_PORT=3000
POCKETZ_API_KEY=pocketz-api-key-2024
POCKETZ_DOWNLOADS_DIR=/var/lib/pocketz/downloads
POCKETZ_VAULT_DIR=/var/lib/pocketz/vault
POCKETZ_PAPERS_DIR=/var/lib/pocketz/papers
POCKETZ_LOG_DIR=/var/log/pocketz
NODE_ENV=production
```

### Linux Service Implementation (systemd)

```ini
# /etc/systemd/system/pocketz.service
[Unit]
Description=Pocketz URL Capture Service
After=network.target

[Service]
Type=simple
User=pocketz
Group=pocketz
WorkingDirectory=/opt/pocketz/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
EnvironmentFile=/etc/pocketz/config.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

### macOS Service Implementation (launchd)

```xml
<!-- /Library/LaunchDaemons/com.pocketz.service.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pocketz.service</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/opt/pocketz/server/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

### Enhanced Features

Planned improvements to server.js:

- **Structured Logging**: Winston for production logging
- **Health Checks**: `/health` endpoint
- **Graceful Shutdown**: SIGTERM/SIGINT handlers
- **Process Management**: PM2 or systemd
- **Monitoring**: Metrics and alerts
- **Backup Strategy**: Automated backups
- **Log Rotation**: logrotate configuration

---

## Output Directory Naming

### Current Implementation

**Format**: `YYYY-MM-DD_HHMMSS_<domain>_<article_id>`

Examples:
- `2025-08-19_143027_nature_s41467-025-62755-1`
- `2025-08-19_143512_arxiv_2408.12345v1`
- `2025-08-19_144003_github_microsoft_typescript`

### Naming Benefits

1. **Human Readable**: Clear date/time sorting
2. **Versioning**: Multiple captures of same content
3. **Source Identification**: Domain visible in name
4. **Content Identification**: Article/resource ID included
5. **Audit Trail**: Precise capture timestamp

### Domain Extractors

Implemented patterns:
- Nature: Extract from `/articles/<id>`
- arXiv: Extract from `/abs/<id>`
- GitHub: Extract `owner/repo`
- YouTube: Extract video ID
- PubMed: Extract PMC or article number
- MIT News: Extract article slug
- bioRxiv/medRxiv: Extract preprint ID

### Fallback Strategy

1. Try domain-specific article ID extraction
2. Use sanitized title (first 30 chars)
3. Use last URL path segment
4. Final fallback: timestamp

### Future Enhancements

**Option 1**: Enhanced with title snippet
```
YYYY-MM-DD_HHMMSS_<domain>_<title_snippet>_<hash>
```

**Option 2**: Content-first naming
```
<domain>_<article_id>_<uuid8>
```

**Option 3**: Configurable naming schemes per domain

---

## Additional Planned Features

### Database Integration

Replace flat file storage with PostgreSQL:
- URL storage with metadata
- Full-text search
- User management
- Tags and categories
- Activity tracking

### Multi-User Support

- User authentication
- Per-user vaults
- Shared collections
- Access control

### Advanced Download Features

- Retry logic for failed downloads
- Download queuing
- Progress tracking
- Bandwidth throttling
- Format conversion

### Search and Discovery

- Full-text search across saved content
- Tag-based filtering
- Date range queries
- Domain-based organization
- Obsidian graph integration

### Browser Extension Enhancements

- Options page for configuration
- Download progress indicator
- Saved items browser
- Quick search from extension
- Multiple vault support

### API Enhancements

- RESTful API with versioning
- GraphQL endpoint
- Webhook support
- OAuth authentication
- Rate limiting

---

## Migration Path

### Phase 1: Core Stability
- Environment-based configuration
- Structured logging
- Error handling improvements
- Basic health checks

### Phase 2: Service Management
- systemd/launchd integration
- Installation scripts
- Process monitoring
- Backup automation

### Phase 3: Enhanced Features
- Database integration
- Multi-user support
- Advanced search
- Web UI

### Phase 4: Enterprise Features
- Load balancing
- High availability
- Advanced monitoring
- LDAP/SSO integration

---

## Contributing

When implementing these features:
1. Start with Phase 1 improvements
2. Maintain backward compatibility
3. Add comprehensive tests
4. Update documentation
5. Follow existing code style

## References

- Original implementation options: README-implementation-options.md
- Service architecture: README-service.md
- Naming specification: SPEC-output-naming.md
