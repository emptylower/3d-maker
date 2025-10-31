import { test, expect } from '@playwright/test';

test('My Credits page shows balance and register bonus entry', async ({ page }) => {
  await page.route('**/api/me/credits', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance: 80,
        ledger: [
          { delta: 80, reason: 'register_bonus', createdAt: new Date().toISOString() }
        ]
      })
    });
  });

  await page.goto('/me/credits');

  await expect(page.getByRole('heading', { name: '我的积分' })).toBeVisible();
  await expect(page.getByText('余额：80')).toBeVisible();
  await expect(page.getByText('register_bonus +80')).toBeVisible();
});

