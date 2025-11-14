"use client"

import * as React from 'react'
import type { TaskOverview, AssetOverview } from '@/services/my-assets'
import { TaskCard } from '@/components/assets/TaskCard'
import { AssetCard } from '@/components/assets/AssetCard'
import { cn } from '@/lib/utils'

type MyAssetsClientProps = {
  initialTasks: TaskOverview[]
  initialAssets: AssetOverview[]
  disableTaskAutoPolling?: boolean
}

export default function MyAssetsClient({
  initialTasks,
  initialAssets,
  disableTaskAutoPolling = false,
}: MyAssetsClientProps) {
  const [tab, setTab] = React.useState<'all' | 'public'>('all')
  const [tasks, setTasks] = React.useState<TaskOverview[]>(() =>
    (initialTasks || []).filter((t) => !t.has_asset),
  )
  const [assets, setAssets] = React.useState<AssetOverview[]>(() => initialAssets || [])

  const handleAssetReady = React.useCallback(
    (asset: { uuid: string; task_id?: string | null; cover_url?: string }) => {
      setTasks((prev) =>
        asset.task_id ? prev.filter((t) => t.task_id !== asset.task_id) : prev,
      )
      setAssets((prev) => {
        if (prev.some((a) => a.uuid === asset.uuid)) return prev
        const now = new Date().toISOString()
        const placeholder: AssetOverview = {
          uuid: asset.uuid,
          task_id: asset.task_id ?? undefined,
          title: '新生成资产',
          cover_url: asset.cover_url,
          created_at: now,
          is_public: false,
          slug: null,
        }
        return [placeholder, ...prev]
      })
    },
    [],
  )

  const publicAssets = React.useMemo(
    () => assets.filter((a) => a.is_public),
    [assets],
  )

  const hasNothing = tasks.length === 0 && assets.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">我的资产</h1>
          <p className="text-sm text-muted-foreground">
            浏览生成中的模型与已完成的 3D 资产，管理公开展示与下载。
          </p>
        </div>
        <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
              tab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground',
            )}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setTab('public')}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
              tab === 'public'
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground',
            )}
          >
            公开的资产
          </button>
        </div>
      </div>

      {hasNothing && (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          暂无生成记录或资产。前往“创作”页面上传图片开始生成你的第一个 3D 模型吧。
        </div>
      )}

      {!hasNothing && (
        <>
          {tab === 'all' && (
            <div className="space-y-6">
              {tasks.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    生成中的模型
                  </h2>
                  <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {tasks.map((t) => (
                      <TaskCard
                        key={t.task_id}
                        task={t}
                        onAssetReady={handleAssetReady}
                        disableAutoPolling={disableTaskAutoPolling}
                      />
                    ))}
                  </div>
                </section>
              )}

              {assets.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    已生成资产
                  </h2>
                  <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {assets.map((a) => (
                      <AssetCard key={a.uuid} asset={a} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === 'public' && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                已公开到广场的资产
              </h2>
              {publicAssets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  你还没有将资产公开到广场。在资产详情页中可以选择要发布的作品。
                </div>
              ) : (
                <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {publicAssets.map((a) => (
                    <AssetCard key={a.uuid} asset={a} />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
