import { describe, it, expect, vi, beforeEach } from 'vitest'

const signIn = vi.fn()
vi.mock('@/auth', async () => ({
  signIn: (...args: any[]) => signIn(...args),
}))

import { POST } from '@/app/api/auth/login/route'

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    signIn.mockReset()
  })

  it('returns 200 on successful sign-in', async () => {
    signIn.mockResolvedValue({ ok: true })
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: '12345678' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({ redirect: false }))
  })

  it('returns 401 on invalid credentials', async () => {
    signIn.mockResolvedValue({ ok: false })
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/INVALID_CREDENTIALS/)
  })
})

