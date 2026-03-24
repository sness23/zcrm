#!/bin/bash
# Pocketz Service Installation Script for Ubuntu
# This script sets up Pocketz to run as a systemd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Pocketz Service Installation Tool   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if running with sudo
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}✗ This script must be run with sudo${NC}"
   echo "  Usage: sudo ./scripts/install-service.sh"
   exit 1
fi

# Get the real user (not root)
REAL_USER=${SUDO_USER:-$USER}
REAL_HOME=$(eval echo ~$REAL_USER)

echo -e "${YELLOW}Installing as user: $REAL_USER${NC}"
echo -e "${YELLOW}Home directory: $REAL_HOME${NC}"
echo ""

# Determine script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
SERVER_DIR="$PROJECT_ROOT/server"

echo -e "${BLUE}→ Creating configuration directory...${NC}"
mkdir -p /etc/pocketz

echo -e "${BLUE}→ Copying environment configuration...${NC}"
if [ -f /etc/pocketz/pocketz.env ]; then
    echo -e "${YELLOW}  ⚠ Configuration already exists at /etc/pocketz/pocketz.env${NC}"
    echo -e "${YELLOW}  ⚠ Backing up to /etc/pocketz/pocketz.env.backup${NC}"
    cp /etc/pocketz/pocketz.env /etc/pocketz/pocketz.env.backup
fi

# Create environment file from template
cat > /etc/pocketz/pocketz.env << EOF
# Pocketz Server Configuration
# Generated on $(date)

# Server Settings
NODE_ENV=production
POCKETZ_PORT=6767
POCKETZ_API_KEY=pocketz-api-key-2024

# Path Configuration
POCKETZ_DOWNLOADS_DIR=$REAL_HOME/down
POCKETZ_VAULT_DIR=$REAL_HOME/data/vaults/pocketz
POCKETZ_PAPERS_DIR=$REAL_HOME/data/vaults/pocketz/papers
POCKETZ_INDEX_FILE=$REAL_HOME/data/vaults/pocketz/index.md
EOF

chmod 600 /etc/pocketz/pocketz.env
echo -e "${GREEN}  ✓ Configuration created${NC}"

echo -e "${BLUE}→ Installing systemd service file...${NC}"
# Update service file with actual paths
sed -e "s|User=sness|User=$REAL_USER|g" \
    -e "s|Group=sness|Group=$REAL_USER|g" \
    -e "s|WorkingDirectory=.*|WorkingDirectory=$SERVER_DIR|g" \
    "$SERVER_DIR/pocketz.service" > /etc/systemd/system/pocketz.service

chmod 644 /etc/systemd/system/pocketz.service
echo -e "${GREEN}  ✓ Service file installed${NC}"

echo -e "${BLUE}→ Creating required directories...${NC}"
# Create directories only if they don't exist, and only chown the new ones
if [ ! -d "$REAL_HOME/down" ]; then
    mkdir -p "$REAL_HOME/down"
    chown $REAL_USER:$REAL_USER "$REAL_HOME/down"
fi
if [ ! -d "$REAL_HOME/data/vaults/pocketz" ]; then
    mkdir -p "$REAL_HOME/data/vaults/pocketz/papers"
    chown -R $REAL_USER:$REAL_USER "$REAL_HOME/data/vaults/pocketz"
fi
echo -e "${GREEN}  ✓ Directories ready${NC}"

echo -e "${BLUE}→ Reloading systemd...${NC}"
systemctl daemon-reload
echo -e "${GREEN}  ✓ systemd reloaded${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Complete! 🎉         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Service Configuration:${NC}"
echo -e "  Config file: ${YELLOW}/etc/pocketz/pocketz.env${NC}"
echo -e "  Service file: ${YELLOW}/etc/systemd/system/pocketz.service${NC}"
echo -e "  Working directory: ${YELLOW}$SERVER_DIR${NC}"
echo ""
echo -e "${BLUE}Quick Start Commands:${NC}"
echo -e "  ${GREEN}sudo systemctl start pocketz${NC}       Start the service"
echo -e "  ${GREEN}sudo systemctl enable pocketz${NC}      Enable auto-start on boot"
echo -e "  ${GREEN}sudo systemctl status pocketz${NC}      Check service status"
echo -e "  ${GREEN}sudo journalctl -u pocketz -f${NC}      View live logs"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Review configuration: ${YELLOW}sudo nano /etc/pocketz/pocketz.env${NC}"
echo "  2. Start the service: ${YELLOW}sudo systemctl start pocketz${NC}"
echo "  3. Enable auto-start: ${YELLOW}sudo systemctl enable pocketz${NC}"
echo "  4. Check status: ${YELLOW}sudo systemctl status pocketz${NC}"
echo ""
