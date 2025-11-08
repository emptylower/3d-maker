import { NextRequest } from 'next/server'
import { signIn } from '@/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const normEmail = (email || '').toLowerCase().trim()
    const pwd = password || ''
    if (!normEmail || !pwd) {
      return Response.json({ error: 'INVALID_INPUT' }, { status: 400 })
    }

    // Delegate to NextAuth credentials provider
    const res: any = await signIn('credentials', {
      redirect: false,
      email: normEmail,
      password: pwd,
    })

    // Normalize success across different NextAuth responses
    let success = false
    const out = Response.json({ ok: true }, { status: 200 })
    if (res instanceof Response) {
      // Forward Set-Cookie if present
      // @ts-ignore
      const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : res.headers.get('set-cookie')
      if (Array.isArray(cookies) && cookies.length > 0) {
        for (const c of cookies) out.headers.append('set-cookie', c)
        success = true
      } else if (cookies) {
        out.headers.set('set-cookie', cookies as string)
        success = true
      }
      // Some adapters may return 302 (redirect) even when redirect:false; treat 2xx/3xx as success
      if (res.ok || (res.status >= 300 && res.status < 400)) {
        success = true
      }
    } else if (res && typeof res.ok === 'boolean') {
      success = !!res.ok
    }

    if (success) return out

    return Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  } catch (e) {
    console.error('login error:', e)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
