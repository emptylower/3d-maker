import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock presigner before importing storage so dynamic import resolves to this
vi.mock('@aws-sdk/s3-request-presigner', () => {
  return {
    getSignedUrl: vi.fn(async (_client: any, _cmd: any, opts: any) => {
      const exp = opts?.expiresIn ?? 0
      return `https://signed.local/?exp=${exp}`
    }),
  }
})

import { newStorage } from '@/lib/storage'
import { getSignedUrl as mockedGetSignedUrl } from '@aws-sdk/s3-request-presigner'

describe('Storage.getSignedUrl TTL behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.STORAGE_ENDPOINT = 'https://r2.example.com'
    process.env.STORAGE_REGION = 'auto'
    process.env.STORAGE_ACCESS_KEY = 'AKIA_TEST'
    process.env.STORAGE_SECRET_KEY = 'SECRET'
    process.env.STORAGE_BUCKET = 'bkt'
    delete process.env.STORAGE_SIGN_URL_TTL_SEC
    ;(mockedGetSignedUrl as any).mockClear()
  })

  it('uses default TTL 300 seconds when not configured', async () => {
    const storage = newStorage()
    const res = await storage.getSignedUrl({ key: 'assets/u/a/file.glb' })
    expect(res.expiresIn).toBe(300)
    // ensure presigner received the same ttl
    const call = (mockedGetSignedUrl as any).mock.calls[0]
    expect(call[2].expiresIn).toBe(300)
    expect(typeof res.url).toBe('string')
  })

  it('reads TTL from STORAGE_SIGN_URL_TTL_SEC', async () => {
    process.env.STORAGE_SIGN_URL_TTL_SEC = '120'
    const storage = newStorage()
    const res = await storage.getSignedUrl({ key: 'assets/u/a/file.glb' })
    expect(res.expiresIn).toBe(120)
    const call = (mockedGetSignedUrl as any).mock.calls[0]
    expect(call[2].expiresIn).toBe(120)
  })

  it('prefers explicit expiresInSec over env', async () => {
    process.env.STORAGE_SIGN_URL_TTL_SEC = '120'
    const storage = newStorage()
    const res = await storage.getSignedUrl({ key: 'assets/u/a/file.glb', expiresInSec: 777 })
    expect(res.expiresIn).toBe(777)
    const call = (mockedGetSignedUrl as any).mock.calls[0]
    expect(call[2].expiresIn).toBe(777)
  })
})

