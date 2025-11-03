import { respJson } from '@/lib/resp'
import { getUserUuid } from '@/services/user'
import { redeemCode } from '@/services/voucher'

export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) {
      return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    }

    const { code } = await req.json()
    const result = await redeemCode(user_uuid, code || '')
    return respJson(result.code, result.message, result.data)
  } catch (e: any) {
    return respJson(-1, e?.message || 'redeem failed')
  }
}

