import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

console.log('Navigating to party-app...');
await page.goto('http://localhost:9115');
await page.waitForTimeout(2000);

console.log('Clicking first party...');
await page.click('tbody tr:first-child');
await page.waitForTimeout(2000);

console.log('Taking screenshot...');
await page.screenshot({ path: '/tmp/party-detail-view.png', fullPage: true });

console.log('Screenshot saved to /tmp/party-detail-view.png');
await browser.close();
