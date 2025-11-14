import { getUserUuid } from '@/services/user'
import { getMyAssetsOverview } from '@/services/my-assets'

export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) {
      return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    }

    const url = new URL(req.url)
    const pageParam = Number(url.searchParams.get('page') || '1')
    const limitParam = Number(url.searchParams.get('limit') || '50')
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50

    const { tasks, assets } = await getMyAssetsOverview(user_uuid, page, limit)

    return Response.json({
      code: 0,
      data: {
        tasks,
        assets,
      },
    })
  } catch (e) {
    console.error('my-assets overview failed:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}
