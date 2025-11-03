import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock before importing routes
vi.mock('@/services/user', () => ({ getUserInfo: vi.fn() }))
vi.mock('@/models/publication', () => ({ offlinePublication: vi.fn() }))

import { POST as OFFLINE } from '@/app/api/publications/offline/route'
import { getUserInfo } from '@/services/user'
import { offlinePublication } from '@/models/publication'

describe('admin publications routes', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserInfo as any).mockReset()
    ;(offlinePublication as any).mockReset()
  })

  it('rejects non-admin on offline with 403', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'user@example.com' })
    const req = new Request('http://test.local/api/publications/offline', { method: 'POST', body: JSON.stringify({ id: 1 }) })
    const res = await OFFLINE(req as any)
    expect(res.status).toBe(403)
  })

  it('admin can offline publication', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'admin@example.com' })
    ;(offlinePublication as any).mockResolvedValue({ id: 1, status: 'offline' })
    const req = new Request('http://test.local/api/publications/offline', { method: 'POST', body: JSON.stringify({ id: 1 }) })
    const res = await OFFLINE(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.status).toBe('offline')
    expect((offlinePublication as any).mock.calls[0][0]).toBe(1)
  })
})

