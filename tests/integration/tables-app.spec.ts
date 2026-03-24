import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { ulid } from 'ulidx';

test.describe('Tables-App Inline Editing', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const testAccountName = 'EvolutionaryScale.ai';
  let accountFilePath: string;
  let originalWebsite: string;
  let accountId: string;
  let createdAccount = false; // Track if we created the account

  test.beforeAll(async () => {
    // Connect to existing Chrome browser running with remote debugging
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to existing Chrome browser');

    // Find the EvolutionaryScale.ai account file
    const accountsDir = path.join(process.cwd(), 'vault', 'accounts');

    // Ensure accounts directory exists
    if (!fs.existsSync(accountsDir)) {
      fs.mkdirSync(accountsDir, { recursive: true });
    }

    const files = fs.readdirSync(accountsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(accountsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = matter(content);

      if (parsed.data.name === testAccountName) {
        accountFilePath = filePath;
        accountId = parsed.data.id;
        originalWebsite = parsed.data.website || '';
        console.log(`✓ Found existing account: ${testAccountName}`);
        console.log(`  File: ${file}`);
        console.log(`  ID: ${accountId}`);
        console.log(`  Original website: ${originalWebsite}`);
        break;
      }
    }

    // If account doesn't exist, create it
    if (!accountFilePath) {
      console.log(`Account "${testAccountName}" not found, creating it...`);

      accountId = `acc_${ulid()}`;
      const slug = 'evolutionaryscale';
      accountFilePath = path.join(accountsDir, `${slug}.md`);
      originalWebsite = 'https://evolutionaryscale.ai';

      const accountData = {
        id: accountId,
        type: 'Account',
        name: testAccountName,
        website: originalWebsite,
        industry: 'Biotechnology',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const accountContent = matter.stringify('# EvolutionaryScale.ai\n\nAI research company focused on developing ESM (Evolutionary Scale Modeling) for protein design.\n', accountData);
      fs.writeFileSync(accountFilePath, accountContent, 'utf8');

      createdAccount = true;
      console.log(`✓ Created test account: ${testAccountName}`);
      console.log(`  File: ${slug}.md`);
      console.log(`  ID: ${accountId}`);
      console.log(`  Website: ${originalWebsite}`);

      // Wait for API to sync the new account to database
      console.log('Waiting for API to sync account...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✓ Sync wait complete');
    }
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
    if (page) {
      await page.waitForTimeout(500);
    }
  });

  test.afterAll(() => {
    if (accountFilePath) {
      try {
        if (createdAccount) {
          // Delete the account we created
          fs.unlinkSync(accountFilePath);
          console.log(`✓ Deleted test account: ${testAccountName}`);
          console.log(`  File: ${accountFilePath}`);
        } else {
          // Restore original website value for existing account
          const content = fs.readFileSync(accountFilePath, 'utf8');
          const parsed = matter(content);

          parsed.data.website = originalWebsite;

          const updatedContent = matter.stringify(parsed.content, parsed.data);
          fs.writeFileSync(accountFilePath, updatedContent, 'utf8');
          console.log('✓ Restored original website value for existing account');
        }
      } catch (err) {
        console.warn('⚠ Could not clean up test account:', err);
      }
    }

    // Don't close the browser - we're just connected to it
    // await browser.close();
  });

  test('should edit website field inline and persist to markdown', async () => {
    // Set up console logging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to tables-app via nginx proxy
    console.log('Navigating to tables-app...');
    await page.goto('http://local.tables.doi.bio');
    console.log('✓ Navigated to tables-app');

    // Wait for the accounts table to load
    console.log('Waiting for accounts table to load...');
    await page.waitForSelector('.data-table tbody tr', { timeout: 10000 });
    console.log('✓ Accounts table loaded');

    // Click on the Accounts tab to ensure we're viewing accounts
    console.log('Clicking on Accounts tab...');
    const accountsTab = page.locator('.tab', { hasText: 'Accounts' });
    await accountsTab.click();
    console.log('✓ Clicked Accounts tab');

    // Wait for WebSocket to stabilize and data to load
    console.log('Waiting for data to stabilize...');
    await page.waitForTimeout(3000);
    console.log('✓ Data stabilized');

    // Debug: Check what tab is active
    const activeTabText = await page.locator('.tab.active').textContent();
    console.log(`  Active tab: ${activeTabText}`);

    // Debug: List all visible rows
    const allRows = await page.locator('.data-table tbody tr').allTextContents();
    console.log(`  Found ${allRows.length} rows in table:`);
    if (allRows.length === 0) {
      console.log('  ⚠️  NO ROWS FOUND!');
    } else {
      allRows.slice(0, 10).forEach((row, i) => {
        console.log(`    Row ${i + 1}: ${row.slice(0, 80)}...`);
      });
    }

    // Check if EvolutionaryScale.ai exists in the text content
    const tableText = await page.locator('.data-table tbody').textContent();
    const hasEvolutionaryScale = tableText?.includes('EvolutionaryScale.ai');
    console.log(`  Table contains "EvolutionaryScale.ai": ${hasEvolutionaryScale}`);

    // Find and click on EvolutionaryScale.ai row
    console.log(`Looking for "${testAccountName}" in the table...`);
    const accountRow = page.locator('.data-table tbody tr', { hasText: testAccountName });
    await expect(accountRow).toBeVisible({ timeout: 5000 });
    console.log(`✓ Found "${testAccountName}" row`);

    await accountRow.click();
    console.log(`✓ Clicked on "${testAccountName}" row`);

    // Wait for detail view to load
    console.log('Waiting for detail view to load...');
    await page.waitForSelector('.detail-view', { timeout: 5000 });
    console.log('✓ Detail view loaded');

    // Wait for the Website field to be visible
    console.log('Looking for Website field...');
    const websiteRow = page.locator('.detail-table tr', { has: page.locator('td.field-label', { hasText: 'Website' }) });
    await expect(websiteRow).toBeVisible({ timeout: 5000 });
    console.log('✓ Website field found');

    // Read current website value
    const currentWebsiteElement = websiteRow.locator('.field-value .editable-value');
    const currentWebsite = await currentWebsiteElement.textContent();
    console.log(`  Current website: "${currentWebsite}"`);

    // Create a unique test website URL
    const testWebsite = `https://test-${Date.now()}.example.com`;
    console.log(`  New website will be: "${testWebsite}"`);

    // Click on the website field to edit it
    console.log('Clicking on website field to edit...');
    await currentWebsiteElement.click();
    console.log('✓ Clicked on website field');

    // Wait for edit mode to appear
    console.log('Waiting for edit mode...');
    const editInput = websiteRow.locator('.edit-mode input');
    await expect(editInput).toBeVisible({ timeout: 2000 });
    console.log('✓ Edit mode activated');

    // Clear and type new value
    console.log(`Typing new website: "${testWebsite}"...`);
    await editInput.fill(testWebsite);
    console.log('✓ Typed new website');

    // Press Enter to save
    console.log('Pressing Enter to save...');
    await editInput.press('Enter');
    console.log('✓ Pressed Enter');

    // Wait for success message
    console.log('Waiting for success message...');
    await expect(page.locator('.success-indicator')).toBeVisible({ timeout: 3000 });
    console.log('✓ Success message appeared');

    // Wait a moment for file to be written
    await page.waitForTimeout(500);

    // Verify the markdown file was updated
    console.log('Verifying markdown file was updated...');
    const content = fs.readFileSync(accountFilePath, 'utf8');
    const parsed = matter(content);

    expect(parsed.data.website).toBe(testWebsite);
    console.log(`✅ VERIFIED: Markdown file updated with website: ${testWebsite}`);

    // Verify the UI shows the new value
    const updatedWebsite = await currentWebsiteElement.textContent();
    expect(updatedWebsite).toBe(testWebsite);
    console.log(`✅ VERIFIED: UI shows updated website: ${updatedWebsite}`);

    // Take screenshot
    await page.screenshot({ path: 'test-results/tables-app-edit-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/tables-app-edit-test.png');

    console.log('\n✅ Test passed! Field edited and persisted to markdown file.');
    console.log(`   Account: ${testAccountName}`);
    console.log(`   Field: website`);
    console.log(`   Old value: ${currentWebsite}`);
    console.log(`   New value: ${testWebsite}`);
    console.log(`   File: ${accountFilePath}`);
  });
});
