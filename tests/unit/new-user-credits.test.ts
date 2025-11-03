import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/models/user', async () => {
  return {
    findUserByEmail: vi.fn(async (_email: string) => undefined),
    insertUser: vi.fn(async (_user: any) => ({ id: 1 })),
  }
})

const increaseCreditsMock = vi.fn()
vi.mock('@/services/credit', async () => {
  const actual = await vi.importActual<any>('@/services/credit')
  return {
    ...actual,
    increaseCredits: (...args: any[]) => increaseCreditsMock(...args),
  }
})

// Avoid loading NextAuth in unit tests
vi.mock('@/auth', async () => ({
  auth: vi.fn(async () => ({})),
}))

describe('new user credits issue (7 days, 80 credits)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))
    increaseCreditsMock.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('saveUser should grant 80 credits with 7 days expiry on first create', async () => {
    const { saveUser } = await import('@/services/user')
    const user = {
      uuid: 'u-1',
      email: 'u1@example.com',
      nickname: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      signin_provider: 'credentials',
      signin_type: 'credentials',
    }

    await saveUser(user as any)

    expect(increaseCreditsMock).toHaveBeenCalledTimes(1)
    const call = increaseCreditsMock.mock.calls[0][0]
    expect(call.user_uuid).toBe('u-1')
    expect(call.credits).toBe(80)
    // expired_at should be exactly 7 days later in ISO format
    expect(call.expired_at.startsWith('2025-01-08T00:00:00.')).toBe(true)
  })
})
