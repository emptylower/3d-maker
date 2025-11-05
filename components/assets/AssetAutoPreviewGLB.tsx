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
        const res = await fetch(`/api/assets/${assetUuid}/download?format=glb&response=json`)
        if (res.status === 409) {
          // rendition not ready; keep empty
          setUrl(null)
          return
        }
        if (!res.ok) {
          const js = await res.json().catch(() => null)
          throw new Error(js?.message || `HTTP ${res.status}`)
        }
        const js = await res.json()
        const u = js?.data?.url as string
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

