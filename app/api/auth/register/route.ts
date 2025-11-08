import { NextRequest } from 'next/server'
import { findUserByEmail } from '@/models/user'
import { saveUser } from '@/services/user'
import { getIsoTimestr } from '@/lib/time'
import { getUuid } from '@/lib/hash'
import { genSalt, hashPassword, validatePasswordStrength } from '@/lib/password'
import { signIn } from '@/auth'
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

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return Response.json({ error: 'INVALID_EMAIL' }, { status: 400 })
    }
    if (!validatePasswordStrength(pwd)) {
      return Response.json({ error: 'WEAK_PASSWORD' }, { status: 400 })
    }

    const exists = await findUserByEmail(normEmail)
    if (exists) {
      return Response.json({ error: 'EMAIL_EXISTS' }, { status: 409 })
    }

    const salt = await genSalt()
    const pwdHash = await hashPassword(pwd, salt)

    const user = {
      uuid: getUuid(),
      email: normEmail,
      nickname: '',
      avatar_url: '',
      created_at: getIsoTimestr(),
      signin_type: 'credentials',
      signin_provider: 'credentials',
      password_hash: pwdHash,
      password_salt: salt,
    }

    const saved = await saveUser(user as any)

    // auto login via NextAuth credentials
    const before = await getCookieMap()

    const authRes: any = await signIn('credentials', {
      redirect: false,
      email: normEmail,
      password: pwd,
    })

    const out = Response.json({ user_uuid: saved.uuid }, { status: 201 })
    let cookieMutated = false
    if (authRes instanceof Response) {
      // forward Set-Cookie from NextAuth response when present
      // @ts-ignore
      const cookies = typeof authRes.headers.getSetCookie === 'function' ? authRes.headers.getSetCookie() : authRes.headers.get('set-cookie')
      if (Array.isArray(cookies) && cookies.length > 0) {
        for (const c of cookies) out.headers.append('set-cookie', c)
        cookieMutated = true
      } else if (cookies) {
        out.headers.set('set-cookie', cookies as string)
        cookieMutated = true
      }
    }
    if (!cookieMutated) {
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
          // rely on implicit cookie store mutation by Auth.js; nothing to append
          break
        }
      }
    }
    return out
  } catch (e) {
    console.error('register error:', e)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
