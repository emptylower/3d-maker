import { insertGenerationTask } from '@/models/generation-task'
import { getIsoTimestr } from '@/lib/time'

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
    const now = getIsoTimestr()
    const body = (await req.json()) as any
    const { task_id, user_uuid, request_type = 3, model_version = 'hitem3dv1', resolution = '1024', face, format, credits_charged = 100 } = body || {}
    if (!task_id || !user_uuid) {
      return Response.json({ error: 'task_id and user_uuid required' }, { status: 400 })
    }
    await insertGenerationTask({
      task_id,
      user_uuid,
      request_type,
      model_version,
      resolution,
      face,
      format,
      state: 'created',
      credits_charged,
      created_at: now,
      updated_at: now,
    } as any)
    return Response.json({ ok: true, task_id })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}

