"use client"

import * as React from 'react'
import type { TaskOverview } from '@/services/my-assets'
import type { GenerationState } from '@/lib/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ProgressFancy } from '@/components/ui/progress-fancy'
import { useTaskProgress } from '@/components/assets/useTaskProgress'

type TaskCardProps = {
  task: TaskOverview
  onAssetReady?: (asset: { uuid: string; task_id?: string | null; cover_url?: string }) => void
  disableAutoPolling?: boolean
}

export function TaskCard({ task, onAssetReady, disableAutoPolling = false }: TaskCardProps) {
  const {
    state,
    progress,
    loading,
    error,
    refreshOnce,
  } = useTaskProgress({
    taskId: task.task_id,
    initialState: task.state as GenerationState,
    createdAtIso: task.created_at,
    updatedAtIso: task.updated_at,
    disableAutoPolling,
    onAssetReady,
  })

  const title =
    state === 'failed'
      ? '生成失败'
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
              size="sm"
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
