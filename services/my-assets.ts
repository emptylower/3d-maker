import { listGenerationTasks } from '@/models/generation-task'
import { listAssetsByUser } from '@/models/asset'
import { listPublicationsByUser } from '@/models/publication'
import { newStorage } from '@/lib/storage'

export type TaskOverview = {
  task_id: string
  state: 'created' | 'queueing' | 'processing' | 'success' | 'failed'
  model_version?: string
  resolution?: string
  request_type?: number
  created_at?: string
  updated_at?: string
  has_asset: boolean
}

export type AssetOverview = {
  uuid: string
  task_id?: string | null
  title?: string | null
  created_at?: string
  cover_url?: string
  is_public: boolean
  slug?: string | null
}

export async function getMyAssetsOverview(user_uuid: string, page = 1, limit = 50): Promise<{
  tasks: TaskOverview[]
  assets: AssetOverview[]
}> {
  const [allTasks, assets, publications] = await Promise.all([
    listGenerationTasks(page, limit),
    listAssetsByUser(user_uuid, page, limit),
    listPublicationsByUser(user_uuid, page, limit),
  ])

  const tasks = (allTasks || []).filter((t: any) => t.user_uuid === user_uuid)

  const assetByTaskId = new Map<string, any>()
  for (const a of assets || []) {
    if (a.task_id) {
      assetByTaskId.set(a.task_id, a)
    }
  }

  const publishedByAsset = new Map<string, any>()
  for (const p of publications || []) {
    if (p.asset_uuid && p.status === 'online') {
      publishedByAsset.set(p.asset_uuid, p)
    }
  }

  const tasksDto: TaskOverview[] = tasks.map((t: any) => ({
    task_id: t.task_id,
    state: t.state,
    model_version: t.model_version,
    resolution: t.resolution,
    request_type: t.request_type,
    created_at: t.created_at,
    updated_at: t.updated_at,
    has_asset: assetByTaskId.has(t.task_id),
  }))

  const buildCoverUrl = (() => {
    let storage: ReturnType<typeof newStorage> | null = null

    return async (cover_key?: string | null): Promise<string | undefined> => {
      if (!cover_key) return undefined
      const domain = (process.env.STORAGE_DOMAIN || '').replace(/\/$/, '')
      const key = cover_key.replace(/^\/+/, '')
      if (domain) {
        return `${domain}/${key}`
      }
      try {
        if (!storage) storage = newStorage()
        const filename = encodeURIComponent(key.split('/').pop() || 'cover.webp')
        const { url } = await storage.getSignedUrl({
          key,
          responseDisposition: `inline; filename=${filename}`,
        })
        return url
      } catch {
        return undefined
      }
    }
  })()

  const assetsDto: AssetOverview[] = []
  for (const a of assets || []) {
    const pub = publishedByAsset.get(a.uuid)
    const cover_url = await buildCoverUrl(a.cover_key)
    assetsDto.push({
      uuid: a.uuid,
      task_id: a.task_id,
      title: a.title,
      created_at: a.created_at,
      cover_url,
      is_public: !!pub && pub.status === 'online',
      slug: pub?.slug,
    })
  }

  return { tasks: tasksDto, assets: assetsDto }
}
