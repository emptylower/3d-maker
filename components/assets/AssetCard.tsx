"use client"

import * as React from 'react'
import type { AssetOverview } from '@/services/my-assets'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AssetCardProps = {
  asset: AssetOverview
}

export function AssetCard({ asset }: AssetCardProps) {
  const created = asset.created_at ? new Date(asset.created_at) : null

  return (
    <Card
      className="group overflow-hidden bg-gradient-to-b from-muted/40 to-background border-border/60"
      data-testid="asset-card"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            我的资产
          </span>
          {asset.is_public && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
              已公开
            </span>
          )}
        </div>

        <div className="relative overflow-hidden rounded-xl bg-black/70 aspect-square">
          {asset.cover_url ? (
            <img
              src={asset.cover_url}
              alt={asset.title || '3D asset'}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              暂无封面
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium truncate">
            {asset.title || '未命名资产'}
          </div>
          <div className="text-xs text-muted-foreground">
            {created ? created.toLocaleString() : '创建时间未知'}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-7 px-3 text-xs">
              <a href={`/my-assets/${asset.uuid}`}>查看资产</a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-7 px-3 text-xs">
              <a href={`/api/assets/${asset.uuid}/download`}>下载</a>
            </Button>
          </div>
          {asset.slug && (
            <a
              href={`/plaza/${asset.slug}`}
              className={cn(
                'text-xs text-muted-foreground underline-offset-2 hover:underline',
                'hover:text-emerald-300 transition-colors',
              )}
            >
              在广场查看
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

