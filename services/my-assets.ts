import { listGenerationTasks } from '@/models/generation-task'
import { listAssetsByUser } from '@/models/asset'
import { listPublicationsByUser } from '@/models/publication'

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

function buildCoverUrl(cover_key?: string | null): string | undefined {
  if (!cover_key) return undefined
  const domain = (process.env.STORAGE_DOMAIN || '').replace(/\/$/, '')
  if (!domain) return undefined
  const key = cover_key.replace(/^\/+/, '')
  return `${domain}/${key}`
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

  const assetsDto: AssetOverview[] = (assets || []).map((a: any) => {
    const pub = publishedByAsset.get(a.uuid)
    return {
      uuid: a.uuid,
      task_id: a.task_id,
      title: a.title,
      created_at: a.created_at,
      cover_url: buildCoverUrl(a.cover_key),
      is_public: !!pub && pub.status === 'online',
      slug: pub?.slug,
    }
  })

  return { tasks: tasksDto, assets: assetsDto }
}

