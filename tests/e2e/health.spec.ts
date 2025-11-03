import { test, expect } from '@playwright/test'

test('api health endpoints respond 200', async ({ request, baseURL }) => {
  const base = baseURL || 'http://localhost:3000'
  const res1 = await request.get(base + '/api/health')
  expect(res1.ok()).toBeTruthy()
  const res2 = await request.get(base + '/api/stripe-notify')
  expect(res2.ok()).toBeTruthy()
  const res3 = await request.get(base + '/api/hitem3d/callback')
  expect(res3.ok()).toBeTruthy()
})

