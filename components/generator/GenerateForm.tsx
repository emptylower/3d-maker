"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveCreditsCost } from "@/lib/credits/cost";
import { ImageUp } from "lucide-react";

function calcCost(withTexture: boolean) {
  return resolveCreditsCost({ model: "hitem3dv1.5", request_type: withTexture ? 3 : 1, resolution: "1536" })
}

// 兼容旧用法：允许以 props 方式覆盖 model/resolution，并固定纹理
export default function GenerateForm(props?: { __overrideModel?: 'hitem3dv1.5' | 'scene-portraitv1.5' | 'hitem3dv1', __overrideResolution?: '512' | '1024' | '1536' | '1536pro', __fixedTexture?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [withTexture, setWithTexture] = useState(!!props?.__fixedTexture)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  const cost = useMemo(() => calcCost(props?.__fixedTexture ? true : withTexture), [withTexture, props?.__fixedTexture])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    if (!file) return
    // 20MB 限制（对齐供应商文档）
    if (file.size > 20 * 1024 * 1024) {
      setMessage('单张图片大小不能超过20MB')
      return
    }
    try {
      setSubmitting(true)
      const fd = new FormData()
      fd.append('request_type', String((props?.__fixedTexture ? true : withTexture) ? 3 : 1))
      fd.append('model', props?.__overrideModel || 'hitem3dv1.5')
      fd.append('resolution', props?.__overrideResolution || '1536')
      fd.append('images', file, file.name || 'image.png')
      // 默认产出 OBJ（下载友好），后台会自动补齐其它格式（含 GLB 便于预览）
      fd.append('format', '1')
      const resp = await fetch('/api/hitem3d/submit', { method: 'POST', body: fd })
      if (resp.status === 401) {
        setMessage('请先登录后再提交')
        return
      }
      if (resp.status === 400) {
        const j = await resp.json().catch(() => null)
        setMessage(j?.message || '参数错误')
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
    <form onSubmit={onSubmit} className="grid gap-4" data-testid="generate-form">
      {/* 上传大卡 */}
      <div className="rounded-xl border bg-muted/20 p-6 h-64 flex flex-col items-center justify-center text-center">
        <ImageUp className="w-10 h-10 opacity-70 mb-3" />
        <div className="font-semibold mb-1">上传图片</div>
        <div className="text-xs opacity-70">支持格式：JPG/JPEG/PNG/Webp</div>
        <div className="text-xs opacity-70">最大大小：20MB</div>
        <div className="mt-3">
          <Label htmlFor="single-image-input" className="sr-only">上传图片</Label>
          <Input id="single-image-input" type="file" accept="image/*" onChange={(e) => setFile(e.currentTarget.files?.[0] || null)} />
        </div>
      </div>

      {/* 底部操作条 */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <div className="px-3 py-1 rounded bg-muted">{props?.__overrideModel === 'scene-portraitv1.5' ? '人像 v1.5' : 'v1.5'}</div>
          <div className="px-3 py-1 rounded bg-muted">{props?.__overrideResolution || '1536'}P³</div>
          {!props?.__fixedTexture && (
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="启用纹理"
                checked={withTexture}
                onChange={(e) => setWithTexture(e.currentTarget.checked)}
              />
              <span>纹理</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div aria-live="polite" data-testid="cost-hint" className="text-sm opacity-80">预计消耗 {cost} 积分</div>
          <Button type="submit" disabled={!file || submitting}>
            {submitting ? '提交中…' : '提交生成'}
          </Button>
        </div>
      </div>

      {message && (
        <div role="status" className="text-sm text-muted-foreground">{message}</div>
      )}
    </form>
  )
}
