import { describe, it, expect } from 'vitest'
import { smoothProgress } from '@/lib/progress'

describe('smoothProgress', () => {
  it('moves towards target without overshooting', () => {
    const start = 0
    const target = 100
    const next = smoothProgress(start, target)
    expect(next).toBeGreaterThan(start)
    expect(next).toBeLessThanOrEqual(target)
  })

  it('clamps to 0-100 range', () => {
    expect(smoothProgress(-10, 50)).toBeGreaterThanOrEqual(0)
    expect(smoothProgress(10, 150)).toBeLessThanOrEqual(100)
  })

  it('snaps to target when very close', () => {
    const almost = 99.8
    const snap = smoothProgress(almost, 100)
    expect(snap).toBe(100)
  })

  it('handles NaN and infinities gracefully', () => {
    // @ts-expect-error intentional bad input
    const v1 = smoothProgress(NaN, 50)
    expect(v1).toBeGreaterThanOrEqual(0)
    expect(v1).toBeLessThanOrEqual(100)

    const v2 = smoothProgress(50, Number.POSITIVE_INFINITY)
    expect(v2).toBeGreaterThanOrEqual(0)
    expect(v2).toBeLessThanOrEqual(100)
  })
})

