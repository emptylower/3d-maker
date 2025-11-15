"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
import { resolveCreditsCost } from "@/lib/credits/cost";
import { ImageUp, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type Model = 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
type Resolution = '512' | '1024' | '1536' | '1536pro'

const allModels: Model[] = ['hitem3dv1', 'hitem3dv1.5', 'scene-portraitv1.5']
const resByModel: Record<Model, Resolution[]> = {
  'hitem3dv1': ['512', '1024', '1536'],
  'hitem3dv1.5': ['512', '1024', '1536', '1536pro'],
  'scene-portraitv1.5': ['1536'],
}

// 兼容旧用法：允许以 props 方式覆盖 model/resolution，并固定纹理
export default function GenerateForm(props?: { fill?: boolean, __mode?: 'general' | 'portrait', __overrideModel?: Model, __overrideResolution?: Resolution, __fixedTexture?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const effectiveMode = props?.__mode || (props?.__overrideModel === 'scene-portraitv1.5' ? 'portrait' : 'general')
  const [model, setModel] = useState<Model>(props?.__overrideModel || (effectiveMode==='portrait' ? 'scene-portraitv1.5' : 'hitem3dv1.5'))
  const [resolution, setResolution] = useState<Resolution>((props?.__overrideResolution as Resolution) || '1536')
  const [withTexture, setWithTexture] = useState(!!props?.__fixedTexture)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const [leftCredits, setLeftCredits] = useState<number | null>(null)
  const [successTaskId, setSuccessTaskId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
      const requestType = textureEffective ? 3 : 1
      fd.append('request_type', String(requestType))
      fd.append('model', model)
      fd.append('resolution', resolution)
      fd.append('images', file, file.name || 'image.png')
      // 默认格式：含纹理使用 OBJ(1)，纯几何使用 STL(3)，后台会自动补齐其它格式（含 GLB 便于预览）
      const format = requestType === 1 ? 3 : 1
      fd.append('format', String(format))
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
        if (json?.data?.task_id) setSuccessTaskId(String(json.data.task_id))
        // 在产品里通常会跳转 /my-assets，这里保留提示即可
      } else {
        setMessage('提交失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    // 获取用户剩余积分
    const fetchLeft = async () => {
      try {
        const r = await fetch('/api/my-credits/left')
        if (!r.ok) return
        const j = await r.json().catch(() => null)
        const left = j?.data?.left_credits
        if (typeof left === 'number') setLeftCredits(left)
      } catch {}
    }
    fetchLeft()
  }, [])

  // preview url lifecycle
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const fill = !!props?.fill
  return (
    <form onSubmit={onSubmit} className={`grid gap-4 ${fill ? 'grid-rows-[1fr_auto_auto] min-h-0 h-full' : ''}`} data-testid="generate-form">
      {/* 上传大卡（可预览/拖拽替换） */}
      <div
        className={`rounded-2xl border bg-muted/20 relative overflow-hidden group ${fill ? 'flex-1 min-h-[24rem]' : 'h-72'}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f) }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        aria-label="上传或替换图片"
      >
        {previewUrl ? (
          <>
            <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${previewUrl})` }} />
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-full bg-background/70 p-1.5 border hover:bg-background"
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              aria-label="移除图片"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30 text-foreground">
              <div className="flex items-center gap-2 text-sm">
                <ImageUp className="w-5 h-5" /> 点击或拖拽替换
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <ImageUp className="w-10 h-10 opacity-70 mb-3" />
            <div className="font-semibold mb-1">上传图片</div>
            <div className="text-xs opacity-70">支持 JPG/JPEG/PNG/WebP，单张 ≤ 20MB</div>
          </div>
        )}
        <input ref={fileInputRef} className="hidden" type="file" accept="image/*" onChange={(e) => setFile(e.currentTarget.files?.[0] || null)} />
      </div>

      {/* 底部操作条 */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          {effectiveMode !== 'portrait' ? (
            <>
              {/* 模型：卡片选项 */}
              <div className="flex items-center gap-2">
                <span className="opacity-70">模型</span>
                <div className="flex items-center gap-2">
                  {modelChoices.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className={`px-3 py-1.5 rounded-xl border ${m===model?'border-primary bg-background shadow':'opacity-70 hover:opacity-100'}`}
                    >
                      {modelLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
              {/* 分辨率：卡片选项 */}
              <div className="flex items-center gap-2">
                <span className="opacity-70">分辨率</span>
                <div className="flex items-center gap-2">
                  {allowedRes.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      className={`px-3 py-1.5 rounded-xl border ${r===resolution?'border-primary bg-background shadow':'opacity-70 hover:opacity-100'}`}
                    >
                      {r === '1536pro' ? '1536P³pro' : r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="px-3 py-1 rounded bg-muted">人像 v1.5</div>
              <div className="px-3 py-1 rounded bg-muted">1536P³</div>
            </>
          )}
          {model !== 'scene-portraitv1.5' && !props?.__fixedTexture && effectiveMode!=='portrait' && (
            <label className="inline-flex items-center gap-2">
              <span>纹理</span>
              <Switch checked={withTexture} onCheckedChange={(v) => setWithTexture(!!v)} />
            </label>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div aria-live="polite" data-testid="cost-hint" className="text-sm opacity-80">
            预计消耗 {cost} 积分{leftCredits !== null ? ` ｜ 剩余 ${leftCredits}` : ''}
          </div>
          <Button type="submit" disabled={!file || submitting}>
            {submitting ? '提交中…' : '提交生成'}
          </Button>
        </div>
      </div>

      {message && (
        <div role="status" className="text-sm text-muted-foreground">{message}</div>
      )}
      {successTaskId && (
        <div className="text-sm">
          <a className="underline" href="/my-assets" target="_self">前往我的资产</a>
        </div>
      )}
    </form>
  )
}
  const modelLabel = (m: Model) => {
    if (m === 'hitem3dv1') return 'v1'
    if (m === 'hitem3dv1.5') return 'v1.5'
    return '人像 v1.5'
  }
