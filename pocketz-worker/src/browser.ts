import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { config } from './config.js';
import type { ProcessJobResult } from './types.js';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

/**
 * Initialize Playwright browser by connecting to existing Chrome instance via CDP
 */
export async function initBrowser(): Promise<void> {
  console.log('[Browser] Connecting to Chrome via CDP...');
  console.log('[Browser] CDP URL:', config.chromeCdpUrl);

  try {
    // Connect to existing Chrome instance via CDP
    browser = await chromium.connectOverCDP(config.chromeCdpUrl);

    console.log('[Browser] ✅ Connected to Chrome successfully');

    // Get default context
    const contexts = browser.contexts();
    if (contexts.length > 0) {
      context = contexts[0];
      console.log('[Browser] ✅ Using existing browser context');
    } else {
      console.error('[Browser] ⚠️  No browser context found');
      throw new Error('No browser context available');
    }

    // Get or create a page
    const pages = context.pages();
    if (pages.length > 0) {
      page = pages[0];
      console.log('[Browser] ✅ Using existing page');
    } else {
      page = await context.newPage();
      console.log('[Browser] ✅ Created new page');
    }

    console.log('[Browser] ✅ Browser ready');
  } catch (error) {
    console.error('[Browser] ❌ Failed to connect to browser:', error);
    console.error('[Browser] Make sure Chrome is running with: google-chrome --remote-debugging-port=9222');
    throw error;
  }
}

/**
 * Process a download job by navigating to URL and triggering Pocketz
 */
export async function processJob(jobId: string, url: string): Promise<ProcessJobResult> {
  if (!page) {
    throw new Error('Browser not initialized. Call initBrowser() first.');
  }

  console.log(`[Browser] Processing job ${jobId}: ${url}`);

  try {
    // Navigate to URL
    console.log(`[Browser] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('[Browser] ✅ Page loaded');

    // Wait a moment for page to settle and JavaScript to execute
    await page.waitForTimeout(2000);

    // Trigger Pocketz capture (Shift+Alt+O)
    console.log('[Browser] Triggering Pocketz capture (Shift+Alt+O)...');
    await page.keyboard.press('Shift+Alt+O');

    console.log('[Browser] ✅ Pocketz triggered');

    // Wait for Pocketz to complete download
    // The extension needs time to:
    // 1. Extract page content and assets
    // 2. Click PDF links (if any)
    // 3. Download all files
    // 4. Send data to Pocketz server

    console.log(`[Browser] Waiting ${config.downloadTimeout}ms for download to complete...`);

    // Initial delay for Pocketz to start processing
    await page.waitForTimeout(5000);

    // Wait for network to be idle (downloads in progress)
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {
      // Network might not go idle if downloads are happening, that's ok
      console.log('[Browser] Network still active (downloads in progress)');
    }

    // Additional time for downloads to complete
    const remainingTime = config.downloadTimeout - 5000;
    if (remainingTime > 0) {
      await page.waitForTimeout(remainingTime);
    }

    console.log(`[Browser] ✅ Job ${jobId} completed successfully`);

    return {
      success: true
    };

  } catch (error: any) {
    console.error(`[Browser] ❌ Job ${jobId} failed:`, error.message);

    return {
      success: false,
      error: error.message || 'Unknown browser error'
    };
  }
}

/**
 * Close the browser
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    console.log('[Browser] Closing browser...');
    await browser.close();
    browser = null;
    context = null;
    page = null;
    console.log('[Browser] ✅ Browser closed');
  }
}

/**
 * Get browser status
 */
export function isBrowserReady(): boolean {
  return browser !== null && page !== null;
}
