import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/models/db', () => ({ getSupabaseClient: vi.fn() }))
import { getSupabaseClient } from '@/models/db'
import { findAssetByUuid, insertAsset } from '@/models/asset'

function mockFromChain(handlers: any) {
  return {
    from: vi.fn().mockReturnValue(handlers),
  }
}

describe('models/asset', () => {
  beforeEach(() => {
    ;(getSupabaseClient as any).mockReset()
  })

  it('findAssetByUuid returns asset or null', async () => {
    const okHandlers = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn(async () => ({ data: { uuid: 'a-1' }, error: null })) }) }) }),
    }
    ;(getSupabaseClient as any).mockReturnValueOnce({ from: vi.fn().mockReturnValue(okHandlers) })
    const got = await findAssetByUuid('a-1')
    expect(got?.uuid).toBe('a-1')

    const errHandlers = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn(async () => ({ data: null, error: new Error('x') })) }) }) }),
    }
    ;(getSupabaseClient as any).mockReturnValueOnce({ from: vi.fn().mockReturnValue(errHandlers) })
    const miss = await findAssetByUuid('missing')
    expect(miss).toBeNull()
  })

  it('insertAsset inserts without error', async () => {
    const handlers = { insert: vi.fn(async () => ({ error: null })) }
    ;(getSupabaseClient as any).mockReturnValue(mockFromChain(handlers))
    await insertAsset({ uuid: 'a-1', user_uuid: 'u-1', status: 'active', created_at: new Date().toISOString() })
    expect(handlers.insert).toHaveBeenCalled()
  })
})

