import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

test.describe('Root App Integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

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
  });

  test.afterEach(async () => {
    // Wait a moment for any pending operations to complete
    await page.waitForTimeout(500);
  });

  test.afterAll(async () => {
    // Don't close the browser - we're just connected to it
    // await browser.close();
  });

  test('should load root app and display landing page', async () => {
    // Set up console logging to track what's happening
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to root-app via nginx proxy
    console.log('Navigating to root-app...');
    await page.goto('http://local.doi.bio');
    console.log('✓ Navigated to root-app');

    // Wait for the app to load - look for the main heading
    console.log('Waiting for app to load...');
    await page.waitForSelector('h1', { timeout: 10000 });
    console.log('✓ App loaded');

    // Verify the hero heading contains expected text (www server landing page)
    const heading = page.locator('h1');
    await expect(heading).toContainText('Datasets for AIs and Humans');
    console.log('✅ VERIFIED: Heading shows hero text');

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/root-integration-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/root-integration-test.png');

    console.log('\n✅ Test passed! Root app loaded successfully.');
    console.log('   Browser tab will remain open for inspection.');
  });
});
