import { describe, it, expect } from 'vitest'

import {
  VoucherBusinessCode,
  canRedeem,
  computeCreditExpiredAt,
} from '@/services/voucher'

describe('voucher logic unit tests', () => {
  const baseVoucher = {
    code: 'CODE123',
    type: 'credits',
    credits: 100,
    valid_months: 0,
    expires_at: undefined as string | undefined,
    max_redemptions: 1,
    used_count: 0,
    status: 'active',
    issued_by: 'admin@example.com',
    created_at: new Date().toISOString(),
  }

  it('returns OK when active and not expired and not used and user never redeemed', () => {
    const now = new Date('2025-01-01T00:00:00.000Z')
    const result = canRedeem({ ...baseVoucher }, false, now)
    expect(result).toBe(VoucherBusinessCode.OK)
  })

  it('returns DISABLED when status is disabled', () => {
    const now = new Date('2025-01-01T00:00:00.000Z')
    const result = canRedeem({ ...baseVoucher, status: 'disabled' }, false, now)
    expect(result).toBe(VoucherBusinessCode.DISABLED)
  })

  it('returns EXPIRED when expires_at is earlier than now', () => {
    const now = new Date('2025-01-02T00:00:00.000Z')
    const result = canRedeem({ ...baseVoucher, expires_at: '2025-01-01T00:00:00.000Z' }, false, now)
    expect(result).toBe(VoucherBusinessCode.EXPIRED)
  })

  it('returns MAX_REDEMPTIONS when used_count >= max_redemptions', () => {
    const now = new Date('2025-01-01T00:00:00.000Z')
    const result = canRedeem({ ...baseVoucher, max_redemptions: 1, used_count: 1 }, false, now)
    expect(result).toBe(VoucherBusinessCode.MAX_REDEMPTIONS)
  })

  it('returns ALREADY_REDEEMED when user has already redeemed', () => {
    const now = new Date('2025-01-01T00:00:00.000Z')
    const result = canRedeem({ ...baseVoucher }, true, now)
    expect(result).toBe(VoucherBusinessCode.ALREADY_REDEEMED)
  })

  it('computeCreditExpiredAt: returns empty string when valid_months=0 (no expiry)', () => {
    const ts = computeCreditExpiredAt(0, new Date('2025-01-01T00:00:00.000Z'))
    expect(ts).toBe('')
  })

  it('computeCreditExpiredAt: returns ISO when valid_months>0', () => {
    const ts = computeCreditExpiredAt(2, new Date('2025-01-15T00:00:00.000Z'))
    expect(typeof ts).toBe('string')
    expect(ts).toContain('2025-03')
  })
})

