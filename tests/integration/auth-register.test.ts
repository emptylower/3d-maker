import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks
const findUserByEmail = vi.fn()
vi.mock('@/models/user', async () => ({
  findUserByEmail: (...args: any[]) => findUserByEmail(...args),
}))

const saveUser = vi.fn(async (u: any) => u)
vi.mock('@/services/user', async () => ({
  saveUser: (...args: any[]) => saveUser(...args),
}))

import { POST } from '@/app/api/auth/register/route'

// Mock NextAuth signIn to avoid loading full next-auth/next environment
const signIn = vi.fn(async () => ({ ok: true }))
vi.mock('@/auth', async () => ({
  signIn: (...args: any[]) => signIn(...args),
}))

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    findUserByEmail.mockReset()
    saveUser.mockReset()
  })

  it('rejects weak password (<8) with 400', async () => {
    findUserByEmail.mockResolvedValue(undefined)
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: '1234567' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/WEAK_PASSWORD/)
  })

  it('rejects duplicate email with 409', async () => {
    findUserByEmail.mockResolvedValue({ uuid: 'u1' })
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: '12345678' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/EMAIL_EXISTS/)
  })

  it('returns 201 and user_uuid on success', async () => {
    findUserByEmail.mockResolvedValue(undefined)
    saveUser.mockImplementation(async (u: any) => ({ ...u, uuid: 'u-new' }))
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: '12345678' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.user_uuid).toBe('u-new')
  })
})
