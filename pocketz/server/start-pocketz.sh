#!/bin/bash
# Pocketz service startup script
# This sources nvm and starts the server

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Change to server directory
cd $HOME/github/sness23/pocketz/server

# Start the server
exec node server.js
