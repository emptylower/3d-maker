import { findGenerationTaskByTaskId } from '@/models/generation-task'

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
  const task_id = url.searchParams.get('task_id') || ''
  if (!task_id) {
    return Response.json({ error: 'task_id required' }, { status: 400 })
  }
  const t = await findGenerationTaskByTaskId(task_id)
  if (!t) return Response.json({ error: 'not_found' }, { status: 404 })
  return Response.json({ ok: true, data: t })
}

