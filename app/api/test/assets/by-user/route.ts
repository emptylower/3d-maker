import { getSupabaseClient } from '@/models/db'

function checkAuth(req: Request) {
  const token = req.headers.get('x-e2e-test-token') || ''
  const expect = process.env.E2E_TEST_TOKEN || ''
  if (!expect || token !== expect) return false
  return true
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const user_uuid = url.searchParams.get('user_uuid') || ''
  if (!user_uuid) return Response.json({ error: 'user_uuid required' }, { status: 400 })
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('user_uuid', user_uuid)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, data })
}

