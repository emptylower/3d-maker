import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be declared before importing the route
vi.mock('@/services/user', () => ({
  getUserUuid: vi.fn().mockResolvedValue('u-123'),
  getUserEmail: vi.fn().mockResolvedValue('test@example.com'),
}))

// Capture Stripe session.create options for assertions
let capturedOptions: any = null

vi.mock('stripe', () => {
  class MockStripe {
    checkout = {
      sessions: {
        create: async (options: any) => {
          capturedOptions = options
          return { id: 'cs_test_123' }
        },
      },
    }
  }
  return { default: MockStripe }
})

// Mock order model to avoid DB (use hoisted fns)
const hoisted = vi.hoisted(() => ({
  insertOrder: vi.fn(async () => ({})),
  updateOrderSession: vi.fn(async () => ({})),
}))
vi.mock('@/models/order', () => ({
  insertOrder: hoisted.insertOrder,
  updateOrderSession: hoisted.updateOrderSession,
}))

import { POST } from '@/app/api/checkout/route'

describe('api/checkout - one-time USD', () => {
  beforeEach(() => {
    capturedOptions = null
    hoisted.insertOrder.mockClear()
    hoisted.updateOrderSession.mockClear()
    process.env.STRIPE_PRIVATE_KEY = 'sk_test_xxx'
    process.env.STRIPE_PUBLIC_KEY = 'pk_test_xxx'
    process.env.NEXT_PUBLIC_WEB_URL = 'http://localhost:3000'
  })

  it('creates checkout session with correct params and disables promotions', async () => {
    const body = {
      credits: 400,
      currency: 'usd',
      amount: 1000, // $10.00
      interval: 'one-time',
      product_id: 'basic',
      product_name: 'Basic Plan',
      valid_months: 12,
    }
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const res = await POST(req)
    expect(res.ok).toBe(true)
    const json = (await res.json()) as any
    expect(json.code).toBe(0)
    expect(json.data.session_id).toBe('cs_test_123')
    expect(hoisted.insertOrder).toHaveBeenCalledTimes(1)
    expect(hoisted.updateOrderSession).toHaveBeenCalledTimes(1)

    // Stripe options assertions
    expect(capturedOptions).toBeTruthy()
    expect(capturedOptions.allow_promotion_codes).toBe(false)
    expect(capturedOptions.mode).toBe('payment')
    expect(capturedOptions.line_items[0].price_data.currency).toBe('usd')
  })

  it('rejects non one-time intervals', async () => {
    const body = {
      credits: 400,
      currency: 'usd',
      amount: 1000,
      interval: 'year',
      product_id: 'basic',
      product_name: 'Basic Plan',
      valid_months: 12,
    }
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await POST(req)
    const json = (await res.json()) as any
    expect(json.code).toBe(-1)
  })

  it('rejects non-USD currency', async () => {
    const body = {
      credits: 400,
      currency: 'cny',
      amount: 1000,
      interval: 'one-time',
      product_id: 'basic',
      product_name: 'Basic Plan',
      valid_months: 12,
    }
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const res = await POST(req)
    const json = (await res.json()) as any
    expect(json.code).toBe(-1)
  })
})
