import { NextRequest } from 'next/server'
import { signIn, auth } from '@/auth'
import { cookies } from 'next/headers'

async function getCookieMap() {
  const store: any = await (cookies() as any)
  const list = typeof store?.getAll === 'function' ? store.getAll() : []
  return new Map<string, string>(list.map((c: any) => [c.name, c.value]))
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const normEmail = (email || '').toLowerCase().trim()
    const pwd = password || ''
    if (!normEmail || !pwd) {
      return Response.json({ error: 'INVALID_INPUT' }, { status: 400 })
    }

    // If already signed in (e.g., previous flow/One Tap), treat as success
    try {
      const sess = await auth()
      if (sess && sess.user) {
        return Response.json({ ok: true, alreadySignedIn: true }, { status: 200 })
      }
    } catch {}

    // Snapshot cookies before sign-in
    const before = await getCookieMap()

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

    // Detect session cookie mutation as success (Auth.js may set cookies() implicitly)
    if (!success) {
      const after = await getCookieMap()
      const sessionCookieNames = [
        'authjs.session-token',
        '__Secure-authjs.session-token',
        'next-auth.session-token',
        '__Secure-next-auth.session-token',
      ]
      for (const name of sessionCookieNames) {
        const b = before.get(name)
        const a = after.get(name)
        if (a && a !== b) {
          success = true
          break
        }
      }
    }

    if (success) return out

    // Fallback: after signIn, verify session again (in case environment sets cookie implicitly)
    try {
      const sess2 = await auth()
      if (sess2 && sess2.user) {
        return Response.json({ ok: true, sessionEstablished: true }, { status: 200 })
      }
    } catch {}

    return Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  } catch (e) {
    console.error('login error:', e)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
