import { expect, test } from '@playwright/test';

// this is an example Playwright e2e test
test('should render admin panel logo', async ({ page }) => {
  await page.goto('/admin');

  // login
  await page.fill('#field-email', 'bhuvan@flash-cms.online');
  await page.fill('#field-password', 'bhuvanbm7');
  await page.click('.form-submit button');

  // should show dashboard
  await expect(page).toHaveTitle(/Dashboard/);
  await expect(page.locator('.graphic-icon')).toBeVisible();
});
