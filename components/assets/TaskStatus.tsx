"use client";
import React, { useEffect, useMemo, useState } from 'react'
import ViewerGLB from './ViewerGLB'

export default function TaskStatus({ taskId }: { taskId: string }) {
  const [state, setState] = useState<string>('processing')
  const [assetUuid, setAssetUuid] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [vendorUrl, setVendorUrl] = useState<string | null>(null)
  const vendorExt = useMemo(() => (vendorUrl ? vendorUrl.split('.').pop()?.toLowerCase() : ''), [vendorUrl])

  const fetchOnce = async () => {
    try {
      setLoading(true)
      setErr(null)
      let nextState = state
      const res = await fetch(`/api/hitem3d/status?task_id=${encodeURIComponent(taskId)}`)
      if (res.ok) {
        const js = await res.json()
        if (js?.data?.state) {
          nextState = js.data.state
          setState(nextState)
        }
        if (js?.data?.url) setVendorUrl(js.data.url)
      }
      let foundAsset: string | null = null
      const a = await fetch(`/api/assets/by-task?task_id=${encodeURIComponent(taskId)}`)
      if (a.ok) {
        const j = await a.json()
        if (j?.data?.asset_uuid) {
          foundAsset = j.data.asset_uuid
          setAssetUuid(foundAsset)
        }
      }
      // 若任务已成功且仍未解析到资产，调用 finalize 兜底生成资产（使用 nextState，避免竞态）
      if (!foundAsset && nextState === 'success') {
        const f = await fetch('/api/hitem3d/finalize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
        })
        if (f.ok) {
          const jf = await f.json()
          if (jf?.data?.asset_uuid) setAssetUuid(jf.data.asset_uuid)
        } else {
          const je = await f.json().catch(() => ({}))
          if (je?.message) setErr(String(je.message))
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let stop = false
    const loop = async () => {
      try {
        await fetchOnce()
      } catch {}
      // 继续轮询，直到出现资产 uuid
      if (!stop) {
        const final = state === 'failed' || (state === 'success' && !!assetUuid)
        if (!final) setTimeout(loop, 1500)
      }
    }
    loop()
    return () => { stop = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  return (
    <div className="flex items-center gap-3 text-sm">
      <span>状态：{state}</span>
      {assetUuid ? (
        <a className="underline" href={`/my-assets/${assetUuid}`}>查看详情</a>
      ) : (
        <button className="underline disabled:opacity-60" onClick={fetchOnce} disabled={loading}>
          {state === 'success' ? '等待生成文件… 点击刷新' : '刷新状态'}
        </button>
      )}
      {!assetUuid && state === 'success' && vendorUrl && (
        vendorExt === 'glb' ? (
          <div className="w-full mt-3">
            <ViewerGLB src={vendorUrl} />
            <div className="mt-1 text-xs text-muted-foreground">临时在线预览（供应商直链，约1小时有效）</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            供应商当前返回 {vendorExt?.toUpperCase()} 链接（可能缺少 .MTL/贴图），暂不支持在线预览。
            <a className="underline ml-2" href={vendorUrl} target="_blank" rel="noopener noreferrer">临时下载</a>
          </div>
        )
      )}
      {err && (
        <span className="text-red-500 text-xs">{err}</span>
      )}
    </div>
  )
}
