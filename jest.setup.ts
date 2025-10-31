// Ensure tests run with a complete env by providing non-secret placeholders.
// Real values are set in Vercel; do not commit secrets.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_XXXXX';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_XXXXX';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lijianjie@koi.codes';
process.env.HITEM3D_BASE_URL = process.env.HITEM3D_BASE_URL || 'https://api.hitem3d.ai';
process.env.HITEM3D_CLIENT_ID = process.env.HITEM3D_CLIENT_ID || 'client_id';
process.env.HITEM3D_CLIENT_SECRET = process.env.HITEM3D_CLIENT_SECRET || 'client_secret';
