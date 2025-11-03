import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks for models and services used by handleOrderSession (use hoisted fns)
const hoistedOrder = vi.hoisted(() => ({
  findOrderByOrderNo: vi.fn(),
  updateOrderStatus: vi.fn(async () => ({})),
}))
vi.mock('@/models/order', () => ({
  findOrderByOrderNo: hoistedOrder.findOrderByOrderNo,
  updateOrderStatus: hoistedOrder.updateOrderStatus,
}))

const hoistedAffiliate = vi.hoisted(() => ({
  updateAffiliateForOrder: vi.fn(async () => ({})),
}))
vi.mock('@/services/affiliate', () => ({
  updateAffiliateForOrder: hoistedAffiliate.updateAffiliateForOrder,
}))

const hoistedCredit = vi.hoisted(() => ({
  findCreditByOrderNo: vi.fn(),
  insertCredit: vi.fn(async () => ({})),
}))
vi.mock('@/models/credit', () => ({
  findCreditByOrderNo: hoistedCredit.findCreditByOrderNo,
  insertCredit: hoistedCredit.insertCredit,
}))

import { handleOrderSession } from '@/services/order'

describe('services/order.handleOrderSession', () => {
  beforeEach(() => {
    hoistedOrder.findOrderByOrderNo.mockReset()
    hoistedOrder.updateOrderStatus.mockClear()
    hoistedAffiliate.updateAffiliateForOrder.mockClear()
    hoistedCredit.findCreditByOrderNo.mockReset()
    hoistedCredit.insertCredit.mockClear()
  })

  it('updates order to paid and increases credits once (idempotent)', async () => {
    const order = {
      order_no: 'o-1',
      status: 'created',
      user_uuid: 'u-123',
      credits: 400,
      expired_at: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
    }

    // First call: order created, no existing credit
    hoistedOrder.findOrderByOrderNo.mockResolvedValueOnce(order)
    hoistedCredit.findCreditByOrderNo.mockResolvedValueOnce(undefined)

    const session: any = {
      payment_status: 'paid',
      metadata: { order_no: 'o-1' },
      customer_details: { email: 'test@example.com' },
    }

    await handleOrderSession(session)
    expect(hoistedOrder.updateOrderStatus).toHaveBeenCalledTimes(1)
    expect(hoistedCredit.insertCredit).toHaveBeenCalledTimes(1)

    // Second (duplicate) call: now order is already paid → no-op, no throw
    hoistedOrder.findOrderByOrderNo.mockResolvedValueOnce({ ...order, status: 'paid' })
    hoistedCredit.findCreditByOrderNo.mockResolvedValueOnce({ order_no: 'o-1' })

    await handleOrderSession(session)

    // Ensure no second credit record inserted
    expect(hoistedCredit.insertCredit).toHaveBeenCalledTimes(1)
  })
})
