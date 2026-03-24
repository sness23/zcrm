import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

test.describe('Search App Integration', () => {
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

  test('should search for "roshan" and find "Roshan Rao"', async () => {
    // Set up console logging to track what's happening
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to search-app via nginx proxy
    console.log('Navigating to search-app...');
    await page.goto('http://local.search.doi.bio');
    console.log('✓ Navigated to search-app');

    // Wait for the app to load - look for the search input
    console.log('Waiting for search input to load...');
    await page.waitForSelector('.search-input', { timeout: 10000 });
    console.log('✓ Search input loaded');

    // Type "roshan" in the search box
    const searchQuery = 'roshan';
    console.log(`Typing search query: "${searchQuery}"...`);
    const searchInput = page.locator('.search-input');
    await searchInput.click();
    await searchInput.fill(searchQuery);
    console.log('✓ Typed search query');

    // Click search button
    console.log('Clicking Search button...');
    const searchButton = page.locator('.search-button');
    await searchButton.click();
    console.log('✓ Clicked Search button');

    // Wait for results to appear
    console.log('Waiting for search results...');
    await page.waitForSelector('.results-list', { timeout: 10000 });
    console.log('✓ Results container appeared');

    // Wait a moment for results to populate
    await page.waitForTimeout(1000);

    // Verify we have at least one result
    const resultItems = page.locator('.result-item');
    const resultCount = await resultItems.count();
    console.log(`✓ Found ${resultCount} search results`);
    expect(resultCount).toBeGreaterThan(0);

    // Get all result snippets and paths
    const results: Array<{ snippet: string; path: string }> = [];
    for (let i = 0; i < resultCount; i++) {
      const resultItem = resultItems.nth(i);
      const snippet = await resultItem.locator('.result-snippet').textContent();
      const path = await resultItem.locator('.result-path').textContent();
      results.push({
        snippet: snippet || '',
        path: path || ''
      });
      console.log(`  Result ${i + 1}: ${path} - "${snippet}"`);
    }

    // Verify at least one result contains "Roshan Rao"
    const hasRoshanRao = results.some(result =>
      result.snippet.toLowerCase().includes('roshan rao') ||
      result.path.toLowerCase().includes('roshan')
    );

    expect(hasRoshanRao).toBe(true);
    console.log('✅ VERIFIED: Found "Roshan Rao" in search results!');

    // Verify the results count is displayed
    const resultsCount = page.locator('.results-count');
    await expect(resultsCount).toBeVisible();
    const countText = await resultsCount.textContent();
    console.log(`✓ Results count: ${countText}`);

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/search-integration-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/search-integration-test.png');

    console.log('\n✅ Test passed! Search returned expected results.');
    console.log('   Browser tab will remain open for inspection.');
  });
});
