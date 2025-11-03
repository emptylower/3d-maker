import { describe, it, expect } from 'vitest'

import { GET as StripeGet } from '@/app/api/stripe-notify/route'
import { GET as CallbackGet } from '@/app/api/hitem3d/callback/route'

describe('webhook health GET', () => {
  it('stripe-notify GET returns 200', async () => {
    const res = await StripeGet()
    expect(res.status).toBe(200)
  })
  it('hitem3d/callback GET returns 200', async () => {
    const res = await CallbackGet()
    expect(res.status).toBe(200)
  })
})

