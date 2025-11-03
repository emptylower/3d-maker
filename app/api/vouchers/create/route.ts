import { respData, respErr } from '@/lib/resp'
import { getUserInfo } from '@/services/user'
import { createVoucher } from '@/services/voucher'

function isAdmin(email?: string | null) {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!email) return false
  return admins.includes(email)
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo()
    const email = (user as any)?.email as string | undefined
    if (!isAdmin(email)) {
      return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const credits = Number(body?.credits)
    const valid_months = Number(body?.valid_months || 0)
    const max_redemptions = body?.max_redemptions != null ? Number(body.max_redemptions) : undefined
    const code = body?.code as string | undefined
    const expires_at = body?.expires_at as string | undefined

    if (!credits || credits <= 0) return respErr('invalid credits')
    if (Number.isNaN(valid_months) || valid_months < 0) return respErr('invalid valid_months')
    if (max_redemptions != null && (Number.isNaN(max_redemptions) || max_redemptions <= 0)) return respErr('invalid max_redemptions')

    const voucher = await createVoucher({ code, credits, valid_months, max_redemptions, expires_at, issued_by: email })
    return respData(voucher)
  } catch (e: any) {
    return respErr('create voucher failed: ' + (e?.message || 'unknown'))
  }
}

