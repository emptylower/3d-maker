import { newStorage } from '@/lib/storage'

function checkAuth(req: Request) {
  const token = req.headers.get('x-e2e-test-token') || ''
  const expect = process.env.E2E_TEST_TOKEN || ''
  if (!expect || token !== expect) {
    return false
  }
  return true
}

export async function POST(req: Request) {
  try {
    if (!checkAuth(req)) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    const storage = newStorage()
    const key = `e2e-check/${Date.now()}.txt`
    const body = Buffer.from(`ok-${Date.now()}`)
    const out = await storage.uploadFile({ body, key, contentType: 'text/plain', disposition: 'inline' })
    return Response.json({ ok: true, bucket: out.bucket, key: out.key, location: out.location })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}

