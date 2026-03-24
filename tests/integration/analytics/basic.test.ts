import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ensureDatabaseExists } from '../../../src/db/channels.js';

const VAULT_PATH = path.join(process.cwd(), 'vault');
const CHANNELS_DB_PATH = path.join(VAULT_PATH, '_logs', 'channels.db');
const API_BASE_URL = 'http://localhost:9600';

test.describe('Analytics App - Basic Integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // Ensure database file exists before starting tests
    // This creates an empty file if it doesn't exist yet
    ensureDatabaseExists();
    console.log('✓ Database file ensured');

    // Verify API is running and healthy
    let apiHealthy = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/channels`);
        if (response.ok) {
          apiHealthy = true;
          console.log('✓ API server is healthy');
          break;
        }
      } catch (error) {
        // API not responding, wait and retry
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!apiHealthy) {
      throw new Error('API server is not running on port 9600. Start it with: npm run api:dev');
    }

    // Connect to existing Chrome browser running with remote debugging
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to existing Chrome browser');
  });

  test.beforeEach(async () => {
    // Get existing context or create new one
    const contexts = browser.contexts();
    context = contexts.length > 0 ? contexts[0] : await browser.newContext();

    // Create new page
    page = await context.newPage();
    console.log('✓ Created new page');
  });

  test.afterEach(async () => {
    // Wait a moment for any pending operations to complete
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    // Don't close the browser - we're just connected to it
    // await browser.close();
  });

  test('send a message', async () => {
    // Navigate to analytics app
    console.log('Navigating to analytics-app...');
    await page.goto('http://local.analytics.doi.bio');
    console.log('✓ Navigated to analytics-app');

    // Clear localStorage to ensure panels are visible
    await page.evaluate(() => {
      localStorage.removeItem('analytics-app-left-visible');
      localStorage.removeItem('analytics-app-right-visible');
      localStorage.removeItem('analytics-app-header-visible');
    });

    // Reload to apply localStorage changes
    await page.reload();

    // Wait for the app to load
    console.log('Waiting for app to load...');
    await page.waitForLoadState('networkidle');
    console.log('✓ App loaded');

    // Wait for chat panel to be visible
    console.log('Checking chat panel...');
    await expect(page.locator('.chat-panel')).toBeVisible();
    console.log('✅ VERIFIED: Chat panel is visible');

    // Generate a unique test message
    const testMessage = `Test message ${Date.now()}`;
    console.log(`Preparing to send message: "${testMessage}"`);

    // Find the message input
    const messageInput = page.locator('.chat-input');
    await expect(messageInput).toBeVisible();
    console.log('✅ VERIFIED: Message input is visible');

    // Type the message
    console.log('Typing message...');
    await messageInput.fill(testMessage);

    // Click the send button
    const sendButton = page.locator('.send-btn');
    await expect(sendButton).toBeVisible();
    await expect(sendButton).not.toBeDisabled();
    console.log('Clicking send button...');
    await sendButton.click();
    console.log('✅ CLICKED: Send button');

    // Wait for the message to be sent
    await page.waitForTimeout(500);

    // Verify the input was cleared
    await expect(messageInput).toHaveValue('');
    console.log('✅ VERIFIED: Message input was cleared');

    // Verify the database file exists (should already exist from beforeAll)
    expect(fs.existsSync(CHANNELS_DB_PATH)).toBe(true);
    console.log('✅ VERIFIED: Database file exists');

    // Poll API for the message (up to 5 seconds)
    // This handles WAL mode timing and any async processing delays
    console.log('Polling API for message...');
    let result: any = null;
    const maxAttempts = 10;
    const pollInterval = 500; // 500ms between attempts

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/channels/ch_general/messages`);
        if (response.ok) {
          const data = await response.json();
          const messages = data.messages;

          // Find the test message
          result = messages.find((m: any) => m.text === testMessage);

          if (result) {
            console.log(`✅ VERIFIED: Message found after ${(attempt + 1) * pollInterval}ms`);
            break;
          }
        }
      } catch (error) {
        console.log(`  Attempt ${attempt + 1}/${maxAttempts} failed, retrying...`);
      }

      // Wait before next attempt
      await page.waitForTimeout(pollInterval);
    }

    // Verify message was found
    expect(result).toBeDefined();
    expect(result).toHaveProperty('text', testMessage);
    expect(result).toHaveProperty('channel_id', 'ch_general');
    expect(result).toHaveProperty('author_name', 'Analytics User');

    console.log('✅ VERIFIED: Message persisted correctly:', result);

    // Take screenshot
    await page.screenshot({ path: 'test-results/analytics-integration-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/analytics-integration-test.png');

    console.log('\n✅ Test passed! Analytics app integration works correctly.');
    console.log('   Browser tab will remain open for inspection.');
  });
});
