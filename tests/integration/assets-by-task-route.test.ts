import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/models/asset', () => ({ findAssetByTaskId: vi.fn() }))

import { GET } from '@/app/api/assets/by-task/route'
import { getUserUuid } from '@/services/user'
import { findAssetByTaskId } from '@/models/asset'

describe('api/assets/by-task route', () => {
  beforeEach(() => {
    ;(getUserUuid as any).mockReset()
    ;(findAssetByTaskId as any).mockReset()
  })

  it('returns asset uuid when owned', async () => {
    ;(getUserUuid as any).mockResolvedValue('u1')
    ;(findAssetByTaskId as any).mockResolvedValue({ uuid: 'a1', user_uuid: 'u1' })
    const res = await GET(new Request('http://test.local/api/assets/by-task?task_id=t1') as any)
    expect(res.status).toBe(200)
    const js = await res.json()
    expect(js.data.asset_uuid).toBe('a1')
  })
})

