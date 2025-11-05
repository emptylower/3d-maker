"use client";
import React, { useEffect, useState } from 'react'
import ViewerGLB from './ViewerGLB'

export default function AssetAutoPreviewGLB({ assetUuid }: { assetUuid: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        // 1) 先尝试原始文件（不限格式），若是 glb 则直接预览
        const res0 = await fetch(`/api/assets/${assetUuid}/download?response=json`)
        if (res0.ok) {
          const j0 = await res0.json().catch(() => null)
          const u0 = j0?.data?.url as string | undefined
          if (u0) {
            const pathname = (() => { try { return new URL(u0).pathname } catch { return '' } })()
            const ext = pathname.split('.').pop()?.toLowerCase()
            if (ext === 'glb') {
              if (!cancelled) setUrl(u0)
              return
            }
          }
        }
        // 2) 再尝试 GLB 派生版本（rendition），若未生成则返回空
        const res = await fetch(`/api/assets/${assetUuid}/download?format=glb&response=json`)
        if (res.status === 409) { setUrl(null); return }
        if (!res.ok) { const js = await res.json().catch(() => null); throw new Error(js?.message || `HTTP ${res.status}`) }
        const js = await res.json(); const u = js?.data?.url as string
        if (!cancelled) setUrl(u || null)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'failed to load preview url')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [assetUuid])

  if (loading) return <div className="w-full h-56 bg-muted animate-pulse rounded" />
  if (error) return <div className="text-xs text-red-500">{error}</div>
  if (!url) return <div className="text-sm text-muted-foreground">GLB 还未生成或不可用。</div>
  return <ViewerGLB src={url} />
}
