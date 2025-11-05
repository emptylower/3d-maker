import { test, expect } from '@playwright/test'

// Skip when baseURL is not provided (to avoid failing in local CI without server)
const baseProvided = !!(process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || process.env.NEXT_PUBLIC_WEB_URL)
test.skip(!baseProvided, 'baseURL not set for navigation e2e')

test('nav: 首页点击 创作/资产/广场 均可达', async ({ page, baseURL }) => {
  const base = baseURL || 'http://localhost:3000'
  // Prefer Chinese entry
  await page.goto(base.endsWith('/') ? base + 'zh' : base + '/zh')

  // 创作
  await page.getByRole('link', { name: '创作' }).click()
  await expect(page).toHaveURL(/\/generate$/)

  // 资产
  await page.goBack()
  await page.getByRole('link', { name: '资产' }).click()
  await expect(page).toHaveURL(/\/my-assets$/)

  // 广场
  await page.goBack()
  await page.getByRole('link', { name: '广场' }).click()
  await expect(page).toHaveURL(/\/plaza$/)
})

