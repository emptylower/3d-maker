import { insertApikey, ApikeyStatus } from '@/models/apikey'
import { getIsoTimestr } from '@/lib/time'
import { getSnowId } from '@/lib/hash'

function checkAuth(req: Request) {
  const token = req.headers.get('x-e2e-test-token') || ''
  const expect = process.env.E2E_TEST_TOKEN || ''
  if (!expect || token !== expect) return false
  return true
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return Response.json({ error: 'forbidden' }, { status: 403 })
  const { user_uuid, title } = await req.json() as { user_uuid: string, title?: string }
  if (!user_uuid) return Response.json({ error: 'user_uuid required' }, { status: 400 })
  const api_key = 'sk-' + getSnowId()
  await insertApikey({ api_key, title: title || 'e2e', user_uuid, created_at: getIsoTimestr(), status: ApikeyStatus.Created as any } as any)
  return Response.json({ ok: true, api_key })
}

