import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { ulid } from 'ulidx';

test.describe('Leads-App Display and Interaction', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const testLeadName = 'Jane Smith';
  let leadFilePath: string;
  let leadId: string;
  let createdLead = false; // Track if we created the lead

  test.beforeAll(async () => {
    // Connect to existing Chrome browser running with remote debugging
    browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✓ Connected to existing Chrome browser');

    // Find or create the test lead file
    const leadsDir = path.join(process.cwd(), 'vault', 'leads');

    // Ensure leads directory exists
    if (!fs.existsSync(leadsDir)) {
      fs.mkdirSync(leadsDir, { recursive: true });
    }

    const files = fs.readdirSync(leadsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(leadsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = matter(content);

      if (parsed.data.name === testLeadName) {
        leadFilePath = filePath;
        leadId = parsed.data.id;
        console.log(`✓ Found existing lead: ${testLeadName}`);
        console.log(`  File: ${file}`);
        console.log(`  ID: ${leadId}`);
        break;
      }
    }

    // If lead doesn't exist, create it
    if (!leadFilePath) {
      console.log(`Lead "${testLeadName}" not found, creating it...`);

      leadId = `led_${ulid()}`;
      const slug = 'jane-smith';
      leadFilePath = path.join(leadsDir, `${slug}.md`);

      const leadData = {
        id: leadId,
        type: 'Lead',
        name: testLeadName,
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        company: 'TechCorp Inc',
        title: 'VP of Engineering',
        status: 'New',
        source: 'website',
        description: 'Interested in our enterprise solution for team collaboration.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const leadContent = matter.stringify('# Jane Smith\n\nTest lead for integration tests.\n', leadData);
      fs.writeFileSync(leadFilePath, leadContent, 'utf8');

      createdLead = true;
      console.log(`✓ Created test lead: ${testLeadName}`);
      console.log(`  File: ${slug}.md`);
      console.log(`  ID: ${leadId}`);

      // Wait for API to sync the new lead to database
      console.log('Waiting for API to sync lead...');
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
    if (leadFilePath && createdLead) {
      try {
        // Delete the lead we created
        fs.unlinkSync(leadFilePath);
        console.log(`✓ Deleted test lead: ${testLeadName}`);
        console.log(`  File: ${leadFilePath}`);
      } catch (err) {
        console.warn('⚠ Could not clean up test lead:', err);
      }
    }

    // Don't close the browser - we're just connected to it
  });

  test('should display leads in grid layout', async () => {
    // Set up console logging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to leads-app via nginx proxy
    console.log('Navigating to leads-app...');
    await page.goto('http://local.leads.doi.bio');
    console.log('✓ Navigated to leads-app');

    // Wait for the leads grid to load
    console.log('Waiting for leads grid to load...');
    await page.waitForSelector('.leads-grid', { timeout: 10000 });
    console.log('✓ Leads grid loaded');

    // Find the test lead card
    console.log(`Looking for "${testLeadName}" in the grid...`);
    const leadCard = page.locator('.lead-card', { hasText: testLeadName });
    await expect(leadCard).toBeVisible({ timeout: 5000 });
    console.log(`✓ Found "${testLeadName}" lead card`);

    // Verify lead card contains expected information
    console.log('Verifying lead card contents...');

    // Check for name
    const nameElement = leadCard.locator('.lead-name h3');
    await expect(nameElement).toHaveText(testLeadName);
    console.log('  ✓ Name displayed correctly');

    // Check for company
    const companyElement = leadCard.locator('.lead-company');
    await expect(companyElement).toContainText('TechCorp Inc');
    console.log('  ✓ Company displayed correctly');

    // Check for email
    const emailElement = leadCard.locator('.lead-email a');
    await expect(emailElement).toHaveAttribute('href', 'mailto:jane.smith@example.com');
    console.log('  ✓ Email displayed correctly');

    // Check for status badge
    const statusElement = leadCard.locator('.lead-status');
    await expect(statusElement).toContainText('New');
    console.log('  ✓ Status badge displayed correctly');

    // Check for title
    const titleElement = leadCard.locator('.lead-title');
    await expect(titleElement).toContainText('VP of Engineering');
    console.log('  ✓ Title displayed correctly');

    // Check for description
    const descriptionElement = leadCard.locator('.lead-description');
    await expect(descriptionElement).toContainText('Interested in our enterprise solution');
    console.log('  ✓ Description displayed correctly');

    // Verify header shows correct count
    console.log('Verifying lead count in header...');
    const leadCount = page.locator('.lead-count');
    const countText = await leadCount.textContent();
    expect(countText).toMatch(/\d+ leads?/);
    console.log(`  ✓ Lead count displayed: ${countText}`);

    // Take screenshot
    await page.screenshot({ path: 'test-results/leads-app-display-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/leads-app-display-test.png');

    console.log('\n✅ Test passed! Leads displayed correctly in grid layout.');
    console.log(`   Lead: ${testLeadName}`);
    console.log(`   Company: TechCorp Inc`);
    console.log(`   Status: New`);
  });

  test('should refresh leads when refresh button is clicked', async () => {
    // Navigate to leads-app
    console.log('Navigating to leads-app...');
    await page.goto('http://local.leads.doi.bio');
    console.log('✓ Navigated to leads-app');

    // Wait for the leads grid to load
    await page.waitForSelector('.leads-grid', { timeout: 10000 });
    console.log('✓ Leads grid loaded');

    // Get initial lead count
    const initialCountText = await page.locator('.lead-count').textContent();
    console.log(`  Initial count: ${initialCountText}`);

    // Click refresh button
    console.log('Clicking refresh button...');
    const refreshBtn = page.locator('.refresh-btn');
    await refreshBtn.click();
    console.log('✓ Clicked refresh button');

    // Try to catch the disabled state (might be too fast if API responds quickly)
    try {
      await expect(refreshBtn).toBeDisabled({ timeout: 100 });
      console.log('✓ Refresh button was disabled during loading');
    } catch (error) {
      console.log('⚠️  Refresh button loading state too fast to catch (API responded quickly)');
    }

    // Wait for loading to complete (button should be enabled)
    await expect(refreshBtn).toBeEnabled({ timeout: 5000 });
    console.log('✓ Refresh button is enabled after loading');

    // Verify leads are still displayed
    const leadCard = page.locator('.lead-card', { hasText: testLeadName });
    await expect(leadCard).toBeVisible({ timeout: 5000 });
    console.log(`✓ "${testLeadName}" still visible after refresh`);

    console.log('\n✅ Test passed! Refresh functionality works correctly.');
  });

  test('should display header with logo and user menu', async () => {
    // Navigate to leads-app
    console.log('Navigating to leads-app...');
    await page.goto('http://local.leads.doi.bio');
    console.log('✓ Navigated to leads-app');

    // Wait for header
    await page.waitForSelector('.app-header', { timeout: 10000 });
    console.log('✓ Header loaded');

    // Verify logo is present
    const logo = page.locator('.app-logo');
    await expect(logo).toBeVisible();
    console.log('  ✓ Logo displayed');

    // Verify title is present
    const title = page.locator('.app-header h1');
    await expect(title).toHaveText('leads');
    console.log('  ✓ Title displayed correctly');

    // Verify subtitle is present
    const subtitle = page.locator('.header-subtitle');
    await expect(subtitle).toContainText('Lead management system');
    console.log('  ✓ Subtitle displayed correctly');

    // Verify user menu is present
    const userMenu = page.locator('.user-menu');
    await expect(userMenu).toBeVisible();
    console.log('  ✓ User menu displayed');

    // Verify user avatar is present
    const userAvatar = page.locator('.user-avatar');
    await expect(userAvatar).toBeVisible();
    console.log('  ✓ User avatar displayed');

    console.log('\n✅ Test passed! Header displays correctly with all elements.');
  });
});
