import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

/**
 * Comprehensive User Session Test
 *
 * This test simulates Alice's full navigation flow through all apps in the doi.bio platform.
 *
 * Persona: Alice - CEO/founder of doi.bio
 * - Main salesperson and business expert
 * - Can access all internal CRM/business apps
 * - Hopes to delegate tasks to future employees
 *
 * Test Flow:
 * 1. Start at login-app (app launcher)
 * 2. For each app in the launcher:
 *    a. Click the app button
 *    b. Wait for app to load
 *    c. Verify app is accessible
 *    d. Click the logo in the top-left corner
 *    e. Verify return to login-app
 * 3. Repeat for all apps
 *
 * Apps tested (Alice-facing only, excluding contact-app):
 * - comms, tables, docs, search, leads, earn, analytics, email, party, ads
 */

test.describe('User Session - Full Navigation Flow', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // Connect to existing Chrome browser running with remote debugging
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to existing Chrome browser on port 9222');
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

  test('Alice can navigate to all apps and return to login-app via logo clicks', async () => {
    console.log('\n🎯 Starting Alice\'s full navigation flow test...\n');

    // Start at login-app
    await page.goto('http://local.login.doi.bio', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Get initial page state
    let bodyText = await page.locator('body').textContent();
    console.log('📍 Starting at login-app');

    // Check if apps are hidden and toggle them visible if needed
    const appsAlreadyVisible = bodyText?.includes('Comms');
    const buttonCount = await page.locator('button').count();
    const isCompactMode = !appsAlreadyVisible && buttonCount > 10;

    if (!appsAlreadyVisible && !isCompactMode) {
      console.log('👁️  Toggling apps visible with Ctrl+Shift+H...');
      await page.keyboard.press('Control+Shift+H');
      await page.waitForTimeout(500);
    }

    bodyText = await page.locator('body').textContent();
    if (!bodyText?.includes('Comms') && buttonCount > 10) {
      console.log('📏 Disabling compact mode with Ctrl+Shift+K...');
      await page.keyboard.press('Control+Shift+K');
      await page.waitForTimeout(500);
    }

    // Define all Alice-facing apps to test (excluding contact-app)
    const appsToTest = [
      { id: 'comms', name: 'Comms', url: 'http://local.comms.doi.bio', logoSelector: '.workspace-logo' },
      { id: 'tables', name: 'Tables', url: 'http://local.tables.doi.bio', logoSelector: '.app-logo' },
      { id: 'docs', name: 'Docs', url: 'http://local.docs.doi.bio', logoSelector: '.app-logo' },
      { id: 'search', name: 'Search', url: 'http://local.search.doi.bio', logoSelector: '.app-logo' },
      { id: 'leads', name: 'Leads', url: 'http://local.leads.doi.bio', logoSelector: '.app-logo' },
      { id: 'earn', name: 'Earn', url: 'http://local.earn.doi.bio', logoSelector: '.header-logo' },
      { id: 'analytics', name: 'Analytics', url: 'http://local.analytics.doi.bio', logoSelector: '.header-logo' },
      { id: 'email', name: 'Email', url: 'http://local.email.doi.bio', logoSelector: '.header-logo' },
      { id: 'party', name: 'Party', url: 'http://local.party.doi.bio', logoSelector: '.header-logo' },
      { id: 'ads', name: 'Ads', url: 'http://local.ads.doi.bio', logoSelector: '.header-logo' },
    ];

    let successCount = 0;
    let failureCount = 0;

    // Test each app
    for (const app of appsToTest) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 Testing ${app.name} app`);
        console.log(`${'='.repeat(60)}`);

        // Step 1: Find and click the app button in login-app
        console.log(`  1️⃣  Looking for "${app.name}" button...`);

        // Try multiple selectors to find the app button
        const appButton = page.locator(`button:has-text("${app.name}")`).first();
        await expect(appButton).toBeVisible({ timeout: 5000 });
        console.log(`  ✓ Found "${app.name}" button`);

        // Click the app button
        console.log(`  2️⃣  Clicking "${app.name}" button...`);
        await appButton.click();

        // Wait for navigation to complete by checking the URL contains the subdomain
        await page.waitForTimeout(2000); // Give time for navigation
        console.log(`  ✓ Navigated to ${app.name} app`);

        // Step 2: Verify we're on the app page
        await page.waitForTimeout(1000); // Give app time to render
        const currentUrl = page.url();
        expect(currentUrl).toContain(app.id); // Check URL contains app id (e.g., 'comms', 'tables')
        console.log(`  ✓ Confirmed on ${app.name} app (${currentUrl})`);

        // Step 3: Find and click the logo
        console.log(`  3️⃣  Looking for logo (${app.logoSelector})...`);

        // Try to find the logo link first, then fallback to logo image
        let logoElement = page.locator('.logo-link, .workspace-logo-link').first();
        let logoVisible = await logoElement.isVisible().catch(() => false);

        if (!logoVisible) {
          // Fallback to direct logo selector
          logoElement = page.locator(app.logoSelector).first();
          logoVisible = await logoElement.isVisible().catch(() => false);
        }

        if (!logoVisible) {
          // Final fallback: look for any img with doibio in src
          logoElement = page.locator('img[src*="doibio"]').first();
        }

        await expect(logoElement).toBeVisible({ timeout: 5000 });
        console.log(`  ✓ Found logo`);

        // Click the logo to return to login-app
        console.log(`  4️⃣  Clicking logo to return to login-app...`);
        await logoElement.click();

        // Wait for navigation back to login-app
        await page.waitForTimeout(2000); // Give time for navigation
        console.log(`  ✓ Returned to login-app`);

        // Step 4: Verify we're back on login-app
        await page.waitForTimeout(1000);
        const returnUrl = page.url();
        expect(returnUrl).toContain('login');
        console.log(`  ✓ Confirmed back on login-app (${returnUrl})`);

        // Verify app launcher is visible
        bodyText = await page.locator('body').textContent();
        expect(bodyText).toContain('Comms'); // Should see app launcher
        console.log(`  ✓ App launcher is visible\n`);

        console.log(`✅ ${app.name} app test PASSED`);
        successCount++;

      } catch (error) {
        console.error(`\n❌ ${app.name} app test FAILED:`);
        console.error(`   Error: ${error}`);
        console.error(`   Current URL: ${page.url()}\n`);
        failureCount++;

        // Try to recover by navigating back to login-app
        try {
          await page.goto('http://local.login.doi.bio', { waitUntil: 'networkidle', timeout: 5000 });
          await page.waitForTimeout(1000);
        } catch (recoveryError) {
          console.error(`   Failed to recover to login-app: ${recoveryError}`);
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 FINAL RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Passed: ${successCount}/${appsToTest.length}`);
    console.log(`❌ Failed: ${failureCount}/${appsToTest.length}`);
    console.log(`📈 Success Rate: ${((successCount / appsToTest.length) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(60)}\n`);

    // Toggle back to compact/icon mode for prettier display
    console.log('📏 Re-enabling compact mode (icons only) for cleaner display...');
    await page.keyboard.press('Control+Shift+K');
    await page.waitForTimeout(500);
    console.log('✓ Compact mode enabled\n');

    // Ensure all tests passed
    expect(successCount).toBe(appsToTest.length);
  });
});
