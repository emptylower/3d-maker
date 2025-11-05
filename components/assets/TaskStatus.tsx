"use client";
import React, { useEffect, useState } from 'react'

export default function TaskStatus({ taskId }: { taskId: string }) {
  const [state, setState] = useState<string>('processing')
  const [assetUuid, setAssetUuid] = useState<string | null>(null)

  useEffect(() => {
    let stop = false
    const poll = async () => {
      try {
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
      } catch {}
      if (!stop && state !== 'success' && state !== 'failed') {
        setTimeout(poll, 1500)
      }
    }
    poll()
    return () => { stop = true }
  }, [taskId])

  return (
    <div className="flex items-center gap-3 text-sm">
      <span>状态：{state}</span>
      {assetUuid && (
        <a className="underline" href={`/my-assets/${assetUuid}`}>查看详情</a>
      )}
    </div>
  )
}

