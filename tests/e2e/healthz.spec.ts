import { test, expect } from '@playwright/test';

test('GET /api/healthz returns 200 and ok', async ({ request, baseURL }) => {
  const res = await request.get(`${baseURL}/api/healthz`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.status).toBe('ok');
  expect(data.service).toBe('hitem3d-square');
  expect(typeof data.time).toBe('string');
});
