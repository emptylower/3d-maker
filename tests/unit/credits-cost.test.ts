import { describe, it, expect } from 'vitest'
import { resolveCreditsCost } from '@/lib/credits/cost'

describe('credits cost resolver (docs/tech/config.md)', () => {
  it('V1.0 512 no texture -> 5', () => {
    expect(
      resolveCreditsCost({ model: 'hitem3dv1', request_type: 1, resolution: '512' }),
    ).toBe(5)
  })

  it('V1.0 1024 with texture -> 20', () => {
    expect(
      resolveCreditsCost({ model: 'hitem3dv1', request_type: 3, resolution: '1024' }),
    ).toBe(20)
  })

  it('V1.5 1536pro with texture -> 70', () => {
    expect(
      resolveCreditsCost({ model: 'hitem3dv1.5', request_type: 2, resolution: '1536pro' }),
    ).toBe(70)
  })

  it('Portrait 1536 no texture -> 40', () => {
    expect(
      resolveCreditsCost({ model: 'scene-portraitv1.5', request_type: 1, resolution: '1536' }),
    ).toBe(40)
  })

  it('undefined rule throws', () => {
    expect(() =>
      resolveCreditsCost({ model: 'scene-portraitv1.5', request_type: 1, resolution: '1024' }),
    ).toThrowError(/UNDEFINED_RULE/)
  })
})

