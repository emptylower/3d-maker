import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserInfo: vi.fn() }))
vi.mock('@/models/generation-task', () => ({
  listSuccessTasksWithoutAsset: vi.fn(),
  findGenerationTaskByTaskId: vi.fn(),
  updateGenerationTask: vi.fn(),
}))
vi.mock('@/services/hitem3d', () => ({ queryTask: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))
vi.mock('@/models/asset', () => ({ insertAsset: vi.fn() }))
vi.mock('@/lib/storage-key', () => ({ buildAssetKey: vi.fn(({ filename }) => 'k/u/a/' + filename) }))
vi.mock('@/lib/hash', () => ({ getUuid: vi.fn(() => 'asset-1') }))

import { POST } from '@/app/api/hitem3d/finalize/batch/route'
import { getUserInfo } from '@/services/user'
import { listSuccessTasksWithoutAsset, findGenerationTaskByTaskId } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'

describe('api/hitem3d/finalize/batch route', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'admin@example.com' })
    ;(listSuccessTasksWithoutAsset as any).mockReset()
    ;(findGenerationTaskByTaskId as any).mockReset()
    ;(queryTask as any).mockReset()
    ;(newStorage as any).mockReset()
  })

  it('finalizes tasks from db list when no task_ids provided', async () => {
    ;(listSuccessTasksWithoutAsset as any).mockResolvedValue([{ task_id: 't1', user_uuid: 'u1' }])
    ;(findGenerationTaskByTaskId as any).mockResolvedValue({ task_id: 't1', user_uuid: 'u1' })
    ;(queryTask as any).mockResolvedValue({ state: 'success', cover_url: 'https://h/c.webp', url: 'https://h/f.glb' })
    ;(newStorage as any).mockReturnValue({ downloadAndUpload: vi.fn(async () => {}) })

    const req = new Request('http://localhost/api/hitem3d/finalize/batch', { method: 'POST', body: JSON.stringify({}) })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const js = await res.json()
    expect(js.code).toBe(0)
    expect(js.data.total).toBe(1)
    expect(js.data.processed[0].status).toBe('ok')
  })
})

