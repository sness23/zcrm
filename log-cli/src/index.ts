#!/usr/bin/env node

import { program } from 'commander';
import { LogViewer } from './viewer.js';

async function main() {
  program
    .name('fscrm-log')
    .description('Simple log viewer for FS-CRM events')
    .version('1.0.0')
    .option('--vault <path>', 'Path to vault directory', '../vault')
    .option('--days <number>', 'Number of days to load', '7')
    .option('--watch', 'Watch for new events', true)
    .option('--no-watch', 'Disable file watching')
    .parse();

  const options = program.opts();

  try {
    const viewer = new LogViewer({
      vaultPath: options.vault,
      days: parseInt(options.days),
      watch: options.watch
    });

    await viewer.start();
  } catch (error) {
    console.error('Failed to start log viewer:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Start
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
