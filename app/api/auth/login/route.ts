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

    // If NextAuth returned a Response with cookies, forward them
    if (res instanceof Response && res.ok) {
      const out = Response.json({ ok: true }, { status: 200 })
      // Node/undici provides getSetCookie in newer versions
      // @ts-ignore
      const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : res.headers.get('set-cookie')
      if (Array.isArray(cookies)) {
        for (const c of cookies) out.headers.append('set-cookie', c)
      } else if (cookies) {
        out.headers.set('set-cookie', cookies as string)
      }
      return out
    }
    if (res && res.ok) return Response.json({ ok: true }, { status: 200 })

    return Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  } catch (e) {
    console.error('login error:', e)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
