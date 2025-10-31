import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseForAuth } from '@/src/lib/supabaseServer';
import { CreditsService } from '@/src/services/creditsService';
import { SupabaseCreditsRepo } from '@/src/repo/supabaseRepo';
import { MemoryCreditsRepo } from '@/src/repo/memoryRepo';

export async function GET(req: NextRequest) {
  // Prefer Authorization: Bearer <token>
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : undefined;
  const userIdHeader = req.headers.get('x-user-id') || undefined;

  let userId: string | undefined;
  let email: string | undefined;

  const authClient = getSupabaseForAuth(token);
  if (authClient && token) {
    const { data, error } = await authClient.client.auth.getUser(token);
    if (!error && data?.user) {
      userId = data.user.id;
      email = data.user.email ?? undefined;
    }
  }
  // Dev fallback for tests or local tooling
  if (!userId) userId = userIdHeader;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL || 'lijianjie@koi.codes';
  const repo = process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseCreditsRepo() : new MemoryCreditsRepo();
  const svc = new CreditsService({ repo, adminEmail });

  // No register-bonus here to keep GET idempotent; bonus is handled in auth callback route.
  const summary = await svc.getSummary(userId);
  return NextResponse.json(summary, { status: 200 });
}
