import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock handleOrderSession to verify it is invoked (hoisted)
const hoisted = vi.hoisted(() => ({
  handleOrderSession: vi.fn(async () => ({})),
}))
vi.mock('@/services/order', () => ({
  handleOrderSession: hoisted.handleOrderSession,
}))

// Mock Stripe webhook construct
vi.mock('stripe', () => {
  class MockStripe {
    webhooks = {
      constructEventAsync: async (_body: any, _sign: any, _secret: any) => {
        return {
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_123',
              payment_status: 'paid',
              metadata: { order_no: 'o-1', user_uuid: 'u-123' },
            },
          },
        }
      },
    }
  }
  return { default: MockStripe }
})

import { POST } from '@/app/api/stripe-notify/route'

describe('api/stripe-notify', () => {
  beforeEach(() => {
    hoisted.handleOrderSession.mockClear()
    process.env.STRIPE_PRIVATE_KEY = 'sk_test_xxx'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_xxx'
  })

  it('handles checkout.session.completed and returns ok', async () => {
    const req = new Request('http://localhost/api/stripe-notify', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=abc' },
      body: 'raw-body',
    } as any)

    const res = await POST(req)
    expect(res.ok).toBe(true)
    const json = (await res.json()) as any
    expect(json.code).toBe(0)
    expect(hoisted.handleOrderSession).toHaveBeenCalledTimes(1)
    const session = hoisted.handleOrderSession.mock.calls[0][0]
    expect(session.payment_status).toBe('paid')
  })
})
