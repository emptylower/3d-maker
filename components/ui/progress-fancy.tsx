"use client"

import * as React from 'react'
import { cn } from '@/lib/utils'

type ProgressFancyProps = {
  value: number
  status?: 'normal' | 'success' | 'failed'
  className?: string
}

export function ProgressFancy({ value, status = 'normal', className }: ProgressFancyProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  const barClass =
    status === 'failed'
      ? 'from-red-500 to-red-400'
      : status === 'success'
        ? 'from-emerald-400 to-emerald-300'
        : 'from-emerald-400 via-emerald-300 to-sky-300'

  return (
    <div className={cn('w-full h-2 rounded-full bg-muted/60 overflow-hidden', className)} aria-hidden="true">
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out',
          barClass,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

