"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveCreditsCost } from "@/lib/credits/cost";
import { ImageUp } from "lucide-react";

type Model = 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
type Resolution = '512' | '1024' | '1536' | '1536pro'

const allModels: Model[] = ['hitem3dv1', 'hitem3dv1.5', 'scene-portraitv1.5']
const resByModel: Record<Model, Resolution[]> = {
  'hitem3dv1': ['512', '1024', '1536'],
  'hitem3dv1.5': ['512', '1024', '1536', '1536pro'],
  'scene-portraitv1.5': ['1536'],
}

// 兼容旧用法：允许以 props 方式覆盖 model/resolution，并固定纹理
export default function GenerateForm(props?: { __mode?: 'general' | 'portrait', __overrideModel?: Model, __overrideResolution?: Resolution, __fixedTexture?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const effectiveMode = props?.__mode || (props?.__overrideModel === 'scene-portraitv1.5' ? 'portrait' : 'general')
  const [model, setModel] = useState<Model>(props?.__overrideModel || (effectiveMode==='portrait' ? 'scene-portraitv1.5' : 'hitem3dv1.5'))
  const [resolution, setResolution] = useState<Resolution>((props?.__overrideResolution as Resolution) || '1536')
  const [withTexture, setWithTexture] = useState(!!props?.__fixedTexture)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")

  // Keep resolution in sync with model constraints
  const modelChoices = useMemo(() => (effectiveMode === 'portrait' ? (['scene-portraitv1.5'] as Model[]) : (['hitem3dv1','hitem3dv1.5'] as Model[])), [effectiveMode])
  const allowedRes = useMemo(() => resByModel[model], [model])
  if (!allowedRes.includes(resolution)) {
    // pick nearest sensible default
    setTimeout(() => setResolution(allowedRes[allowedRes.length - 1]), 0)
  }
  // Portrait模型固定纹理
  const textureEffective = model === 'scene-portraitv1.5' ? true : (props?.__fixedTexture ? true : withTexture)

  const cost = useMemo(() => resolveCreditsCost({ model, request_type: textureEffective ? 3 : 1, resolution }), [model, textureEffective, resolution])
  // Ensure portrait mode strictly uses scene-portraitv1.5 @ 1536 with texture on
  React.useEffect(() => {
    if (effectiveMode === 'portrait') {
      if (model !== 'scene-portraitv1.5') setModel('scene-portraitv1.5')
      if (resolution !== '1536') setResolution('1536')
      if (!withTexture) setWithTexture(true)
    }
  }, [effectiveMode])

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
      fd.append('request_type', String(textureEffective ? 3 : 1))
      fd.append('model', model)
      fd.append('resolution', resolution)
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
          {effectiveMode !== 'portrait' ? (
            <>
              <label className="inline-flex items-center gap-2">
                <span>模型</span>
                <select className="border rounded px-2 py-1" value={model} onChange={(e) => setModel(e.target.value as Model)}>
                  {modelChoices.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2">
                <span>分辨率</span>
                <select className="border rounded px-2 py-1" value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                  {allowedRes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="px-3 py-1 rounded bg-muted">人像 v1.5</div>
              <div className="px-3 py-1 rounded bg-muted">1536P³</div>
            </>
          )}
          {model !== 'scene-portraitv1.5' && !props?.__fixedTexture && effectiveMode!=='portrait' && (
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
