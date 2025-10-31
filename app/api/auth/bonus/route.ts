import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForAuth } from '@/src/lib/supabaseServer';
import { CreditsService } from '@/src/services/creditsService';
import { SupabaseCreditsRepo } from '@/src/repo/supabaseRepo';
import { MemoryCreditsRepo } from '@/src/repo/memoryRepo';

// POST /api/auth/bonus
// Use Authorization: Bearer <supabase access token>
// On first call per user, grants register bonus (80). Idempotent.
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : undefined;
  const authClient = getSupabaseForAuth(token);

  let userId: string | undefined;
  let email: string | undefined;
  if (authClient && token) {
    const { data, error } = await authClient.client.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    userId = data.user.id;
    email = data.user.email ?? undefined;
  } else {
    // Dev fallback for local testing without auth
    userId = req.headers.get('x-user-id') || undefined;
    email = req.headers.get('x-user-email') || undefined;
  }

  if (!userId || !email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL || 'lijianjie@koi.codes';
  const repo = process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseCreditsRepo() : new MemoryCreditsRepo();
  const svc = new CreditsService({ repo, adminEmail });

  const result = await svc.ensureRegisterBonus({ userId, email });
  return NextResponse.json(result, { status: 200 });
}

