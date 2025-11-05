"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Fmt = 'obj'|'glb'|'stl'|'fbx'

type State = 'idle'|'processing'|'ready'

export default function RenditionsPanel({ assetUuid }: { assetUuid: string }) {
  const formats: Fmt[] = ['obj','glb','stl','fbx']
  const [states, setStates] = useState<Record<Fmt, State>>({ obj: 'idle', glb: 'idle', stl: 'idle', fbx: 'idle' })
  const timers = useRef<Record<Fmt, any>>({} as any)

  const startPolling = useCallback((fmt: Fmt) => {
    const poll = async () => {
      try {
        const url = `/api/assets/${assetUuid}/renditions?format=${fmt}&with_texture=false`
        const res = await fetch(url)
        if (!res.ok) throw new Error('poll failed')
        const js = await res.json()
        const state = js?.data?.state as string
        if (state === 'success') {
          setStates(s => ({ ...s, [fmt]: 'ready' }))
          if (timers.current[fmt]) clearTimeout(timers.current[fmt])
          return
        }
        // continue polling
        timers.current[fmt] = setTimeout(poll, 300)
      } catch {
        timers.current[fmt] = setTimeout(poll, 800)
      }
    }
    poll()
  }, [assetUuid])

  const onClickGenerate = useCallback(async (fmt: Fmt) => {
    if (states[fmt] === 'processing') return
    setStates(s => ({ ...s, [fmt]: 'processing' }))
    const res = await fetch(`/api/assets/${assetUuid}/renditions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format: fmt, with_texture: false }),
    })
    if (!res.ok) {
      // revert
      setStates(s => ({ ...s, [fmt]: 'idle' }))
      return
    }
    startPolling(fmt)
  }, [assetUuid, states, startPolling])

  const onClickDownload = useCallback(async (fmt: Fmt) => {
    if (fmt === 'obj') {
      try {
        const res = await fetch(`/api/assets/${assetUuid}/renditions/files?format=obj`)
        if (res.ok) {
          const js = await res.json().catch(() => null)
          const files: Array<{ name: string; url: string }> = js?.data?.files || []
          // 在新窗口打开文件清单
          const w = window.open('', '_blank')
          if (w) {
            const links = files
              .map((f) => `<li><a href="${f.url}" download="${escapeHtml(f.name)}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a></li>`) 
              .join('')
            w.document.write(`<!doctype html><title>OBJ 文件清单</title><div style="font-family:system-ui,Arial;padding:16px"><h3>OBJ 文件清单</h3><ul>${links || '<li>暂无文件</li>'}</ul></div>`)
            w.document.close()
          }
          if (files.length > 0) return
        }
      } catch {}
      // 回退到单文件下载
      const url = `/api/assets/${assetUuid}/download?format=${fmt}&response=json`
      const res = await fetch(url)
      if (!res.ok) return
      try {
        const js = await res.json()
        const dl = js?.data?.url as string
        if (dl) window.location.href = dl
      } catch {}
      return
    }

    const url = `/api/assets/${assetUuid}/download?format=${fmt}&response=json`
    const res = await fetch(url)
    if (!res.ok) return
    try {
      const js = await res.json()
      const dl = js?.data?.url as string
      if (dl) window.location.href = dl
    } catch {}
  }, [assetUuid])

  function escapeHtml(s: string) {
    return s.replace(/[&<>"]+/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string))
  }

  useEffect(() => () => {
    for (const k of Object.keys(timers.current)) clearTimeout(timers.current[k as Fmt])
  }, [])

  return (
    <div className="grid gap-4" data-testid="renditions-panel">
      {formats.map(fmt => {
        const s = states[fmt]
        return (
          <div key={fmt} className="flex items-center gap-3" data-testid={`rendition-${fmt}`}>
            <div className="w-24 uppercase">{fmt}</div>
            {s === 'idle' && (
              <Button data-testid={`gen-${fmt}`} onClick={() => onClickGenerate(fmt)} aria-label={`生成 ${fmt.toUpperCase()}`}>生成</Button>
            )}
            {s === 'processing' && (
              <Button data-testid={`processing-${fmt}`} disabled aria-label={`生成中 ${fmt.toUpperCase()}`}>生成中…</Button>
            )}
            {s === 'ready' && (
              <Button data-testid={`download-${fmt}`} onClick={() => onClickDownload(fmt)} aria-label={`下载 ${fmt.toUpperCase()}`}>下载</Button>
            )}
          </div>
        )
      })}
      <div className="text-xs text-muted-foreground">仅本人可下载；下载链接为预签名，短期有效。</div>
    </div>
  )
}
