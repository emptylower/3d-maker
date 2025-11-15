import { describe, it, expect, vi, beforeEach } from 'vitest'

// mocks must be declared before importing route
vi.mock('@/services/user', () => ({ getUserUuid: vi.fn(), getUserInfo: vi.fn(async () => ({ email: 'user@test.local' })) }))
vi.mock('@/services/credit', () => ({
  getUserCredits: vi.fn(),
  decreaseCredits: vi.fn(),
  CreditsTransType: { Generate3D: 'generate_3d' },
}))
vi.mock('@/services/hitem3d', () => ({ submitTask: vi.fn() }))
vi.mock('@/models/generation-task', () => ({ insertGenerationTask: vi.fn() }))
vi.mock('@/models/asset', () => ({ insertAsset: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))

import { POST } from '@/app/api/hitem3d/submit/route'
import { getUserUuid } from '@/services/user'
import { getUserCredits, decreaseCredits } from '@/services/credit'
import { submitTask } from '@/services/hitem3d'
import { insertGenerationTask } from '@/models/generation-task'
import { insertAsset } from '@/models/asset'
import { newStorage } from '@/lib/storage'

describe('api/hitem3d/submit route', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserUuid as any).mockReset()
    ;(getUserCredits as any).mockReset()
    ;(decreaseCredits as any).mockReset()
    ;(submitTask as any).mockReset()
    ;(insertGenerationTask as any).mockReset()
    ;(insertAsset as any).mockReset()
    ;(newStorage as any).mockReset()
  })

  it('returns 401 when not logged in', async () => {
    ;(getUserUuid as any).mockResolvedValue('')
    const fd = new FormData()
    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe(-1)
    expect(json.message).toBe('no auth')
  })

  it('returns code=2000 when insufficient credits', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 10 })
    const fd = new FormData()
    fd.append('request_type', '3')
    fd.append('model', 'hitem3dv1')
    fd.append('resolution', '512')
    fd.append('images', new Blob([new Uint8Array([1,2,3])], { type: 'image/jpeg' }), 'a.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(2000)
    expect((submitTask as any).mock.calls.length).toBe(0)
    expect((decreaseCredits as any).mock.calls.length).toBe(0)
    expect((insertGenerationTask as any).mock.calls.length).toBe(0)
  })

  it('returns 400 for invalid params (both images and multi_images)', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 100 })
    const fd = new FormData()
    fd.append('request_type', '1')
    fd.append('model', 'hitem3dv1.5')
    fd.append('resolution', '1024')
    fd.append('images', new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), 'a.jpg')
    fd.append('multi_images', new Blob([new Uint8Array([2])], { type: 'image/jpeg' }), 'b.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe(-1)
  })

  it('success path: submits, decreases credits, writes generation task, returns task_id', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 100 })
    ;(submitTask as any).mockResolvedValue({ task_id: 'task-123' })

    const uploadFile = vi.fn(async () => ({}))
    ;(newStorage as any).mockReturnValue({ uploadFile })

    const fd = new FormData()
    fd.append('request_type', '3')
    fd.append('model', 'hitem3dv1')
    fd.append('resolution', '512')
    fd.append('images', new Blob([new Uint8Array([1,2,3])], { type: 'image/jpeg' }), 'a.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.task_id).toBe('task-123')

    // cost: V1.0 | 512 | request_type=3 => texture yes => 15
    expect((decreaseCredits as any).mock.calls.length).toBe(1)
    const decArgs = (decreaseCredits as any).mock.calls[0][0]
    expect(decArgs.user_uuid).toBe('u-1')
    expect(decArgs.trans_type).toBe('generate_3d')
    expect(decArgs.credits).toBe(15)

    expect((insertGenerationTask as any).mock.calls.length).toBe(1)
    const taskArg = (insertGenerationTask as any).mock.calls[0][0]
    expect(taskArg.task_id).toBe('task-123')
    expect(taskArg.user_uuid).toBe('u-1')
    expect(taskArg.request_type).toBe(3)
    expect(taskArg.model_version).toBe('hitem3dv1')
    expect(taskArg.resolution).toBe('512')
    expect(taskArg.state).toBe('created')
    expect(taskArg.credits_charged).toBe(15)

    // input cover should be saved once using task_id
    expect(uploadFile).toHaveBeenCalledTimes(1)
    const uploadArgs = (uploadFile as any).mock.calls[0][0]
    expect(uploadArgs.key).toContain('assets/u-1/input-covers/task-123.')

    // placeholder asset should be inserted once, linked to task_id
    expect((insertAsset as any).mock.calls.length).toBe(1)
    const assetArg = (insertAsset as any).mock.calls[0][0]
    expect(assetArg.user_uuid).toBe('u-1')
    expect(assetArg.task_id).toBe('task-123')
    if (assetArg.cover_key) {
      expect(assetArg.cover_key).toContain('assets/u-1/input-covers/task-123.')
    }
  })

  it('forwards format=2 when provided', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 100 })
    ;(submitTask as any).mockResolvedValue({ task_id: 'task-456' })

    const fd = new FormData()
    fd.append('request_type', '1')
    fd.append('model', 'hitem3dv1.5')
    fd.append('resolution', '1536')
    fd.append('format', '2')
    fd.append('images', new Blob([new Uint8Array([9,9,9])], { type: 'image/jpeg' }), 'a.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const arg = (submitTask as any).mock.calls[0][0]
    expect(arg.format).toBe(2)
  })

  it('applies default face by resolution when not provided (1536 -> 2000000)', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-2')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 100 })
    ;(submitTask as any).mockResolvedValue({ task_id: 'task-xyz' })

    const fd = new FormData()
    fd.append('request_type', '1')
    fd.append('model', 'hitem3dv1.5')
    fd.append('resolution', '1536')
    fd.append('images', new Blob([new Uint8Array([9,9])], { type: 'image/jpeg' }), 'x.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)

    expect((submitTask as any).mock.calls.length).toBe(1)
    const arg = (submitTask as any).mock.calls[0][0]
    expect(arg.face).toBe(2000000)
    expect(arg.resolution).toBe('1536')
  })
})
