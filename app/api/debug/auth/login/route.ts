import { NextRequest } from 'next/server'
import { signIn } from '@/auth'

function maskEmail(e: string) {
  const [name, domain] = (e || '').split('@')
  if (!domain) return '***'
  return `${name?.slice(0, 1) || ''}***@***.${domain.split('.').pop()}`
}

export async function POST(req: NextRequest) {
  if (process.env.DEBUG_AUTH !== 'true') {
    return Response.json({ error: 'DEBUG_DISABLED' }, { status: 403 })
  }
  try {
    const { email, password } = await req.json()
    const normEmail = (email || '').toLowerCase().trim()
    const pwd = password || ''

    const debug: any = {
      input: { emailMasked: maskEmail(normEmail), pwdLen: pwd.length },
      signIn: {},
      forwarded: { setCookieCount: 0 },
      treatedSuccess: false,
    }

    const res: any = await signIn('credentials', {
      redirect: false,
      email: normEmail,
      password: pwd,
    })

    let isResp = res instanceof Response
    debug.signIn.isResponse = isResp

    const out = Response.json({ ok: true, debug }, { status: 200 })

    if (isResp) {
      debug.signIn.status = res.status
      debug.signIn.ok = res.ok
      // @ts-ignore
      const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : res.headers.get('set-cookie')
      if (Array.isArray(cookies)) {
        debug.signIn.setCookieCount = cookies.length
        for (const c of cookies) out.headers.append('set-cookie', c)
        debug.forwarded.setCookieCount = cookies.length
      } else if (cookies) {
        debug.signIn.setCookieCount = 1
        out.headers.set('set-cookie', cookies as string)
        debug.forwarded.setCookieCount = 1
      } else {
        debug.signIn.setCookieCount = 0
      }
      if (res.ok || (res.status >= 300 && res.status < 400)) {
        debug.treatedSuccess = true
      }
    } else if (res && typeof res.ok === 'boolean') {
      debug.signIn.ok = !!res.ok
      debug.treatedSuccess = !!res.ok
    } else {
      debug.signIn.ok = null
      debug.treatedSuccess = false
    }

    if (debug.treatedSuccess) return out

    return Response.json({ ok: false, debug, error: 'INVALID_CREDENTIALS_TREATED' }, { status: 401 })
  } catch (e: any) {
    return Response.json({ error: 'INTERNAL_ERROR', message: e?.message }, { status: 500 })
  }
}

