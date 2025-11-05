import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/models/generation-task', () => ({ findGenerationTaskByTaskId: vi.fn(), updateGenerationTask: vi.fn() }))
vi.mock('@/services/hitem3d', () => ({ queryTask: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))
vi.mock('@/lib/storage-key', () => ({ buildAssetKey: vi.fn(() => 'k/a/file.glb') }))
vi.mock('@/lib/hash', () => ({ getUuid: vi.fn(() => 'a-new') }))
vi.mock('@/models/asset', () => ({ insertAsset: vi.fn(), findAssetByTaskId: vi.fn(), updateAssetByUuid: vi.fn() }))

import { POST } from '@/app/api/hitem3d/finalize/route'
import { getUserUuid } from '@/services/user'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'

describe('api/hitem3d/finalize route', () => {
  beforeEach(() => {
    ;(getUserUuid as any).mockReset()
    ;(findGenerationTaskByTaskId as any).mockReset()
    ;(queryTask as any).mockReset()
    ;(newStorage as any).mockReset()
  })

  it('creates asset when vendor state success', async () => {
    ;(getUserUuid as any).mockResolvedValue('u1')
    ;(findGenerationTaskByTaskId as any).mockResolvedValue({ task_id: 't1', user_uuid: 'u1' })
    ;(queryTask as any).mockResolvedValue({ task_id: 't1', state: 'success', cover_url: 'https://x/cover.webp', url: 'https://x/file.glb' })
    ;(newStorage as any).mockReturnValue({ downloadAndUpload: vi.fn(async () => {}) })
    const mods = await import('@/models/asset')
    ;(mods.findAssetByTaskId as any).mockResolvedValue(null)

    const req = new Request('http://test.local/api/hitem3d/finalize', { method: 'POST', body: JSON.stringify({ task_id: 't1' }) })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const js = await res.json()
    expect(js.code).toBe(0)
    expect(js.data.asset_uuid).toBe('a-new')
  })
})
