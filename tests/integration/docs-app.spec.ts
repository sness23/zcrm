import { test, expect } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

test.describe('Docs App Integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let testFilePath: string;
  let originalFileContent: string;

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

    // Restore original file content if we modified it
    if (testFilePath && originalFileContent) {
      try {
        fs.writeFileSync(testFilePath, originalFileContent, 'utf8');
        console.log('✓ Restored original file content');

        // Clear the variables to avoid reusing them
        testFilePath = '';
        originalFileContent = '';
      } catch (err) {
        console.warn('⚠ Could not restore file:', err);
      }
    }
  });

  test.afterAll(async () => {
    // Don't close the browser - we're just connected to it
    // await browser.close();
  });

  test('should save typed content to markdown file on disk', async () => {
    // Set up console logging to track what's happening
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    });

    // Navigate to docs-app via nginx proxy
    console.log('Navigating to docs-app...');
    await page.goto('http://local.docs.doi.bio');
    console.log('✓ Navigated to docs-app');

    // Wait for file tree to load
    console.log('Waiting for file tree to load...');
    await page.waitForSelector('.file-tree-item', { timeout: 10000 });
    console.log('✓ File tree loaded');

    // Find and click on evolutionaryscale-ai.md specifically
    console.log('Looking for evolutionaryscale-ai.md...');
    const evolutionaryScaleFile = page.locator('.file-tree-item .name:has-text("evolutionaryscale-ai.md")');
    await evolutionaryScaleFile.waitFor({ timeout: 5000 });

    const fileName = await evolutionaryScaleFile.textContent();
    console.log(`✓ Found file: ${fileName}`);

    // Build file path and read original content
    testFilePath = path.join(process.cwd(), 'vault', 'accounts', fileName!.trim());
    originalFileContent = fs.readFileSync(testFilePath, 'utf8');
    console.log(`✓ Original file: ${testFilePath}`);
    console.log(`✓ Original content: ${originalFileContent.length} chars`);

    await evolutionaryScaleFile.click();
    console.log('✓ Clicked on file');

    // Wait for MDEditor to load - look for the editor container
    console.log('Waiting for editor to load...');
    await page.waitForSelector('.w-md-editor', { timeout: 5000 });
    console.log('✓ MDEditor container loaded');

    // Find the actual editable textarea inside MDEditor
    const editor = page.locator('.w-md-editor-text-input, .w-md-editor textarea').first();
    await editor.waitFor({ timeout: 5000 });
    console.log('✓ Editor textarea found');

    // Wait for file to fully load
    console.log('Waiting for file content to load...');
    await page.waitForTimeout(1000);

    // Get current content
    const originalContent = await editor.inputValue();
    console.log(`✓ File loaded (${originalContent.length} chars)`);

    // Add test content at the end
    const testTimestamp = Date.now();
    const testText = `test-${testTimestamp}`;

    console.log(`Now typing test content: "${testText}"...`);

    // Focus the editor
    await editor.click();
    await page.waitForTimeout(500);

    // Move cursor to end of content
    await page.keyboard.press('End'); // Move to end of current line
    await page.keyboard.press('Control+End'); // Move to end of document (Linux/Windows)
    await page.keyboard.press('Meta+ArrowDown'); // Move to end of document (macOS)
    await page.waitForTimeout(300);

    // Type the test text with a newline before it
    await page.keyboard.type(`\n\n${testText}`);
    console.log('✓ Finished typing');

    // Wait for auto-save and poll the file until content appears
    console.log('Waiting for auto-save to write to disk...');
    let updatedFileContent = '';
    let attempts = 0;
    const maxAttempts = 15; // 15 attempts * 500ms = 7.5 seconds max

    while (attempts < maxAttempts) {
      await page.waitForTimeout(500);
      attempts++;

      updatedFileContent = fs.readFileSync(testFilePath, 'utf8');

      if (updatedFileContent.includes(testText)) {
        console.log(`✓ Content saved after ${attempts * 500}ms`);
        break;
      }

      if (attempts % 2 === 0) {
        console.log(`  Polling... attempt ${attempts}/${maxAttempts}`);
      }
    }

    console.log(`✓ Updated content: ${updatedFileContent.length} chars`);

    // Verify the test content is in the file
    expect(updatedFileContent).toContain(testText);
    console.log(`✅ VERIFIED: Test content "${testText}" found in file on disk!`);

    // Verify file size increased
    expect(updatedFileContent.length).toBeGreaterThan(originalFileContent.length);
    console.log(`✅ VERIFIED: File size increased (${originalFileContent.length} → ${updatedFileContent.length} chars)`);

    // Calculate the difference
    const bytesAdded = updatedFileContent.length - originalFileContent.length;
    console.log(`✓ Content added: ${bytesAdded} chars`);

    // Take screenshot for verification
    await page.screenshot({ path: 'test-results/docs-integration-test.png' });
    console.log('✓ Screenshot saved to test-results/docs-integration-test.png');

    console.log('\n✅ Test passed! File saved successfully to disk.');
    console.log('   Browser tab will remain open for inspection.');
  });
});
