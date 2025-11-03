import crypto from 'node:crypto'

const SCRYPT_N = 16384 // 2^14
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

export async function genSalt(length = 16): Promise<string> {
  return crypto.randomBytes(length).toString('base64')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derivedKey) => {
      if (err) return reject(err)
      resolve(derivedKey.toString('base64'))
    })
  })
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const derived = await hashPassword(password, salt)
  // constant-time compare
  const a = Buffer.from(derived, 'base64')
  const b = Buffer.from(hash, 'base64')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function validatePasswordStrength(password: string): boolean {
  return typeof password === 'string' && password.length >= 8
}

