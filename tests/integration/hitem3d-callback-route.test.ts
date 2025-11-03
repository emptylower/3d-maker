import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/models/generation-task', () => ({
  findGenerationTaskByTaskId: vi.fn(),
  updateGenerationTask: vi.fn(),
}))
vi.mock('@/models/asset', () => ({ insertAsset: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))
vi.mock('@/lib/hash', () => ({ getUuid: vi.fn(() => 'asset-1') }))
vi.mock('@/services/credit', () => ({ increaseCredits: vi.fn(), CreditsTransType: { SystemAdd: 'system_add' } }))

import { POST } from '@/app/api/hitem3d/callback/route'
import { findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { insertAsset } from '@/models/asset'
import { newStorage } from '@/lib/storage'
import { increaseCredits } from '@/services/credit'

describe('api/hitem3d/callback route', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(findGenerationTaskByTaskId as any).mockReset()
    ;(updateGenerationTask as any).mockReset()
    ;(insertAsset as any).mockReset()
    ;(newStorage as any).mockReset()
    ;(increaseCredits as any).mockReset()
  })

  it('handles success: uploads cover and file, creates asset, marks task success', async () => {
    ;(findGenerationTaskByTaskId as any).mockResolvedValue({
      task_id: 't-1',
      user_uuid: 'u-1',
      state: 'processing',
      credits_charged: 15,
      refunded: false,
    })
    const downloadAndUpload = vi.fn(async () => ({}))
    ;(newStorage as any).mockReturnValue({ downloadAndUpload })

    const body = {
      code: 200,
      data: {
        task_id: 't-1',
        state: 'success',
        cover_url: 'https://vendor.example.com/covers/0.webp',
        url: 'https://vendor.example.com/files/0.glb',
      },
      msg: 'success',
    }
    const req = new Request('http://test.local/api/hitem3d/callback', { method: 'POST', body: JSON.stringify(body) })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)

    expect(downloadAndUpload).toHaveBeenCalledTimes(2)
    const args1 = (downloadAndUpload as any).mock.calls[0][0]
    const args2 = (downloadAndUpload as any).mock.calls[1][0]
    expect(args1.url).toContain('/covers/0.webp')
    expect(args1.key).toBe('assets/u-1/asset-1/cover.webp')
    expect(args2.url).toContain('/files/0.glb')
    expect(args2.key).toBe('assets/u-1/asset-1/file.glb')

    expect((insertAsset as any).mock.calls.length).toBe(1)
    const asset = (insertAsset as any).mock.calls[0][0]
    expect(asset.uuid).toBe('asset-1')
    expect(asset.user_uuid).toBe('u-1')
    expect(asset.cover_key).toBe('assets/u-1/asset-1/cover.webp')
    expect(asset.file_key_full).toBe('assets/u-1/asset-1/file.glb')

    expect((updateGenerationTask as any).mock.calls.length).toBe(1)
    const patch = (updateGenerationTask as any).mock.calls[0][1]
    expect(patch.state).toBe('success')
    expect(increaseCredits as any).not.toHaveBeenCalled()
  })

  it('handles failed: refunds credits once and marks task failed idempotently', async () => {
    ;(findGenerationTaskByTaskId as any).mockResolvedValue({
      task_id: 't-2',
      user_uuid: 'u-1',
      state: 'processing',
      credits_charged: 20,
      refunded: false,
    })

    const body = { code: 50010001, data: { task_id: 't-2', state: 'failed' }, msg: 'generate failed' }
    const req1 = new Request('http://test.local/api/hitem3d/callback', { method: 'POST', body: JSON.stringify(body) })
    const res1 = await POST(req1 as any)
    expect(res1.status).toBe(200)
    expect((increaseCredits as any).mock.calls.length).toBe(1)
    expect((updateGenerationTask as any).mock.calls.length).toBe(1)

    // subsequent duplicate callback: task already marked failed+refunded
    ;(findGenerationTaskByTaskId as any).mockResolvedValue({
      task_id: 't-2',
      user_uuid: 'u-1',
      state: 'failed',
      credits_charged: 20,
      refunded: true,
    })
    const req2 = new Request('http://test.local/api/hitem3d/callback', { method: 'POST', body: JSON.stringify(body) })
    const res2 = await POST(req2 as any)
    expect(res2.status).toBe(200)
    // no extra refund
    expect((increaseCredits as any).mock.calls.length).toBe(1)
  })
})

