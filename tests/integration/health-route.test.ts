import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('api/health route', () => {
  it('returns ok true json', async () => {
    const res = await GET()
    expect(res.ok).toBe(true)
    const json = (await res.json()) as { ok: boolean }
    expect(json.ok).toBe(true)
  })
})

