// Non-destructive UI smoke check. Submissions/email requests are intercepted;
// no live customer account, email, or special-order record is created.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base = process.env.VERIFY_BASE_URL || 'http://localhost:3100';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => sessionStorage.setItem('bronxville-entry-mode-v3', 'guest'));
  await page.context().addCookies([{ name: 'bronxville-entry-mode-v3', value: 'guest', url: base }]);
  let submitted;
  await page.route('**/api/supplement-requests', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true }, status: 201 });
  });
  await page.goto(`${base}/requests`);
  await page.getByLabel('Supplement name', { exact: false }).fill('Test supplement');
  await page.getByLabel('UPC / barcode').fill('000123456789');
  await page.getByLabel('Your name', { exact: false }).fill('UI Test');
  await page.getByLabel('Email', { exact: false }).fill('ui-test@example.invalid');
  await page.getByRole('button', { name: 'Send special request' }).click();
  await page.getByRole('heading', { name: 'Your request is with our team.' }).waitFor();
  assert.equal(submitted.upc, '000123456789');
  assert.ok(submitted.request_key);
  await page.route('**/api/auth?action=forgot-password', route => route.fulfill({ status: 503, json: { detail: 'Email service unavailable. Please try again.' } }));
  await page.goto(`${base}/auth/forgot-password`);
  await page.getByLabel('Email', { exact: true }).fill('ui-test@example.invalid');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Email service unavailable. Please try again.', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/requests`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: 'outputs/special-requests-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/requests`);
  await page.screenshot({ path: 'outputs/special-requests-desktop.png', fullPage: true });
  console.log('PASS: guest request form, preserved UPC, safe email failure, mobile layout. No live submissions.');
} finally { await browser.close(); }
