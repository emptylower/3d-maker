"use client"

import * as React from 'react'
import type { TaskOverview } from '@/services/my-assets'
import type { GenerationState } from '@/lib/progress'
import { mapTaskStateToProgress, smoothProgress } from '@/lib/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressFancy } from '@/components/ui/progress-fancy'

type TaskCardProps = {
  task: TaskOverview
  onAssetReady?: (asset: { uuid: string; task_id?: string | null; cover_url?: string }) => void
  disableAutoPolling?: boolean
}

export function TaskCard({ task, onAssetReady, disableAutoPolling = false }: TaskCardProps) {
  const initialState = task.state as GenerationState
  const createdAt = React.useMemo(
    () => new Date(task.created_at || Date.now()),
    [task.created_at],
  )
  const [state, setState] = React.useState<GenerationState>(initialState)
  const [updatedAt, setUpdatedAt] = React.useState<Date>(
    task.updated_at ? new Date(task.updated_at) : createdAt,
  )
  const [assetUuid, setAssetUuid] = React.useState<string | null>(null)
  const [vendorCoverUrl, setVendorCoverUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState(() =>
    mapTaskStateToProgress({ state, createdAt, updatedAt, now: new Date() }),
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
  }, [state, createdAt, updatedAt])

  const refreshOnce = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let effectiveState: GenerationState = latestStateRef.current

      const statusRes = await fetch(`/api/hitem3d/status?task_id=${encodeURIComponent(task.task_id)}`)
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

      const assetRes = await fetch(`/api/assets/by-task?task_id=${encodeURIComponent(task.task_id)}`)
      if (assetRes.ok) {
        const ja: any = await assetRes.json()
        const uuid: string | null = ja?.data?.asset_uuid || null
        if (uuid) {
          setAssetUuid(uuid)
          onAssetReady?.({ uuid, task_id: task.task_id, cover_url: vendorCoverUrl || undefined })
          return
        }
      }

      if (!latestAssetUuidRef.current && effectiveState === 'success') {
        const finalizeRes = await fetch('/api/hitem3d/finalize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ task_id: task.task_id }),
        })
        if (finalizeRes.ok) {
          const jf: any = await finalizeRes.json()
          const uuid: string | null = jf?.data?.asset_uuid || null
          if (uuid) {
            setAssetUuid(uuid)
            onAssetReady?.({ uuid, task_id: task.task_id, cover_url: vendorCoverUrl || undefined })
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
  }, [task.task_id, onAssetReady, vendorCoverUrl])

  // Auto polling: hit network at most once per minute, up to 1 hour from created_at
  React.useEffect(() => {
    if (disableAutoPolling) return
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
  }, [createdAt, disableAutoPolling, refreshOnce])

  const title =
    state === 'failed'
      ? '生成失败'
      : state === 'success' && !assetUuid
        ? '生成成功 · 等待入库'
        : '模型生成中'

  const progressStatus: 'normal' | 'success' | 'failed' =
    state === 'failed' ? 'failed' : state === 'success' ? 'success' : 'normal'

  const badgeText = state === 'processing' || state === 'queueing' || state === 'created' ? '生成中' : state

  const progressLabel =
    state === 'failed'
      ? '生成失败，请重试或联系支持'
      : `预计进度：${Math.round(progress)}%`

  return (
    <Card
      className="relative overflow-hidden bg-gradient-to-b from-muted/40 to-background border-border/60"
      data-testid="task-card"
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">任务ID：{task.task_id}</div>
            <div className="text-sm font-medium">{title}</div>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
            {badgeText}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <span className="inline-block h-6 w-6 rounded-md border border-emerald-400/60 shadow-[0_0_18px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="flex flex-col text-xs text-muted-foreground">
            <span>
              模型：{task.model_version || '未知'} · 分辨率：{task.resolution || '未知'}
            </span>
            <span>创建时间：{task.created_at ? new Date(task.created_at).toLocaleString() : '-'}</span>
          </div>
        </div>

        <div className="space-y-2">
          <ProgressFancy value={progress} status={progressStatus} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progressLabel}</span>
            <Button
              variant="ghost"
              size="xs"
              className="h-6 px-2 text-xs"
              onClick={refreshOnce}
              disabled={loading}
            >
              刷新状态
            </Button>
          </div>
          {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
