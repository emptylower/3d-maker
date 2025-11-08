import { auth } from '@/auth'

export async function GET() {
  if (process.env.DEBUG_AUTH !== 'true') {
    return Response.json({ error: 'DEBUG_DISABLED' }, { status: 403 })
  }
  try {
    const session = await auth()
    return Response.json({ session, sessionExists: !!session })
  } catch (e: any) {
    return Response.json({ error: 'INTERNAL_ERROR', message: e?.message }, { status: 500 })
  }
}

