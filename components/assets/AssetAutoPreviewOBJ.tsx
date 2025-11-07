"use client";
import React, { useEffect, useState } from 'react'
import ViewerOBJ from './ViewerOBJ'

type FileItem = { name: string; url: string }

export default function AssetAutoPreviewOBJ({ assetUuid }: { assetUuid: string }) {
  const [files, setFiles] = useState<FileItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        setErr(null)
        // Hitting the files endpoint materializes OBJ/MTL/textures if missing
        const res = await fetch(`/api/assets/${assetUuid}/renditions/files?format=obj&debug=1`)
        if (!res.ok) throw new Error(`服务器暂不可用（${res.status}）`)
        const js = await res.json().catch(() => null)
        const list: FileItem[] = js?.data?.files || []
        if (!list.some(f => /\.obj$/i.test(f.name))) throw new Error('OBJ 文件尚未就绪')
        if (!cancelled) setFiles(list)
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || '预览数据获取失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [assetUuid])

  if (loading) return <div className="text-sm text-muted-foreground">加载预览中…</div>
  if (err) return <div className="text-sm text-muted-foreground">{err}</div>
  if (!files) return null
  return <ViewerOBJ files={files} />
}
