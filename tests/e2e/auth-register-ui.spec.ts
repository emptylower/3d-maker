import { test, expect } from '@playwright/test'

const baseProvided = !!(process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || process.env.NEXT_PUBLIC_WEB_URL)
test.skip(!baseProvided, 'baseURL not set for auth e2e')

test('注册后自动登录，导航状态更新（登录按钮消失）', async ({ page, baseURL }) => {
  const base = baseURL || 'http://localhost:3000'
  const rand = Math.random().toString(36).slice(2, 8)
  const email = `e2e_ui_${rand}@example.com`
  const password = '12345678'

  await page.goto(base.endsWith('/') ? base + 'zh/auth/register' : base + '/zh/auth/register')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '注册' }).click()

  // Redirect to home
  await page.waitForURL(/\/zh(\/)?$/)

  // 登录按钮应消失（SignToggle 切为用户头像）
  await expect(page.getByRole('button', { name: '登录' })).toHaveCount(0)
})

