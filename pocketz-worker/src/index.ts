#!/usr/bin/env node

/**
 * Pocketz Worker
 *
 * Local worker that connects to EC2 server via WebSocket and processes
 * download jobs by automating a Chrome browser with Pocketz extension.
 */

import { config, validateConfig } from './config.js';
import { initBrowser, processJob, closeBrowser, isBrowserReady } from './browser.js';
import { connectWebSocket, sendMessage, closeWebSocket } from './websocket.js';
import type { DownloadJob } from './types.js';

/**
 * Handle download job from server
 */
async function handleDownloadJob(job: DownloadJob): Promise<void> {
  console.log(`\n[Worker] 📥 Received job ${job.id}`);
  console.log(`[Worker] URL: ${job.url}`);

  // Check browser is ready
  if (!isBrowserReady()) {
    console.error('[Worker] Browser not ready, cannot process job');
    sendMessage({
      type: 'download_completed',
      jobId: job.id,
      timestamp: new Date().toISOString(),
      success: false,
      error: 'Browser not initialized'
    });
    return;
  }

  // Report job started
  sendMessage({
    type: 'download_started',
    jobId: job.id,
    timestamp: new Date().toISOString()
  });

  // Process the job
  const result = await processJob(job.id, job.url);

  // Report completion
  sendMessage({
    type: 'download_completed',
    jobId: job.id,
    timestamp: new Date().toISOString(),
    success: result.success,
    error: result.error,
    pocketzDirectoryName: result.pocketzDirectoryName
  });

  if (result.success) {
    console.log(`[Worker] ✅ Job ${job.id} completed successfully\n`);
  } else {
    console.error(`[Worker] ❌ Job ${job.id} failed: ${result.error}\n`);
  }
}

/**
 * Main initialization
 */
async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           Pocketz Worker - Local Download Agent          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Load and validate configuration
  validateConfig();
  console.log('');

  try {
    // Initialize browser with Pocketz extension
    await initBrowser();
    console.log('');

    // Connect to EC2 WebSocket server
    connectWebSocket(handleDownloadJob);
    console.log('');

    console.log('✅ Worker initialized and ready');
    console.log('💡 Waiting for download jobs from EC2 server...\n');

  } catch (error) {
    console.error('❌ Failed to initialize worker:', error);
    process.exit(1);
  }
}

/**
 * Cleanup on shutdown
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Worker] Received ${signal}, shutting down gracefully...`);

  // Close WebSocket
  closeWebSocket();

  // Close browser
  await closeBrowser();

  console.log('[Worker] ✅ Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Worker] Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Worker] Unhandled rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

// Start the worker
main().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
