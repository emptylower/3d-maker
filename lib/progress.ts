export type GenerationState = 'created' | 'queueing' | 'processing' | 'success' | 'failed'

export type ProgressInput = {
  state: GenerationState
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  now?: Date
}

function toMs(input?: string | Date | null): number | null {
  if (!input) return null
  if (input instanceof Date) return input.getTime()
  const t = Date.parse(input)
  return Number.isFinite(t) ? t : null
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min
  if (v > max) return max
  return v
}

// Map task state + timestamps to a target progress percentage [0, 100].
// This is an estimated, not vendor-provided, progress used for UI only.
export function mapTaskStateToProgress(input: ProgressInput): number {
  const now = (input.now ?? new Date()).getTime()
  const createdMs = toMs(input.createdAt) ?? now
  const updatedMs = toMs(input.updatedAt) ?? createdMs

  // time spent in current state
  const base = input.state === 'created' ? createdMs : updatedMs
  const elapsedMs = Math.max(0, now - base)

  const min = 0
  const max = 100

  switch (input.state) {
    case 'created': {
      // 0~2min: 5 -> 10
      const windowMs = 2 * 60 * 1000
      const ratio = clamp(elapsedMs / windowMs, 0, 1)
      const v = 5 + (10 - 5) * ratio
      return clamp(v, min, max)
    }
    case 'queueing': {
      // 0~10min: 10 -> 40
      const windowMs = 10 * 60 * 1000
      const ratio = clamp(elapsedMs / windowMs, 0, 1)
      const v = 10 + (40 - 10) * ratio
      return clamp(v, min, max)
    }
    case 'processing': {
      // 0~45min: 40 -> 95
      const windowMs = 45 * 60 * 1000
      const ratio = clamp(elapsedMs / windowMs, 0, 1)
      const v = 40 + (95 - 40) * ratio
      return clamp(v, min, max)
    }
    case 'success':
      return 100
    case 'failed':
      // 失败任务不再推进，进度用于 UI 展示，固定为 0
      return 0
    default:
      return 0
  }
}

// Smoothly move current progress towards target for nicer UI animation.
export function smoothProgress(current: number, target: number): number {
  if (!Number.isFinite(current)) current = 0
  if (!Number.isFinite(target)) target = 0

  const clampedCurrent = clamp(current, 0, 100)
  const clampedTarget = clamp(target, 0, 100)

  // If already very close, snap to target to avoid jitter.
  if (Math.abs(clampedTarget - clampedCurrent) < 0.5) {
    return clampedTarget
  }

  const alpha = 0.2
  const next = clampedCurrent + (clampedTarget - clampedCurrent) * alpha
  return clamp(next, 0, 100)
}

