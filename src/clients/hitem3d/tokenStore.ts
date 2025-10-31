import { getSupabaseAdmin } from '../../lib/supabaseServer';
import type { HToken } from './types';

export interface TokenStore {
  get(provider: string): Promise<HToken | null>;
  set(provider: string, token: HToken): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private map = new Map<string, HToken>();
  async get(provider: string): Promise<HToken | null> {
    const t = this.map.get(provider) || null;
    return t && t.expiresAt > Date.now() ? t : null;
  }
  async set(provider: string, token: HToken): Promise<void> {
    this.map.set(provider, token);
  }
}

export class SupabaseTokenStore implements TokenStore {
  table = 'api_tokens';
  async get(provider: string): Promise<HToken | null> {
    const s = getSupabaseAdmin();
    if (!s) return null;
    const { data, error } = await s
      .from(this.table)
      .select('provider, token, token_type, expires_at')
      .eq('provider', provider)
      .maybeSingle();
    if (error) return null;
    if (!data) return null;
    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() >= expiresAt) return null;
    return { accessToken: data.token, tokenType: data.token_type || 'Bearer', expiresAt };
  }
  async set(provider: string, token: HToken): Promise<void> {
    const s = getSupabaseAdmin();
    if (!s) return;
    await s
      .from(this.table)
      .upsert(
        {
          provider,
          token: token.accessToken,
          token_type: token.tokenType,
          expires_at: new Date(token.expiresAt).toISOString()
        },
        { onConflict: 'provider' }
      );
  }
}

export function getDefaultTokenStore(): TokenStore {
  // Prefer supabase when available, else memory
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return new SupabaseTokenStore();
  return new MemoryTokenStore();
}
