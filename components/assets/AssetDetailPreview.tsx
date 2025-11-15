"use client";
import React, { useEffect, useState } from 'react'
import ViewerOBJ from './ViewerOBJ'
import ViewerSTL from './ViewerSTL'

type FileItem = { name: string; url: string }

type Mode = 'loading' | 'obj' | 'stl' | 'empty' | 'error'

export default function AssetDetailPreview({ assetUuid }: { assetUuid: string }) {
  const [mode, setMode] = useState<Mode>('loading')
  const [objFiles, setObjFiles] = useState<FileItem[] | null>(null)
  const [stlUrl, setStlUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const detect = async () => {
      try {
        setMode('loading')
        setError(null)
        setObjFiles(null)
        setStlUrl(null)

        // 优先尝试 OBJ（带纹理体验更好）
        try {
          const res = await fetch(`/api/assets/${assetUuid}/renditions/files?format=obj`)
          if (res.ok) {
            const js = await res.json().catch(() => null)
            const list: FileItem[] = js?.data?.files || []
            const hasObj = list.some((f) => /\.obj$/i.test(f.name))
            if (hasObj) {
              if (!cancelled) {
                setObjFiles(list)
                setMode('obj')
              }
              return
            }
          }
        } catch {
          // ignore and fall back to STL
        }

        // 回退到 STL：先看原始文件是否就是 STL，再看按需导出
        try {
          const res0 = await fetch(`/api/assets/${assetUuid}/download?response=json&disposition=inline`)
          if (res0.ok) {
            const j0 = await res0.json().catch(() => null)
            const u0 = j0?.data?.url as string | undefined
            if (u0) {
              const pathname = (() => {
                try {
                  return new URL(u0).pathname
                } catch {
                  return ''
                }
              })()
              const ext = pathname.split('.').pop()?.toLowerCase()
              if (ext === 'stl') {
                if (!cancelled) {
                  setStlUrl(u0)
                  setMode('stl')
                }
                return
              }
            }
          }

          const res = await fetch(
            `/api/assets/${assetUuid}/download?format=stl&response=json&disposition=inline`,
          )
          if (res.status === 409) {
            if (!cancelled) setMode('empty')
            return
          }
          if (!res.ok) {
            const js = await res.json().catch(() => null)
            throw new Error(js?.message || `HTTP ${res.status}`)
          }
          const js = await res.json().catch(() => null)
          const u = js?.data?.url as string | undefined
          if (u) {
            if (!cancelled) {
              setStlUrl(u)
              setMode('stl')
            }
            return
          }
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message || '预览加载失败')
            setMode('error')
          }
          return
        }

        if (!cancelled) setMode('empty')
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || '预览加载失败')
          setMode('error')
        }
      }
    }

    detect()
    return () => {
      cancelled = true
    }
  }, [assetUuid])

  const showSkeleton = mode === 'loading'

  return (
    <div className="w-full">
      <div className="relative w-full rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-900 to-slate-950 border border-slate-700/80 shadow-2xl overflow-hidden">
        <div className="aspect-video w-full">
          {mode === 'obj' && objFiles && (
            <ViewerOBJ assetId={assetUuid} files={objFiles} height={480} />
          )}
          {mode === 'stl' && stlUrl && <ViewerSTL src={stlUrl} height={480} />}
          {showSkeleton && (
            <div className="flex h-full w-full items-center justify-center bg-slate-900">
              <div className="w-3/5 max-w-md space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
                  <span>正在准备预览…</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-1/3 animate-[progress_1.4s_ease-in-out_infinite] rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
          )}
          {(mode === 'empty' || mode === 'error') && !showSkeleton && (
            <div className="flex h-full w-full items-center justify-center bg-slate-900">
              <div className="rounded-xl bg-slate-900/80 px-4 py-3 text-sm text-slate-300 shadow-lg backdrop-blur">
                {mode === 'empty'
                  ? '预览尚未就绪，请稍后在「我的资产」中重试。'
                  : error || '预览加载失败，请稍后重试。'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

