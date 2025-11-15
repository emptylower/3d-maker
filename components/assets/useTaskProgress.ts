"use client"

import * as React from 'react'
import type { GenerationState } from '@/lib/progress'
import { mapTaskStateToProgress, smoothProgress } from '@/lib/progress'

export type UseTaskProgressOptions = {
  taskId: string
  initialState: GenerationState
  createdAtIso?: string
  updatedAtIso?: string
  disableAutoPolling?: boolean
  onAssetReady?: (asset: { uuid: string; task_id?: string | null; cover_url?: string }) => void
}

export type UseTaskProgressResult = {
  state: GenerationState
  progress: number
  loading: boolean
  error: string | null
  assetUuid: string | null
  vendorCoverUrl: string | null
  refreshOnce: () => Promise<void>
}

export function useTaskProgress(options: UseTaskProgressOptions): UseTaskProgressResult {
  const {
    taskId,
    initialState,
    createdAtIso,
    updatedAtIso,
    disableAutoPolling = false,
    onAssetReady,
  } = options

  const hasValidTask = !!taskId

  const createdAt = React.useMemo(
    () => (createdAtIso ? new Date(createdAtIso) : new Date()),
    [createdAtIso],
  )

  const [state, setState] = React.useState<GenerationState>(initialState)
  const [updatedAt, setUpdatedAt] = React.useState<Date>(
    updatedAtIso ? new Date(updatedAtIso) : createdAt,
  )
  const [assetUuid, setAssetUuid] = React.useState<string | null>(null)
  const [vendorCoverUrl, setVendorCoverUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState(() =>
    mapTaskStateToProgress({ state: initialState, createdAt, updatedAt, now: new Date() }),
  )

  const latestStateRef = React.useRef<GenerationState>(state)
  const latestAssetUuidRef = React.useRef<string | null>(assetUuid)

  React.useEffect(() => {
    latestStateRef.current = state
  }, [state])

  React.useEffect(() => {
    latestAssetUuidRef.current = assetUuid
  }, [assetUuid])

  // Local progress animation based on time, independent of network polling
  React.useEffect(() => {
    if (!hasValidTask) return
    let cancelled = false
    let timer: number | undefined

    const tick = () => {
      if (cancelled) return
      setProgress((prev) =>
        smoothProgress(
          prev,
          mapTaskStateToProgress({ state, createdAt, updatedAt, now: new Date() }),
        ),
      )
      timer = window.setTimeout(tick, 1000)
    }

    tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [hasValidTask, state, createdAt, updatedAt])

  const refreshOnce = React.useCallback(async () => {
    if (!hasValidTask) return
    try {
      setLoading(true)
      setError(null)

      let effectiveState: GenerationState = latestStateRef.current

      const statusRes = await fetch(`/api/hitem3d/status?task_id=${encodeURIComponent(taskId)}`)
      if (statusRes.ok) {
        const js: any = await statusRes.json()
        const s = js?.data?.state as GenerationState | undefined
        if (s) {
          setState(s)
          setUpdatedAt(new Date())
          effectiveState = s
        }
        if (js?.data?.cover_url) {
          setVendorCoverUrl(js.data.cover_url)
        }
      }

      const assetRes = await fetch(`/api/assets/by-task?task_id=${encodeURIComponent(taskId)}`)
      if (assetRes.ok) {
        const ja: any = await assetRes.json()
        const uuid: string | null = ja?.data?.asset_uuid || null
        if (uuid) {
          setAssetUuid(uuid)
          onAssetReady?.({ uuid, task_id: taskId, cover_url: vendorCoverUrl || undefined })
          return
        }
      }

      if (!latestAssetUuidRef.current && effectiveState === 'success') {
        const finalizeRes = await fetch('/api/hitem3d/finalize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
        })
        if (finalizeRes.ok) {
          const jf: any = await finalizeRes.json()
          const uuid: string | null = jf?.data?.asset_uuid || null
          if (uuid) {
            setAssetUuid(uuid)
            onAssetReady?.({ uuid, task_id: taskId, cover_url: vendorCoverUrl || undefined })
          } else if (jf?.message) {
            setError(String(jf.message))
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || '刷新失败')
    } finally {
      setLoading(false)
    }
  }, [hasValidTask, taskId, onAssetReady, vendorCoverUrl])

  // Auto polling: hit network at most once per minute, up to 1 hour from created_at
  React.useEffect(() => {
    if (!hasValidTask || disableAutoPolling) return
    let cancelled = false
    let timer: number | undefined
    const createdMs = createdAt.getTime()
    const maxSpanMs = 60 * 60 * 1000

    const loop = async () => {
      if (cancelled) return
      const now = Date.now()
      if (now - createdMs > maxSpanMs) return
      if (latestStateRef.current === 'failed') return
      if (latestStateRef.current === 'success' && latestAssetUuidRef.current) return

      await refreshOnce()
      if (cancelled) return
      timer = window.setTimeout(loop, 60 * 1000)
    }

    loop()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [hasValidTask, createdAt, disableAutoPolling, refreshOnce])

  return {
    state,
    progress,
    loading,
    error,
    assetUuid,
    vendorCoverUrl,
    refreshOnce,
  }
}

