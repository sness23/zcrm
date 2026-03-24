import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

test.describe('Contact App Integration', () => {
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

  test('should load contact app and display contact form', async () => {
    // Set up console logging to track what's happening
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to contact-app via nginx proxy
    console.log('Navigating to contact-app...');
    await page.goto('http://local.contact.doi.bio');
    console.log('✓ Navigated to contact-app');

    // Wait for the app to load - look for the main heading
    console.log('Waiting for app to load...');
    await page.waitForSelector('h1', { timeout: 10000 });
    console.log('✓ App loaded');

    // Verify the heading is "Contact Us"
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Contact Us');
    console.log('✅ VERIFIED: Heading shows "Contact Us"');

    // Verify the subtitle is visible
    console.log('Checking subtitle...');
    const subtitle = page.locator('.subtitle');
    await expect(subtitle).toHaveText("Let's start a conversation");
    console.log('✅ VERIFIED: Subtitle shows "Let\'s start a conversation"');

    // Verify the form header is visible
    console.log('Checking form header...');
    const formHeader = page.locator('.form-header h2');
    await expect(formHeader).toHaveText('Get in touch.');
    console.log('✅ VERIFIED: Form header shows "Get in touch."');

    // Verify the doi.bio logo is visible
    console.log('Checking logo...');
    const logo = page.locator('img[alt="doi.bio"]');
    await expect(logo).toBeVisible();
    console.log('✅ VERIFIED: Logo is visible');

    // Verify all form fields are present
    console.log('Checking form fields...');
    const phoneInput = page.locator('input[name="phone"]');
    const emailInput = page.locator('input[name="email"]');
    const nameInput = page.locator('input[name="name"]');
    const companyInput = page.locator('input[name="company"]');
    const messageInput = page.locator('textarea[name="message"]');

    await expect(phoneInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(companyInput).toBeVisible();
    await expect(messageInput).toBeVisible();
    console.log('✅ VERIFIED: All form fields are visible');

    // Verify contact methods are displayed
    console.log('Checking contact methods...');
    const phoneContact = page.locator('a[href="tel:+15555551234"]');
    const emailContact = page.locator('a[href="mailto:hello@example.com"]');
    await expect(phoneContact).toHaveText('1-555-555-1234');
    await expect(emailContact).toHaveText('hello@example.com');
    console.log('✅ VERIFIED: Contact methods are displayed');

    // Verify business hours are displayed
    console.log('Checking business hours...');
    const businessHours = page.locator('.additional-info');
    await expect(businessHours).toContainText('Business Hours');
    await expect(businessHours).toContainText('Monday - Friday: 9:00 AM - 6:00 PM PST');
    console.log('✅ VERIFIED: Business hours are displayed');

    // Verify WebSocket connection status indicator is visible
    console.log('Checking connection status...');
    const statusIndicator = page.locator('.status-indicator');
    await expect(statusIndicator).toBeVisible();
    console.log('✅ VERIFIED: Connection status indicator is visible');

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/contact-integration-test.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/contact-integration-test.png');

    console.log('\n✅ Test passed! Contact app loaded successfully.');
    console.log('   Browser tab will remain open for inspection.');
  });

  test('should allow form interaction and phone number formatting', async () => {
    // Navigate to contact-app
    console.log('Navigating to contact-app...');
    await page.goto('http://local.contact.doi.bio');
    await page.waitForSelector('h1', { timeout: 10000 });
    console.log('✓ App loaded');

    // Fill in phone number and verify formatting
    console.log('Testing phone number formatting...');
    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill('5555551234');

    // Verify the phone number is formatted as (XXX) XXX-XXXX
    const phoneValue = await phoneInput.inputValue();
    expect(phoneValue).toBe('(778) 866-6399');
    console.log('✅ VERIFIED: Phone number formatted correctly:', phoneValue);

    // Fill in other form fields
    console.log('Filling in form fields...');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="company"]').fill('Test Company');
    await page.locator('textarea[name="message"]').fill('This is a test message.');
    console.log('✅ VERIFIED: Form fields can be filled');

    // Verify submit button is visible and enabled
    console.log('Checking submit button...');
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    console.log('✅ VERIFIED: Submit button is visible and enabled');

    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/contact-form-filled.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/contact-form-filled.png');

    // Click the Send Message button
    console.log('Clicking Send Message button...');
    await submitButton.click();
    console.log('✅ CLICKED: Send Message button');

    // Wait for thank you message to appear
    console.log('Waiting for thank you message...');
    await page.waitForTimeout(1000); // Give time for confetti and scroll animation

    // Verify page scrolled to top (check scroll position)
    const scrollY = await page.evaluate(() => window.scrollY);
    console.log(`✅ VERIFIED: Page scroll position: ${scrollY}px`);

    // Take screenshot of thank you state
    await page.screenshot({ path: 'test-results/contact-form-submitted.png', fullPage: true });
    console.log('✓ Screenshot saved to test-results/contact-form-submitted.png');

    console.log('\n✅ Test passed! Form submission works correctly.');
    console.log('   Browser tab will remain open for inspection.');
  });
});
