import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/models/generation-task', () => ({ listGenerationTasks: vi.fn() }))
vi.mock('@/models/asset', () => ({ listAssetsByUser: vi.fn() }))
vi.mock('@/models/publication', () => ({ listPublicationsByUser: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))

import { GET } from '@/app/api/my-assets/overview/route'
import { getUserUuid } from '@/services/user'
import { listGenerationTasks } from '@/models/generation-task'
import { listAssetsByUser } from '@/models/asset'
import { listPublicationsByUser } from '@/models/publication'
import { newStorage } from '@/lib/storage'

describe('api/my-assets/overview route', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserUuid as any).mockReset()
    ;(listGenerationTasks as any).mockReset()
    ;(listAssetsByUser as any).mockReset()
    ;(listPublicationsByUser as any).mockReset()
    ;(newStorage as any).mockReset()
    process.env.STORAGE_DOMAIN = ''
  })

  it('returns 401 when not logged in', async () => {
    ;(getUserUuid as any).mockResolvedValue(null)
    const res = await GET(new Request('http://test.local/api/my-assets/overview'))
    expect(res.status).toBe(401)
    const json: any = await res.json()
    expect(json.code).toBe(-1)
    expect(json.message).toBe('no auth')
  })

  it('returns tasks and assets for current user with public flag', async () => {
    ;(getUserUuid as any).mockResolvedValue('user-1')
    ;(listGenerationTasks as any).mockResolvedValue([
      {
        task_id: 'task-1',
        user_uuid: 'user-1',
        state: 'processing',
        model_version: 'hitem3dv1.5',
        resolution: '1536',
        request_type: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:10:00.000Z',
      },
      {
        task_id: 'task-other',
        user_uuid: 'other',
        state: 'processing',
      },
    ])
    ;(listAssetsByUser as any).mockResolvedValue([
      {
        uuid: 'asset-1',
        user_uuid: 'user-1',
        task_id: 'task-1',
        title: 'My Asset',
        cover_key: 'covers/cover-1.webp',
        created_at: '2025-01-01T00:20:00.000Z',
      },
    ])
    ;(listPublicationsByUser as any).mockResolvedValue([
      {
        id: 1,
        asset_uuid: 'asset-1',
        user_uuid: 'user-1',
        slug: 'my-asset',
        status: 'online',
      },
    ])

    ;(newStorage as any).mockReturnValue({
      getSignedUrl: vi.fn(async ({ key }: { key: string }) => ({
        url: `https://signed.example.com/${key}?token=abc`,
        expiresIn: 300,
      })),
    })

    const res = await GET(new Request('http://test.local/api/my-assets/overview'))
    expect(res.status).toBe(200)
    const json: any = await res.json()
    expect(json.code).toBe(0)

    const tasks = json.data.tasks
    const assets = json.data.assets

    expect(tasks).toHaveLength(1)
    expect(tasks[0].task_id).toBe('task-1')
    expect(tasks[0].has_asset).toBe(true)

    expect(assets).toHaveLength(1)
    expect(assets[0].uuid).toBe('asset-1')
    expect(assets[0].is_public).toBe(true)
    expect(assets[0].slug).toBe('my-asset')
    expect(assets[0].cover_url).toBe('https://signed.example.com/covers/cover-1.webp?token=abc')
  })

  it('assets without publication are not public', async () => {
    ;(getUserUuid as any).mockResolvedValue('user-1')
    ;(listGenerationTasks as any).mockResolvedValue([])
    ;(listAssetsByUser as any).mockResolvedValue([
      {
        uuid: 'asset-2',
        user_uuid: 'user-1',
        task_id: 'task-2',
        title: 'Private Asset',
        cover_key: 'covers/cover-2.webp',
        created_at: '2025-01-02T00:00:00.000Z',
      },
    ])
    ;(listPublicationsByUser as any).mockResolvedValue([])

    const res = await GET(new Request('http://test.local/api/my-assets/overview'))
    expect(res.status).toBe(200)
    const json: any = await res.json()
    const assets = json.data.assets
    expect(assets).toHaveLength(1)
    expect(assets[0].uuid).toBe('asset-2')
    expect(assets[0].is_public).toBe(false)
  })

  it('deduplicates tasks by task_id defensively', async () => {
    ;(getUserUuid as any).mockResolvedValue('user-1')
    ;(listGenerationTasks as any).mockResolvedValue([
      {
        task_id: 'task-dup',
        user_uuid: 'user-1',
        state: 'processing',
        model_version: 'hitem3dv1.5',
        resolution: '1536',
        request_type: 1,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:10:00.000Z',
      },
      {
        task_id: 'task-dup',
        user_uuid: 'user-1',
        state: 'queueing',
        model_version: 'hitem3dv1',
        resolution: '1024',
        request_type: 1,
        created_at: '2025-01-01T00:05:00.000Z',
        updated_at: '2025-01-01T00:15:00.000Z',
      },
    ])
    ;(listAssetsByUser as any).mockResolvedValue([])
    ;(listPublicationsByUser as any).mockResolvedValue([])

    const res = await GET(new Request('http://test.local/api/my-assets/overview'))
    expect(res.status).toBe(200)
    const json: any = await res.json()
    const tasks = json.data.tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].task_id).toBe('task-dup')
  })
})
