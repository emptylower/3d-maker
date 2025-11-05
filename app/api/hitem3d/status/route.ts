import { getUserUuid } from '@/services/user'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'

export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })

    const url = new URL(req.url)
    const task_id = url.searchParams.get('task_id') || ''
    if (!task_id) return Response.json({ code: -1, message: 'task_id required' }, { status: 400 })

    const local = await findGenerationTaskByTaskId(task_id)
    if (!local || local.user_uuid !== user_uuid) {
      // not found or not owned
      return Response.json({ code: -1, message: 'not found' }, { status: 404 })
    }

    // prefer local state, but also try vendor for fresh status if not success/failed
    let state = local.state
    if (state !== 'success' && state !== 'failed') {
      try {
        const vendor = await queryTask(task_id)
        state = vendor.state as any
      } catch {
        // ignore vendor errors, fallback to local
      }
    }
    return Response.json({ code: 0, data: { state } })
  } catch (e) {
    console.error('status query failed:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

