import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

test.describe('Comms App Integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let testMessageId: string | null = null;
  let testMarkdownPath: string;
  let originalMarkdownContent: string;

  test.beforeAll(async () => {
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

    // Set up markdown file path for today
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    testMarkdownPath = path.join(process.cwd(), 'vault', '_logs', 'channels', 'general', `${today}.md`);

    // Read original markdown content if file exists
    if (fs.existsSync(testMarkdownPath)) {
      originalMarkdownContent = fs.readFileSync(testMarkdownPath, 'utf8');
      console.log(`✓ Original markdown: ${originalMarkdownContent.length} chars`);
    } else {
      originalMarkdownContent = '';
      console.log('✓ No existing markdown file (will be created)');
    }
  });

  test.afterEach(async () => {
    // Wait a moment for any pending operations to complete
    await page.waitForTimeout(500);

    // Clean up test message from database if we created one
    if (testMessageId) {
      try {
        const dbPath = path.join(process.cwd(), 'vault', '_logs', 'channels.db');
        const db = new Database(dbPath);

        // Delete the test message from the database
        db.prepare('DELETE FROM messages WHERE id = ?').run(testMessageId);
        console.log(`✓ Deleted test message ${testMessageId} from database`);

        db.close();
        testMessageId = null;
      } catch (err) {
        console.warn('⚠ Could not delete test message from database:', err);
      }
    }

    // Leave markdown file as-is (don't clean up for inspection)
    console.log('✓ Markdown file left intact for inspection');
  });

  test.afterAll(async () => {
    // Don't close the browser - we're just connected to it
    // await browser.close();
  });

  test('should save channel message to markdown file on disk', async () => {
    // Set up console logging to track what's happening
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to comms-app via nginx proxy
    console.log('Navigating to comms-app...');
    await page.goto('http://local.comms.doi.bio');
    console.log('✓ Navigated to comms-app');

    // Wait for the app to load
    console.log('Waiting for app to load...');
    await page.waitForSelector('.app', { timeout: 10000 });
    console.log('✓ App loaded');

    // Reset view to show all elements (Ctrl+Shift+Z)
    console.log('Resetting view with Ctrl+Shift+Z...');
    await page.keyboard.press('Control+Shift+KeyZ');
    await page.waitForTimeout(300); // Wait for any animations
    console.log('✓ View reset');

    // Wait for the sidebar to be visible
    console.log('Waiting for sidebar...');
    await page.waitForSelector('.sidebar', { timeout: 5000 });
    console.log('✓ Sidebar visible');

    // Wait for #general channel to be visible and click it
    console.log('Waiting for #general channel...');
    const generalChannel = page.locator('.channel:has-text("general")');
    await generalChannel.waitFor({ timeout: 5000 });
    console.log('✓ #general channel visible');

    // Click #general to select it
    await generalChannel.click();
    console.log('✓ Clicked #general channel');

    // Wait for message input to be visible
    console.log('Waiting for message input...');
    await page.waitForSelector('.message-input', { timeout: 5000 });
    console.log('✓ Message input visible');

    // Create unique test message
    const testTimestamp = Date.now();
    const testText = `integration-test-${testTimestamp}`;

    console.log(`Typing test message: "${testText}"...`);
    const messageInput = page.locator('.message-input');
    await messageInput.click();
    await messageInput.fill(testText);
    console.log('✓ Typed test message');

    // Click send button
    console.log('Clicking Send button...');
    const sendButton = page.locator('.send-button');
    await sendButton.click();
    console.log('✓ Clicked Send button');

    // Wait a moment for the message to be sent (the "Sending..." state is too fast to catch)
    await page.waitForTimeout(500);
    console.log('✓ Message sent');

    // Poll the markdown file until the message appears
    console.log('Waiting for markdown file to be updated...');
    let updatedMarkdownContent = '';
    let attempts = 0;
    const maxAttempts = 15; // 15 attempts * 500ms = 7.5 seconds max

    while (attempts < maxAttempts) {
      await page.waitForTimeout(500);
      attempts++;

      if (fs.existsSync(testMarkdownPath)) {
        updatedMarkdownContent = fs.readFileSync(testMarkdownPath, 'utf8');

        if (updatedMarkdownContent.includes(testText)) {
          console.log(`✓ Message found in markdown after ${attempts * 500}ms`);
          break;
        }
      }

      if (attempts % 2 === 0) {
        console.log(`  Polling... attempt ${attempts}/${maxAttempts}`);
      }
    }

    console.log(`✓ Updated markdown: ${updatedMarkdownContent.length} chars`);
    console.log(`✓ Markdown file: ${testMarkdownPath}`);

    // Verify the test message is in the markdown file
    expect(updatedMarkdownContent).toContain(testText);
    console.log(`✅ VERIFIED: Test message "${testText}" found in markdown file!`);

    // Verify markdown has the expected format with timestamp and author
    expect(updatedMarkdownContent).toMatch(/\*\*\[.*\] .*:\*\*/); // **[HH:MM:SS AM/PM] Author:**
    console.log('✅ VERIFIED: Message has correct markdown format');

    // Verify the message appears in the UI
    const messageElement = page.locator(`.message:has-text("${testText}")`);
    await expect(messageElement).toBeVisible();
    console.log('✅ VERIFIED: Message visible in UI');

    // Extract message ID from database for cleanup
    try {
      const dbPath = path.join(process.cwd(), 'vault', '_logs', 'channels.db');

      if (fs.existsSync(dbPath)) {
        const db = new Database(dbPath);

        // Check if messages table exists
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'").get() as any;

        if (tableCheck) {
          const result = db.prepare('SELECT id FROM messages WHERE text = ? ORDER BY timestamp DESC LIMIT 1').get(testText) as any;

          if (result) {
            testMessageId = result.id;
            console.log(`✓ Found test message ID: ${testMessageId}`);
          }
        } else {
          console.log('⚠ Messages table does not exist in channels.db (skipping ID lookup)');
        }

        db.close();
      } else {
        console.log('⚠ channels.db does not exist (skipping ID lookup)');
      }
    } catch (err) {
      console.warn('⚠ Could not find message ID:', err);
    }

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/slack-integration-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/slack-integration-test.png');

    console.log('\n✅ Test passed! Message saved to markdown file on disk.');
    console.log(`   File: ${testMarkdownPath}`);
    console.log('   Browser tab will remain open for inspection.');
  });
});
