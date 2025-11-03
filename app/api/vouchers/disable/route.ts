import { respData, respErr } from '@/lib/resp'
import { getUserInfo } from '@/services/user'
import { disableVoucher } from '@/services/voucher'

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
    const code = (body?.code || '').trim()
    if (!code) return respErr('invalid code')

    const result = await disableVoucher(code)
    return respData(result)
  } catch (e: any) {
    return respErr('disable voucher failed: ' + (e?.message || 'unknown'))
  }
}

