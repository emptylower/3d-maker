import { describe, it, expect } from 'vitest'
import { mapTaskStateToProgress } from '@/lib/progress'

const MIN = 0
const MAX = 100

describe('mapTaskStateToProgress', () => {
  const base = new Date('2025-01-01T00:00:00.000Z')

  it('created: starts around 5 and caps at 10', () => {
    const justCreated = mapTaskStateToProgress({
      state: 'created',
      createdAt: base,
      now: base,
    })
    expect(justCreated).toBeGreaterThanOrEqual(5)
    expect(justCreated).toBeLessThanOrEqual(10)

    const after2min = mapTaskStateToProgress({
      state: 'created',
      createdAt: base,
      now: new Date(base.getTime() + 2 * 60 * 1000),
    })
    expect(after2min).toBeGreaterThanOrEqual(9.9)
    expect(after2min).toBeLessThanOrEqual(10.1)

    const longAfter = mapTaskStateToProgress({
      state: 'created',
      createdAt: base,
      now: new Date(base.getTime() + 60 * 60 * 1000),
    })
    expect(longAfter).toBeGreaterThanOrEqual(9.9)
    expect(longAfter).toBeLessThanOrEqual(10.1)
  })

  it('queueing: progresses from ~10 to ~40 in 10 minutes', () => {
    const start = mapTaskStateToProgress({
      state: 'queueing',
      createdAt: base,
      updatedAt: base,
      now: base,
    })
    expect(start).toBeGreaterThanOrEqual(10)
    expect(start).toBeLessThanOrEqual(40)

    const mid = mapTaskStateToProgress({
      state: 'queueing',
      createdAt: base,
      updatedAt: base,
      now: new Date(base.getTime() + 5 * 60 * 1000),
    })
    expect(mid).toBeGreaterThan(start)
    expect(mid).toBeLessThan(40)

    const end = mapTaskStateToProgress({
      state: 'queueing',
      createdAt: base,
      updatedAt: base,
      now: new Date(base.getTime() + 10 * 60 * 1000),
    })
    expect(end).toBeGreaterThanOrEqual(39.9)
    expect(end).toBeLessThanOrEqual(40.1)
  })

  it('processing: progresses from ~40 to ~95 in 45 minutes', () => {
    const start = mapTaskStateToProgress({
      state: 'processing',
      createdAt: base,
      updatedAt: base,
      now: base,
    })
    expect(start).toBeGreaterThanOrEqual(40)
    expect(start).toBeLessThanOrEqual(95)

    const mid = mapTaskStateToProgress({
      state: 'processing',
      createdAt: base,
      updatedAt: base,
      now: new Date(base.getTime() + 20 * 60 * 1000),
    })
    expect(mid).toBeGreaterThan(start)
    expect(mid).toBeLessThan(95)

    const end = mapTaskStateToProgress({
      state: 'processing',
      createdAt: base,
      updatedAt: base,
      now: new Date(base.getTime() + 45 * 60 * 1000),
    })
    expect(end).toBeGreaterThanOrEqual(94.9)
    expect(end).toBeLessThanOrEqual(95.1)
  })

  it('success always maps to 100', () => {
    const p = mapTaskStateToProgress({
      state: 'success',
      createdAt: base,
      now: new Date(base.getTime() + 123456),
    })
    expect(p).toBe(100)
  })

  it('failed maps to 0', () => {
    const p = mapTaskStateToProgress({
      state: 'failed',
      createdAt: base,
      now: new Date(base.getTime() + 123456),
    })
    expect(p).toBe(0)
  })

  it('never goes outside 0-100', () => {
    const states: Array<'created' | 'queueing' | 'processing' | 'success' | 'failed'> = [
      'created',
      'queueing',
      'processing',
      'success',
      'failed',
    ]
    for (const state of states) {
      const p = mapTaskStateToProgress({
        state,
        createdAt: base,
        now: new Date(base.getTime() + 10 * 60 * 60 * 1000),
      })
      expect(p).toBeGreaterThanOrEqual(MIN)
      expect(p).toBeLessThanOrEqual(MAX)
    }
  })
})

