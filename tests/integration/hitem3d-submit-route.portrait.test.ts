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
import { getUserCredits, decreaseCredits } from '@/services/credit'
import { submitTask } from '@/services/hitem3d'

describe('api/hitem3d/submit route - portrait model', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserUuid as any).mockReset()
    ;(getUserCredits as any).mockReset()
    ;(decreaseCredits as any).mockReset()
    ;(submitTask as any).mockReset()
  })

  it('success with scene-portraitv1.5 + 1536 + request_type=3 charges 50 credits', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-portrait')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 1000 })
    ;(submitTask as any).mockResolvedValue({ task_id: 't-portrait' })

    const fd = new FormData()
    fd.append('request_type', '3')
    fd.append('model', 'scene-portraitv1.5')
    fd.append('resolution', '1536')
    fd.append('images', new Blob([new Uint8Array([1,2])], { type: 'image/jpeg' }), 'f.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    expect((decreaseCredits as any).mock.calls.length).toBe(1)
    const dec = (decreaseCredits as any).mock.calls[0][0]
    expect(dec.credits).toBe(50)
  })

  it('invalid resolution for portrait maps to 400 with message', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-portrait')
    ;(getUserCredits as any).mockResolvedValue({ left_credits: 1000 })

    const fd = new FormData()
    fd.append('request_type', '1')
    fd.append('model', 'scene-portraitv1.5')
    fd.append('resolution', '1024') // invalid
    fd.append('images', new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), 'a.jpg')

    const req = new Request('http://test.local/api/hitem3d/submit', { method: 'POST', body: fd })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.message).toMatch(/portrait model only supports 1536|UNDEFINED_RULE/i)
  })
})

