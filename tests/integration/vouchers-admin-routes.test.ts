import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock before importing routes
vi.mock('@/services/user', () => ({ getUserInfo: vi.fn() }))
vi.mock('@/services/voucher', () => ({ createVoucher: vi.fn(), disableVoucher: vi.fn() }))

import { POST as CREATE } from '@/app/api/vouchers/create/route'
import { POST as DISABLE } from '@/app/api/vouchers/disable/route'
import { getUserInfo } from '@/services/user'
import { createVoucher, disableVoucher } from '@/services/voucher'

describe('admin vouchers routes', () => {
  beforeEach(() => {
    vi.resetModules()
    ;(getUserInfo as any).mockReset()
    ;(createVoucher as any).mockReset()
    ;(disableVoucher as any).mockReset()
  })

  it('rejects non-admin on create with 403', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'user@example.com' })
    const req = new Request('http://test.local/api/vouchers/create', { method: 'POST', body: JSON.stringify({ credits: 100, valid_months: 0 }) })
    const res = await CREATE(req as any)
    expect(res.status).toBe(403)
  })

  it('admin can create voucher', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'admin@example.com' })
    ;(createVoucher as any).mockResolvedValue({ code: 'ABCD1234', credits: 100, valid_months: 0, status: 'active' })
    const req = new Request('http://test.local/api/vouchers/create', { method: 'POST', body: JSON.stringify({ credits: 100, valid_months: 0 }) })
    const res = await CREATE(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.code).toBe('ABCD1234')
    expect((createVoucher as any).mock.calls[0][0]).toMatchObject({ credits: 100, valid_months: 0 })
  })

  it('rejects non-admin on disable with 403', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'user@example.com' })
    const req = new Request('http://test.local/api/vouchers/disable', { method: 'POST', body: JSON.stringify({ code: 'ABCD' }) })
    const res = await DISABLE(req as any)
    expect(res.status).toBe(403)
  })

  it('admin can disable voucher', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    ;(getUserInfo as any).mockResolvedValue({ email: 'admin@example.com' })
    ;(disableVoucher as any).mockResolvedValue({ code: 'ABCD', status: 'disabled' })
    const req = new Request('http://test.local/api/vouchers/disable', { method: 'POST', body: JSON.stringify({ code: 'ABCD' }) })
    const res = await DISABLE(req as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.status).toBe('disabled')
    expect((disableVoucher as any).mock.calls[0][0]).toBe('ABCD')
  })
})

