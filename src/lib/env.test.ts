import { validateEnv } from './env';

describe('env validator', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws when required envs are missing (explicit subset)', () => {
    // Intentionally clear a few keys to trigger failure
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.STRIPE_SECRET_KEY;
    expect(() => validateEnv(['NEXT_PUBLIC_SUPABASE_URL', 'STRIPE_SECRET_KEY'])).toThrow(
      /Missing required environment variables/
    );
  });

  it('passes when all required envs exist (explicit subset)', () => {
    // Provide all keys (jest.setup.ts already sets defaults, this ensures explicitness)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:1234';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'role';
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x';
    process.env.ADMIN_EMAIL = 'lijianjie@koi.codes';
    process.env.HITEM3D_BASE_URL = 'https://api.hitem3d.ai';
    process.env.HITEM3D_CLIENT_ID = 'cid';
    process.env.HITEM3D_CLIENT_SECRET = 'csec';

    expect(() => validateEnv(['NEXT_PUBLIC_SUPABASE_URL', 'STRIPE_SECRET_KEY'])).not.toThrow();
  });
});
