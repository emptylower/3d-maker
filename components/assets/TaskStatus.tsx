"use client";
import React, { useEffect, useState } from 'react'

export default function TaskStatus({ taskId }: { taskId: string }) {
  const [state, setState] = useState<string>('processing')
  const [assetUuid, setAssetUuid] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchOnce = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/hitem3d/status?task_id=${encodeURIComponent(taskId)}`)
      if (res.ok) {
        const js = await res.json()
        if (js?.data?.state) setState(js.data.state)
      }
      const a = await fetch(`/api/assets/by-task?task_id=${encodeURIComponent(taskId)}`)
      if (a.ok) {
        const j = await a.json()
        if (j?.data?.asset_uuid) setAssetUuid(j.data.asset_uuid)
      }
      // 若任务已成功且仍未解析到资产，调用 finalize 兜底生成资产
      if (!assetUuid && state === 'success') {
        const f = await fetch('/api/hitem3d/finalize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
        })
        if (f.ok) {
          const jf = await f.json()
          if (jf?.data?.asset_uuid) setAssetUuid(jf.data.asset_uuid)
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
    </div>
  )
}
