import { describe, it, expect } from 'vitest'

describe('MSW intercepts hitem3D token request', () => {
  it('returns mocked token without network', async () => {
    const res = await fetch('https://api.hitem3d.ai/open-api/v1/get-token', {
      method: 'POST',
      headers: { Authorization: 'Basic abc' },
    })
    expect(res.ok).toBe(true)
    const json = (await res.json()) as { access_token: string }
    expect(json.access_token).toBe('mocked-token')
  })
})

