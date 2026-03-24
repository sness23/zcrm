# Pocketz systemd Service Setup

This guide walks you through setting up Pocketz as a systemd service on Ubuntu.

## Quick Start

```bash
# Run the installation script
sudo ./scripts/install-service.sh

# Start the service
sudo systemctl start pocketz

# Enable auto-start on boot
sudo systemctl enable pocketz

# Check status
sudo systemctl status pocketz
```

Done! Pocketz will now start automatically when your system boots.

## What the Installer Does

1. **Creates configuration directory**: `/etc/pocketz/`
2. **Generates environment config**: `/etc/pocketz/pocketz.env` with your paths
3. **Installs systemd service**: `/etc/systemd/system/pocketz.service`
4. **Creates required directories**: Ensures downloads and vault directories exist
5. **Reloads systemd**: Makes the service available

## Configuration

The service reads configuration from `/etc/pocketz/pocketz.env`:

```bash
# Server Settings
NODE_ENV=production
POCKETZ_PORT=6767
POCKETZ_API_KEY=pocketz-api-key-2024

# Path Configuration
POCKETZ_DOWNLOADS_DIR=$HOME/down
POCKETZ_VAULT_DIR=$HOME/data/vaults/pocketz
POCKETZ_PAPERS_DIR=$HOME/data/vaults/pocketz/papers
POCKETZ_INDEX_FILE=$HOME/data/vaults/pocketz/index.md
```

### Changing Configuration

```bash
# Edit the config file
sudo nano /etc/pocketz/pocketz.env

# Restart to apply changes
sudo systemctl restart pocketz

# Verify changes in logs
sudo journalctl -u pocketz -n 10
```

## Service Management

### Basic Commands

```bash
# Start the service
sudo systemctl start pocketz

# Stop the service
sudo systemctl stop pocketz

# Restart the service
sudo systemctl restart pocketz

# Check status
sudo systemctl status pocketz

# Enable auto-start on boot
sudo systemctl enable pocketz

# Disable auto-start
sudo systemctl disable pocketz
```

### Viewing Logs

```bash
# View recent logs
sudo journalctl -u pocketz -n 50

# Follow live logs
sudo journalctl -u pocketz -f

# View logs since last boot
sudo journalctl -u pocketz -b

# View logs from specific time
sudo journalctl -u pocketz --since "1 hour ago"
sudo journalctl -u pocketz --since "2024-01-15 14:00:00"

# Search logs for errors
sudo journalctl -u pocketz | grep -i error
```

## Troubleshooting

### Service Won't Start

```bash
# Check detailed status
sudo systemctl status pocketz

# View recent logs
sudo journalctl -u pocketz -n 100

# Check configuration file
sudo cat /etc/pocketz/pocketz.env

# Verify Node.js is installed
node --version

# Test manually
cd $HOME/github/sness23/pocketz/server
node server.js
```

### Service Starts But Extension Can't Connect

1. **Check if service is running**:
   ```bash
   sudo systemctl status pocketz
   ```

2. **Verify port 3000 is listening**:
   ```bash
   sudo netstat -tlnp | grep 3000
   # or
   sudo ss -tlnp | grep 3000
   ```

3. **Test with curl**:
   ```bash
   curl http://localhost:3000
   ```

4. **Check firewall** (if applicable):
   ```bash
   sudo ufw status
   ```

### Service Crashes After Starting

Check the logs for errors:
```bash
sudo journalctl -u pocketz -n 50
```

Common issues:
- **Permission denied**: Check directory permissions
- **Port already in use**: Another process is using port 3000
- **Module not found**: Run `npm install` in server directory

### Permission Issues

If the service can't write to directories:

```bash
# Check ownership
ls -la $HOME/down
ls -la $HOME/data/vaults/pocketz

# Fix ownership (replace 'sness' with your username)
sudo chown -R sness:sness $HOME/down
sudo chown -R sness:sness $HOME/data/vaults/pocketz
```

## Uninstalling

To remove the service:

```bash
# Stop and disable the service
sudo systemctl stop pocketz
sudo systemctl disable pocketz

# Remove service files
sudo rm /etc/systemd/system/pocketz.service
sudo rm -rf /etc/pocketz

# Reload systemd
sudo systemctl daemon-reload
```

## Upgrading

When you update the code:

```bash
# Pull latest changes
cd $HOME/github/sness23/pocketz
git pull

# Install any new dependencies
cd server
npm install

# Restart the service
sudo systemctl restart pocketz

# Check logs to verify
sudo journalctl -u pocketz -f
```

## Advanced Configuration

### Running on Different Port

Edit `/etc/pocketz/pocketz.env`:
```bash
POCKETZ_PORT=8080  # Or any other available port
```

Then restart:
```bash
sudo systemctl restart pocketz
```

Don't forget to update the Chrome extension's server URL!

### Using Custom Paths

You can point Pocketz to different directories by editing `/etc/pocketz/pocketz.env`:

```bash
POCKETZ_DOWNLOADS_DIR=/mnt/external/downloads
POCKETZ_VAULT_DIR=/mnt/external/vault
POCKETZ_PAPERS_DIR=/mnt/external/vault/papers
```

Ensure the service user has write access to these directories.

### Changing API Key

Edit `/etc/pocketz/pocketz.env`:
```bash
POCKETZ_API_KEY=my-secure-api-key-2024
```

Restart the service:
```bash
sudo systemctl restart pocketz
```

**Important**: You must also update the API key in the Chrome extension's `background.js` file.

## Monitoring

### Check if Service is Running

```bash
# Quick status check
sudo systemctl is-active pocketz

# Detailed status
sudo systemctl status pocketz
```

### Auto-restart Configuration

The service is configured to automatically restart if it crashes:
- Restart policy: `always`
- Restart delay: 10 seconds

This is configured in the service file at `/etc/systemd/system/pocketz.service`.

### Resource Usage

Check memory and CPU usage:
```bash
# Using systemd
systemctl status pocketz

# Using top
top -p $(pgrep -f "node server.js")

# Using htop
htop -p $(pgrep -f "node server.js")
```

## Files and Locations

- **Service file**: `/etc/systemd/system/pocketz.service`
- **Configuration**: `/etc/pocketz/pocketz.env`
- **Logs**: `sudo journalctl -u pocketz`
- **Server code**: `$HOME/github/sness23/pocketz/server/`
- **Downloads**: `$HOME/down/` (or custom path)
- **Vault**: `$HOME/data/vaults/pocketz/` (or custom path)

## Security Considerations

The service runs as your user account (`sness`) and has:
- `NoNewPrivileges=true` - Cannot escalate privileges
- Access only to configured directories
- Logs visible to root and user

For production use, consider:
- Changing the default API key
- Using HTTPS with a reverse proxy
- Running as dedicated service user
- Implementing rate limiting

## Getting Help

If you encounter issues:

1. Check logs: `sudo journalctl -u pocketz -n 100`
2. Verify configuration: `sudo cat /etc/pocketz/pocketz.env`
3. Test manually: `cd server && node server.js`
4. Check GitHub issues: https://github.com/sness23/pocketz/issues
