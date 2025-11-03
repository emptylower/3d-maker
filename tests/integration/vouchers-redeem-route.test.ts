import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock before importing route
vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/services/voucher', () => ({ redeemCode: vi.fn(), VoucherBusinessCode: { OK: 0, INVALID_CODE: 2101, EXPIRED: 2102, DISABLED: 2103, MAX_REDEMPTIONS: 2104, ALREADY_REDEEMED: 2105 } }))

import { POST } from '@/app/api/vouchers/redeem/route'
import { getUserUuid } from '@/services/user'
import { redeemCode, VoucherBusinessCode } from '@/services/voucher'

describe('api/vouchers/redeem route', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserUuid as any).mockReset()
    ;(redeemCode as any).mockReset()
  })

  it('returns 401 when not logged in', async () => {
    ;(getUserUuid as any).mockResolvedValue('')
    const req = new Request('http://test.local/api/vouchers/redeem', { method: 'POST', body: JSON.stringify({ code: 'ABC' }) })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.code).toBe(-1)
    expect(json.message).toBe('no auth')
  })

  it('returns code=0 when redeem success', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(redeemCode as any).mockResolvedValue({ code: VoucherBusinessCode.OK, message: 'ok', data: { credits: 100 } })
    const req = new Request('http://test.local/api/vouchers/redeem', { method: 'POST', body: JSON.stringify({ code: 'GOOD' }) })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.credits).toBe(100)
    expect((redeemCode as any).mock.calls[0][0]).toBe('u-1')
    expect((redeemCode as any).mock.calls[0][1]).toBe('GOOD')
  })

  it('returns business error code for invalid scenarios', async () => {
    ;(getUserUuid as any).mockResolvedValue('u-1')
    ;(redeemCode as any).mockResolvedValue({ code: VoucherBusinessCode.INVALID_CODE, message: 'INVALID_CODE' })
    const req = new Request('http://test.local/api/vouchers/redeem', { method: 'POST', body: JSON.stringify({ code: 'BAD' }) })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(2101)
  })
})

