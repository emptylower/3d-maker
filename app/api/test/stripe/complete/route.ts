import Stripe from 'stripe'
import { handleOrderSession } from '@/services/order'

function checkAuth(req: Request) {
  const token = req.headers.get('x-e2e-test-token') || ''
  const expect = process.env.E2E_TEST_TOKEN || ''
  if (!expect || token !== expect) {
    return false
  }
  return true
}

export async function POST(req: Request) {
  try {
    if (!checkAuth(req)) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }

    const { order_no, paid_email } = (await req.json()) as {
      order_no: string
      paid_email?: string
    }
    if (!order_no) {
      return Response.json({ error: 'order_no required' }, { status: 400 })
    }

    // Build a minimal Checkout.Session payload
    const session: Partial<Stripe.Checkout.Session> = {
      id: 'cs_test_simulated',
      payment_status: 'paid',
      customer_details: paid_email ? { email: paid_email } as any : undefined,
      metadata: { order_no },
    }

    await handleOrderSession(session as Stripe.Checkout.Session)
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}

