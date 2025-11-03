import { insertOrder } from '@/models/order'
import { findUserByUuid } from '@/models/user'
import { getIsoTimestr } from '@/lib/time'

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
    const body = (await req.json()) as any
    const { order_no, user_uuid, credits = 400, amount = 1000, currency = 'usd', product_id = 'basic', product_name = 'Basic Plan', valid_months = 12 } = body || {}
    if (!order_no || !user_uuid) {
      return Response.json({ error: 'order_no and user_uuid required' }, { status: 400 })
    }
    const u = await findUserByUuid(user_uuid)
    const created_at = getIsoTimestr()
    const expiredAtDate = new Date()
    expiredAtDate.setMonth(expiredAtDate.getMonth() + Number(valid_months || 0))
    const expired_at = expiredAtDate.toISOString()
    const order = {
      order_no,
      created_at,
      user_uuid,
      user_email: u?.email || '',
      amount,
      interval: 'one-time',
      expired_at,
      status: 'created',
      credits,
      currency,
      product_id,
      product_name,
      valid_months,
    }
    await insertOrder(order as any)
    return Response.json({ ok: true, order_no })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}

