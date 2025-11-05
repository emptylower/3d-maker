import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/services/credit', () => ({
  getUserCredits: vi.fn(),
  decreaseCredits: vi.fn(),
  CreditsTransType: { Generate3D: 'generate_3d' },
}))
vi.mock('@/services/hitem3d', () => ({ submitTask: vi.fn() }))
vi.mock('@/models/generation-task', () => ({ insertGenerationTask: vi.fn() }))

import { POST } from '@/app/api/hitem3d/submit/route'
import { getUserUuid } from '@/services/user'
import { getUserCredits } from '@/services/credit'
import { submitTask } from '@/services/hitem3d'

describe('api/hitem3d/submit route - multi_images', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserUuid as any).mockReset()
    ;(getUserCredits as any).mockReset()
    ;(submitTask as any).mockReset()
  })

  it('forwards multi_images with order front/back/left/right', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 1000 })
    ;(submitTask as any).mockResolvedValue({ task_id: 'task-multi' })

    const fd = new FormData()
    fd.append('request_type', '3')
    fd.append('model', 'hitem3dv1.5')
    fd.append('resolution', '1536')
    // multi_images 顺序：前/后/左/右；未选择不占位
    const front = new Blob([new Uint8Array([1])], { type: 'image/jpeg' })
    const back = new Blob([new Uint8Array([2])], { type: 'image/jpeg' })
    const left = new Blob([new Uint8Array([3])], { type: 'image/jpeg' })
    fd.append('multi_images', front, 'front.jpg')
    fd.append('multi_images', back, 'back.jpg')
    fd.append('multi_images', left, 'left.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(200)

    const arg = (submitTask as any).mock.calls[0][0]
    expect(arg.images).toBeUndefined()
    expect(Array.isArray(arg.multi_images)).toBe(true)
    const names = arg.multi_images.map((x: any) => x.filename)
    expect(names).toEqual(['front.jpg', 'back.jpg', 'left.jpg'])
  })
})

