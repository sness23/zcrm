import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { unlink, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

test.describe('Two Browser Communication Test', () => {
  let browserA: Browser;  // Port 9222
  let browserB: Browser;  // Port 9223
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let pageA: Page; // Sender
  let pageB: Page; // Receiver

  test.beforeAll(async () => {
    console.log('\n=== Connecting to both Chrome instances ===\n');

    // Connect to first Chrome on port 9222 (sender)
    browserA = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to Chrome on port 9222 (Sender)');

    // Connect to second Chrome on port 9223 (receiver)
    browserB = await chromium.connectOverCDP('http://localhost:9223');
    console.log('✓ Connected to Chrome on port 9223 (Receiver)');
  });

  test.beforeEach(async () => {
    console.log('\n=== Setting up browser contexts ===\n');

    // Create contexts for both browsers
    const contextsA = browserA.contexts();
    contextA = contextsA.length > 0 ? contextsA[0] : await browserA.newContext();

    const contextsB = browserB.contexts();
    contextB = contextsB.length > 0 ? contextsB[0] : await browserB.newContext();

    // Create pages
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    console.log('✓ Created pages in both browsers');
  });

  test.afterEach(async () => {
    console.log('\n=== Cleaning up ===\n');
    // Don't close pages - leave them open for inspection
    // if (pageA) await pageA.close();
    // if (pageB) await pageB.close();
  });

  test.afterAll(async () => {
    // Don't close browsers - we're just connected to them
    console.log('\n✓ Test complete - browser tabs left open for inspection');

    // Clean up screenshot files
    const screenshotFiles = [
      'test-results/browser-a-sender.png',
      'test-results/browser-b-receiver.png'
    ];

    for (const file of screenshotFiles) {
      if (existsSync(file)) {
        await unlink(file);
        console.log(`  Cleaned up: ${file}`);
      }
    }

    // Clean up test message entries from event log
    const today = new Date().toISOString().slice(0, 10);
    const eventLogPath = path.join(process.cwd(), 'vault', '_logs', `events-${today}.md`);

    if (existsSync(eventLogPath)) {
      try {
        const content = await readFile(eventLogPath, 'utf8');
        // Remove events that contain our test message pattern
        const lines = content.split('\n');
        const cleanedLines = [];
        let skipBlock = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Start of an event block
          if (line.startsWith('## Event ')) {
            // Look ahead to see if this event contains test data
            const blockEnd = lines.findIndex((l, idx) => idx > i && l === '---');
            const block = lines.slice(i, blockEnd + 1).join('\n');

            if (block.includes('two-browser-test-')) {
              skipBlock = true;
              // Skip to the end of this block
              i = blockEnd;
              continue;
            } else {
              skipBlock = false;
            }
          }

          if (!skipBlock) {
            cleanedLines.push(line);
          }
        }

        await writeFile(eventLogPath, cleanedLines.join('\n'), 'utf8');
        console.log(`  Cleaned up test messages from: ${eventLogPath}`);
      } catch (error) {
        console.error(`  Failed to clean event log: ${error}`);
      }
    }
  });

  test('should send message from Browser A and receive in Browser B', async () => {
    console.log('\n=== Two Browser Message Test ===\n');

    // Navigate both to comms-app
    console.log('Navigating both browsers to comms-app...');
    await Promise.all([
      pageA.goto('http://local.comms.doi.bio'),
      pageB.goto('http://local.comms.doi.bio')
    ]);
    console.log('✓ Both browsers navigated to comms-app');

    // Wait for both to load
    console.log('Waiting for both apps to load...');
    await Promise.all([
      pageA.waitForSelector('.app', { timeout: 10000 }),
      pageB.waitForSelector('.app', { timeout: 10000 })
    ]);
    console.log('✓ Both apps loaded');

    // Reset view in both browsers to show all elements (Ctrl+Shift+Z)
    console.log('Resetting view in both browsers with Ctrl+Shift+Z...');
    await Promise.all([
      pageA.keyboard.press('Control+Shift+KeyZ'),
      pageB.keyboard.press('Control+Shift+KeyZ')
    ]);
    await Promise.all([
      pageA.waitForTimeout(300),
      pageB.waitForTimeout(300)
    ]);
    console.log('✓ View reset in both browsers');

    // Wait for sidebars to be visible
    console.log('Waiting for sidebars...');
    await Promise.all([
      pageA.waitForSelector('.sidebar', { timeout: 5000 }),
      pageB.waitForSelector('.sidebar', { timeout: 5000 })
    ]);
    console.log('✓ Sidebars visible in both browsers');

    // Click #general channel in both
    console.log('Selecting #general channel in both browsers...');
    const generalChannelA = pageA.locator('.channel:has-text("general")');
    const generalChannelB = pageB.locator('.channel:has-text("general")');

    await Promise.all([
      generalChannelA.click(),
      generalChannelB.click()
    ]);
    console.log('✓ Both browsers on #general channel');

    // Wait for message input to be ready
    console.log('Waiting for message inputs...');
    await Promise.all([
      pageA.waitForSelector('.message-input', { timeout: 5000 }),
      pageB.waitForSelector('.message-input', { timeout: 5000 })
    ]);
    console.log('✓ Message inputs ready');

    // Create unique test message
    const testText = `two-browser-test-${Date.now()}`;
    console.log(`\n📤 SENDER (Browser A): Sending message "${testText}"...`);

    // Send message from Browser A
    const messageInputA = pageA.locator('.message-input');
    await messageInputA.click();
    await messageInputA.fill(testText);

    const sendButtonA = pageA.locator('.send-button');
    await sendButtonA.click();

    console.log('✓ Message sent from Browser A');

    // Wait for message to appear in Browser A first
    console.log('\nVerifying message appears in Browser A (sender)...');
    const sentMessage = pageA.locator(`.message:has-text("${testText}")`);
    await expect(sentMessage).toBeVisible({ timeout: 5000 });
    console.log('✓ Message visible in Browser A');

    // Now check if it appears in Browser B
    console.log('\n📥 RECEIVER (Browser B): Waiting for message to arrive...');
    const receivedMessage = pageB.locator(`.message:has-text("${testText}")`);

    try {
      await expect(receivedMessage).toBeVisible({ timeout: 10000 });
      console.log('✅ SUCCESS! Message received in Browser B!');

      // Get the message text to confirm
      const messageText = await receivedMessage.locator('.message-text').textContent();
      console.log(`   Received text: "${messageText}"`);

      expect(messageText).toBe(testText);
      console.log('✅ Message content matches!');

    } catch (error) {
      console.error('❌ FAILED: Message did not appear in Browser B');

      // Debug: Check if WebSocket is connected
      console.log('\nDebug: Checking Browser B console for WebSocket status...');

      // Take screenshots for debugging
      await pageA.screenshot({ path: 'test-results/browser-a-sender.png', fullPage: true });
      await pageB.screenshot({ path: 'test-results/browser-b-receiver.png', fullPage: true });
      console.log('📸 Screenshots saved to test-results/');

      throw error;
    }

    console.log('\n✅ Two-browser communication test passed!');
    console.log('   Browser tabs left open for inspection.');
  });

  test('should show WebSocket connection status in both browsers', async () => {
    console.log('\n=== WebSocket Connection Test ===\n');

    // Set up console listeners
    const consoleLogsA: string[] = [];
    const consoleLogsB: string[] = [];

    pageA.on('console', msg => {
      const text = msg.text();
      consoleLogsA.push(text);
      if (text.includes('WebSocket')) {
        console.log(`[Browser A] ${text}`);
      }
    });

    pageB.on('console', msg => {
      const text = msg.text();
      consoleLogsB.push(text);
      if (text.includes('WebSocket')) {
        console.log(`[Browser B] ${text}`);
      }
    });

    // Navigate both browsers
    await Promise.all([
      pageA.goto('http://local.comms.doi.bio'),
      pageB.goto('http://local.comms.doi.bio')
    ]);

    // Wait for WebSocket connections
    await pageA.waitForTimeout(2000);

    console.log('\nWebSocket logs from Browser A:');
    const wsLogsA = consoleLogsA.filter(log => log.includes('WebSocket'));
    if (wsLogsA.length === 0) {
      console.log('  (no WebSocket logs found)');
    } else {
      wsLogsA.forEach(log => console.log(`  ${log}`));
    }

    console.log('\nWebSocket logs from Browser B:');
    const wsLogsB = consoleLogsB.filter(log => log.includes('WebSocket'));
    if (wsLogsB.length === 0) {
      console.log('  (no WebSocket logs found)');
    } else {
      wsLogsB.forEach(log => console.log(`  ${log}`));
    }

    // Verify both have WebSocket connected messages
    const hasConnectionA = consoleLogsA.some(log => log.includes('WebSocket connected'));
    const hasConnectionB = consoleLogsB.some(log => log.includes('WebSocket connected'));

    if (hasConnectionA) {
      console.log('\n✅ Browser A WebSocket connected');
    } else {
      console.log('\n⚠ Browser A WebSocket status unknown');
    }

    if (hasConnectionB) {
      console.log('✅ Browser B WebSocket connected');
    } else {
      console.log('⚠ Browser B WebSocket status unknown');
    }
  });
});
