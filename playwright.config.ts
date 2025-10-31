import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npx next dev -H 127.0.0.1 -p 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      STRIPE_SECRET_KEY: 'sk_test_XXXXX',
      STRIPE_WEBHOOK_SECRET: 'whsec_XXXXX',
      ADMIN_EMAIL: 'lijianjie@koi.codes',
      HITEM3D_BASE_URL: 'https://api.hitem3d.ai',
      HITEM3D_CLIENT_ID: 'client_id',
      HITEM3D_CLIENT_SECRET: 'client_secret',
    },
  },
});
