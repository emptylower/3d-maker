import { getUserUuid } from '@/services/user'
import { findAssetByTaskId } from '@/models/asset'

export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const url = new URL(req.url)
    const task_id = url.searchParams.get('task_id') || ''
    if (!task_id) return Response.json({ code: -1, message: 'task_id required' }, { status: 400 })

    const asset = await findAssetByTaskId(task_id)
    if (!asset || asset.user_uuid !== user_uuid) return Response.json({ code: 0, data: { asset_uuid: null } })
    return Response.json({ code: 0, data: { asset_uuid: asset.uuid } })
  } catch (e) {
    console.error('by-task failed:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

