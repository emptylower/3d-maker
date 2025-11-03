import { describe, it, expect } from 'vitest'
import { genSalt, hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/password'

describe('password utils', () => {
  it('validatePasswordStrength: <8 -> false, >=8 -> true', () => {
    expect(validatePasswordStrength('1234567')).toBe(false)
    expect(validatePasswordStrength('12345678')).toBe(true)
    expect(validatePasswordStrength('a'.repeat(64))).toBe(true)
  })

  it('hash and verify success/failure', async () => {
    const password = 'Abcdefg8!'
    const salt = await genSalt()
    const hash = await hashPassword(password, salt)

    expect(await verifyPassword(password, salt, hash)).toBe(true)
    expect(await verifyPassword('wrong-pass', salt, hash)).toBe(false)
  })

  it('different salts produce different hashes', async () => {
    const password = 'Abcdefg8!'
    const salt1 = await genSalt()
    const hash1 = await hashPassword(password, salt1)
    const salt2 = await genSalt()
    const hash2 = await hashPassword(password, salt2)

    expect(hash1).not.toBe(hash2)
    expect(salt1).not.toBe(salt2)
  })
})

