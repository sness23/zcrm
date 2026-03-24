#!/usr/bin/env node

import { program } from 'commander';
import { IRCApp } from './app.js';

async function main() {
  program
    .name('zcrm-irc')
    .description('IRC-style terminal interface for Zax CRM')
    .version('1.0.0')
    .option('--theme <name>', 'Color theme to use', 'default')
    .option('--no-watch', 'Disable file watching')
    .option('--vault <path>', 'Path to vault directory', './vault')
    .option('--api-url <url>', 'API server URL', 'http://localhost:9600')
    .parse();

  const options = program.opts();

  try {
    // Create and start app
    const app = new IRCApp();

    // Override config with CLI options if provided
    if (options.theme) {
      app['config'].theme = options.theme;
    }
    if (options.watch === false) {
      app['config'].watch_logs = false;
    }
    if (options.vault) {
      app['config'].vault_path = options.vault;
    }
    if (options.apiUrl) {
      app['config'].api_url = options.apiUrl;
    }

    // Start the app
    await app.start();
  } catch (error) {
    console.error('Failed to start IRC app:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
