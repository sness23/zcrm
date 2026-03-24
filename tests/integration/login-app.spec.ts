import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

test.describe('Login App - App Launcher', () => {
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

  test('should load app launcher and display comms app icon', async () => {
    // Navigate to login-app
    console.log('Navigating to login-app...');
    await page.goto('http://local.login.doi.bio', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to login-app');

    // Wait for the app to load
    await page.waitForTimeout(1000);

    // Check if we need to login (if login form is present, skip this test)
    const loginForm = page.locator('form');
    const isLoginPage = await loginForm.count() > 0;

    if (isLoginPage) {
      console.log('⚠️ Login page detected - user needs to login first');
      console.log('   This test assumes user is already logged in.');
      console.log('   Skipping test...');
      test.skip();
      return;
    }

    // If logged in, app launcher should be visible
    console.log('✓ User is logged in, app launcher should be visible');

    // Take screenshot to see what's rendered
    await page.screenshot({ path: 'test-results/login-app-initial.png', fullPage: true });
    console.log('✓ Initial screenshot saved');

    // Debug: Check page content
    const bodyText = await page.locator('body').textContent();
    console.log(`  Page body contains "Comms": ${bodyText?.includes('Comms')}`);
    console.log(`  Page body contains "App Launcher": ${bodyText?.includes('App Launcher')}`);

    // Debug: Count all buttons
    const buttonCount = await page.locator('button').count();
    console.log(`  Found ${buttonCount} buttons on page`);

    // Check if apps are already visible in full mode
    const appsAlreadyVisible = bodyText?.includes('Comms');
    const isCompactMode = !appsAlreadyVisible && buttonCount > 10;

    console.log(`  Apps already visible: ${appsAlreadyVisible}, Compact mode: ${isCompactMode}`);

    // Toggle apps visible if hidden (only toggle if needed)
    if (!appsAlreadyVisible && !isCompactMode) {
      console.log('Showing apps with Ctrl+Shift+H...');
      await page.keyboard.press('Control+Shift+H');
      await page.waitForTimeout(500);
    }

    // Disable compact mode if enabled (only toggle if needed)
    let bodyText2 = await page.locator('body').textContent();
    if (!bodyText2?.includes('Comms') && buttonCount > 10) {
      console.log('Disabling compact mode with Ctrl+Shift+K...');
      await page.keyboard.press('Control+Shift+K');
      await page.waitForTimeout(500);
      bodyText2 = await page.locator('body').textContent();
    }

    // Take screenshot after potential toggles
    await page.screenshot({ path: 'test-results/login-app-after-toggle.png', fullPage: true });
    console.log('✓ After-toggle screenshot saved');
    console.log(`  Page body now contains "Comms": ${bodyText2?.includes('Comms')}`);

    // Find the Comms app
    const commsApp = page.locator('text=Comms').first();
    await expect(commsApp).toBeVisible({ timeout: 5000 });
    console.log('✅ VERIFIED: Comms app is visible');

    // Verify it has the description
    const commsDescription = page.locator('text=Real-time messaging and activity streams');
    await expect(commsDescription).toBeVisible();
    console.log('✅ VERIFIED: Comms app description is visible');

    // Take screenshot before clicking
    await page.screenshot({ path: 'test-results/login-app-launcher.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/login-app-launcher.png');

    console.log('\n✅ Test passed! Login app launcher displays comms icon.');
    console.log('   Browser tab will remain open for inspection.');
  });

  test('should display all app icons in the launcher', async () => {
    console.log('Navigating to login-app...');
    await page.goto('http://local.login.doi.bio', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to login-app');

    await page.waitForTimeout(1000);

    // Skip if on login page
    const loginForm = page.locator('form');
    const isLoginPage = await loginForm.count() > 0;
    if (isLoginPage) {
      console.log('⚠️ Login page detected - skipping test');
      test.skip();
      return;
    }

    console.log('✓ User is logged in');

    // Check if apps are visible in full mode
    let bodyText = await page.locator('body').textContent();
    const appsVisible = bodyText?.includes('Comms');
    const isCompactMode = !appsVisible && await page.locator('button').count() > 10;

    console.log(`  Apps visible: ${appsVisible}, Compact mode: ${isCompactMode}`);

    // Toggle apps visible if hidden
    if (!appsVisible && !isCompactMode) {
      console.log('Showing apps with Ctrl+Shift+H...');
      await page.keyboard.press('Control+Shift+H');
      await page.waitForTimeout(500);
      bodyText = await page.locator('body').textContent();
    }

    // Disable compact mode if enabled
    if (!bodyText?.includes('Comms')) {
      console.log('Disabling compact mode with Ctrl+Shift+K...');
      await page.keyboard.press('Control+Shift+K');
      await page.waitForTimeout(500);
    }

    // Verify multiple apps are visible
    const expectedApps = ['Comms', 'Tables', 'Docs', 'Search', 'Leads', 'Earn'];

    for (const appName of expectedApps) {
      const app = page.locator('text=' + appName).first();
      await expect(app).toBeVisible({ timeout: 3000 });
      console.log(`✅ VERIFIED: ${appName} app is visible`);
    }

    console.log('\n✅ Test passed! All expected apps are visible in the launcher.');
  });
});
