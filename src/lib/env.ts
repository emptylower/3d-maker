import requiredKeys from '../../config/requiredEnv.json';

export type Env = Record<string, string> & {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  ADMIN_EMAIL: string;
  HITEM3D_BASE_URL: string;
  HITEM3D_CLIENT_ID: string;
  HITEM3D_CLIENT_SECRET: string;
};

/**
 * Validate required env vars and return a typed env object.
 * Throws if any required key is missing or empty.
 */
export function validateEnv(keys: string[] = requiredKeys): Env {
  const missing: string[] = [];
  for (const k of keys) {
    const v = process.env[k];
    if (!v || String(v).length === 0) missing.push(k);
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return process.env as unknown as Env;
}

/**
 * Safe accessor used by server code to ensure validation has happened.
 */
export function getEnv(): Env {
  return validateEnv();
}
