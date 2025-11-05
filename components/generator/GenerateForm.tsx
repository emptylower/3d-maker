"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveCreditsCost } from "@/lib/credits/cost";

function calcCost(withTexture: boolean) {
  return resolveCreditsCost({ model: "hitem3dv1.5", request_type: withTexture ? 3 : 1, resolution: "1536" })
}

export default function GenerateForm() {
  const [file, setFile] = useState<File | null>(null)
  const [withTexture, setWithTexture] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const cost = useMemo(() => calcCost(withTexture), [withTexture])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    if (!file) return
    try {
      setSubmitting(true)
      const fd = new FormData()
      fd.append('request_type', String(withTexture ? 3 : 1))
      fd.append('model', 'hitem3dv1.5')
      fd.append('resolution', '1536')
      fd.append('images', file, file.name || 'image.png')
      // 默认预览产出 GLB，便于在线预览
      fd.append('format', '2')
      const resp = await fetch('/api/hitem3d/submit', { method: 'POST', body: fd })
      if (resp.status === 401) {
        setMessage('请先登录后再提交')
        return
      }
      if (!resp.ok) {
        setMessage('提交失败，请稍后再试')
        return
      }
      const json = await resp.json().catch(() => null)
      if (json?.code === 2000) {
        setMessage('积分不足，请先购买或降低配置')
        return
      }
      if (json?.code === 0) {
        setMessage('已提交，预览生成中。前往我的资产查看进度。')
        // 在产品里通常会跳转 /my-assets，这里保留提示即可
      } else {
        setMessage('提交失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6" data-testid="generate-form">
      <div className="grid gap-2">
        <Label htmlFor="image">上传图片</Label>
        <Input id="image" type="file" accept="image/*" onChange={(e) => setFile(e.currentTarget.files?.[0] || null)} />
      </div>

      <div className="grid gap-2">
        <Label>模型版本</Label>
        <div>
          <label className="inline-flex items-center gap-2 mr-4">
            <input type="radio" name="model" value="hitem3dv1.5" defaultChecked readOnly />
            <span>v1.5（默认）</span>
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>分辨率</Label>
        <div>
          <label className="inline-flex items-center gap-2 mr-4">
            <input type="radio" name="resolution" value="1536" defaultChecked readOnly />
            <span>1536（默认）</span>
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            aria-label="启用纹理"
            checked={withTexture}
            onChange={(e) => setWithTexture(e.currentTarget.checked)}
          />
          <span>启用纹理</span>
        </label>
      </div>

      <div aria-live="polite" data-testid="cost-hint">预计消耗 {cost} 积分</div>

      {message && (
        <div role="status" className="text-sm text-muted-foreground">{message}</div>
      )}

      <Button type="submit" disabled={!file || submitting}>
        {submitting ? '提交中…' : '提交生成'}
      </Button>
    </form>
  )
}
