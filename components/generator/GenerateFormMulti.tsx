"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageUp, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { resolveCreditsCost } from "@/lib/credits/cost";

type Mode = "general" | "portrait";
type Model = 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
type Resolution = '512' | '1024' | '1536' | '1536pro'
const allModels: Model[] = ['hitem3dv1', 'hitem3dv1.5', 'scene-portraitv1.5']
const resByModel: Record<Model, Resolution[]> = {
  'hitem3dv1': ['512', '1024', '1536'],
  'hitem3dv1.5': ['512', '1024', '1536', '1536pro'],
  'scene-portraitv1.5': ['1536'],
}

export default function GenerateFormMulti({ mode = "general" as Mode, fill = false as boolean }) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [model, setModel] = useState<Model>(mode === 'portrait' ? 'scene-portraitv1.5' : 'hitem3dv1.5')
  const [resolution, setResolution] = useState<Resolution>('1536')
  const [withTexture, setWithTexture] = useState(mode === "portrait" ? true : false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [leftCredits, setLeftCredits] = useState<number | null>(null)
  const [successTaskId, setSuccessTaskId] = useState<string | null>(null)
  const [frontPreview, setFrontPreview] = useState<string | null>(null)
  const [backPreview, setBackPreview] = useState<string | null>(null)
  const [leftPreview, setLeftPreview] = useState<string | null>(null)
  const [rightPreview, setRightPreview] = useState<string | null>(null)
  const refFront = useRef<HTMLInputElement | null>(null)
  const refBack = useRef<HTMLInputElement | null>(null)
  const refLeft = useRef<HTMLInputElement | null>(null)
  const refRight = useRef<HTMLInputElement | null>(null)

  const files = useMemo(() => ({ front, back, left, right }), [front, back, left, right]);

  const areExtraViewsPresent = !!(back || left || right);

  const modelChoices = useMemo(() => (mode === 'portrait' ? (['scene-portraitv1.5'] as Model[]) : (['hitem3dv1','hitem3dv1.5'] as Model[])), [mode])
  const allowedRes = useMemo(() => resByModel[model], [model])
  React.useEffect(() => {
    if (mode === 'portrait') {
      if (model !== 'scene-portraitv1.5') setModel('scene-portraitv1.5')
      if (resolution !== '1536') setResolution('1536')
      if (!withTexture) setWithTexture(true)
    }
  }, [mode])
  if (!allowedRes.includes(resolution)) {
    setTimeout(() => setResolution(allowedRes[allowedRes.length - 1]), 0)
  }
  const textureEffective = model === 'scene-portraitv1.5' ? true : withTexture
  const cost = useMemo(() => {
    const request_type = (textureEffective ? 3 : 1) as 1 | 3
    return resolveCreditsCost({ model: model as any, request_type, resolution: resolution as any });
  }, [model, resolution, textureEffective]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!front) {
      setMessage("请至少选择前视图");
      return;
    }

    // 20MB 限制
    const max = 20 * 1024 * 1024;
    if ([front, back, left, right].some((f) => f && f.size > max)) {
      setMessage("单张图片大小不能超过20MB");
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      const request_type = textureEffective ? 3 : 1;
      fd.append("request_type", String(request_type));
      fd.append("model", model);
      fd.append("resolution", resolution);
      // 默认产出 OBJ（下载友好），后台会自动补齐其它格式（含 GLB 便于预览）
      fd.append("format", "1");

      if (!areExtraViewsPresent) {
        fd.append("images", front, front.name || "front.png");
      } else {
        // 顺序：前/后/左/右；未选择的不占位
        fd.append("multi_images", front, front.name || "front.png");
        if (back) fd.append("multi_images", back, back.name || "back.png");
        if (left) fd.append("multi_images", left, left.name || "left.png");
        if (right) fd.append("multi_images", right, right.name || "right.png");
      }
      // 面数自动，前端不暴露

      const resp = await fetch('/api/hitem3d/submit', { method: 'POST', body: fd });
      if (resp.status === 401) { setMessage('请先登录后再提交'); return; }
      if (resp.status === 400) {
        const j = await resp.json().catch(() => null);
        setMessage(j?.message || '参数错误');
        return;
      }
      if (!resp.ok) { setMessage('提交失败，请稍后再试'); return; }
      const json = await resp.json().catch(() => null);
      if (json?.code === 2000) { setMessage('积分不足，请先购买或降低配置'); return; }
      if (json?.code === 0) {
        setMessage('已提交，预览生成中。前往我的资产查看进度。');
        if (json?.data?.task_id) setSuccessTaskId(String(json.data.task_id))
      } else {
        setMessage('提交失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
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

  // previews lifecycle
  useEffect(() => { if (!front) { setFrontPreview(null); return } const u = URL.createObjectURL(front); setFrontPreview(u); return () => URL.revokeObjectURL(u) }, [front])
  useEffect(() => { if (!back) { setBackPreview(null); return } const u = URL.createObjectURL(back); setBackPreview(u); return () => URL.revokeObjectURL(u) }, [back])
  useEffect(() => { if (!left) { setLeftPreview(null); return } const u = URL.createObjectURL(left); setLeftPreview(u); return () => URL.revokeObjectURL(u) }, [left])
  useEffect(() => { if (!right) { setRightPreview(null); return } const u = URL.createObjectURL(right); setRightPreview(u); return () => URL.revokeObjectURL(u) }, [right])

  return (
    <form onSubmit={onSubmit} className={`grid gap-4 ${fill ? 'grid-rows-[1fr_auto_auto] h-full min-h-0' : ''}`} data-testid="generate-form-multi">
      {/* 主体上传区：左大卡 + 右侧三小卡（可预览/拖拽替换） */}
      <div className="grid grid-cols-12 gap-4 min-h-0">
        <div className="col-span-9">
          <div
            className={`rounded-2xl border bg-muted/20 relative overflow-hidden group ${fill ? 'flex-1 min-h-[24rem]' : 'h-72'}`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFront(f) }}
            onClick={() => refFront.current?.click()}
            role="button"
            aria-label="上传或替换前视图"
          >
            {frontPreview ? (
              <>
                <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${frontPreview})` }} />
                <button type="button" className="absolute right-3 top-3 z-10 rounded-full bg-background/70 p-1.5 border hover:bg-background" onClick={(e)=>{e.stopPropagation(); setFront(null)}} aria-label="移除">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30 text-foreground">
                  <div className="flex items-center gap-2 text-sm"><ImageUp className="w-5 h-5" /> 点击或拖拽替换</div>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <ImageUp className="w-10 h-10 opacity-70 mb-3" />
                <div className="font-semibold mb-1">前视图（必选）</div>
                <div className="text-xs opacity-70">支持 JPG/JPEG/PNG/WebP，单张 ≤ 20MB</div>
              </div>
            )}
            <input ref={refFront} id="front-input" className="hidden" type="file" accept="image/*" onChange={(e) => setFront(e.currentTarget.files?.[0] || null)} />
          </div>
        </div>
        <div className="col-span-3 min-h-0">
          <div className={`grid gap-4 grid-rows-3 ${fill ? 'h-full min-h-[24rem]' : 'h-64'}`}
            {[{k:'back',label:'后视图（可选）',preview:backPreview,set:setBack,ref:refBack},{k:'left',label:'左视图（可选）',preview:leftPreview,set:setLeft,ref:refLeft},{k:'right',label:'右视图（可选）',preview:rightPreview,set:setRight,ref:refRight}].map((it)=> (
              <div key={it.k}
                className="rounded-xl border bg-muted/20 text-center h-full relative overflow-hidden group flex items-center justify-center"
                onDragOver={(e)=>{e.preventDefault(); e.stopPropagation()}}
                onDrop={(e)=>{e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) (it.set as any)(f)}}
                onClick={()=> (it.ref as any).current?.click()}
                role="button"
              >
                {it.preview ? (
                  <>
                    <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${it.preview})` }} />
                    <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/30 text-foreground">
                      <div className="flex items-center gap-1 text-xs"><ImageUp className="w-4 h-4" /> 替换</div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs opacity-80 px-2">{it.label}</div>
                )}
                <input ref={it.ref as any} className="hidden" type="file" accept="image/*" onChange={(e)=> (it.set as any)(e.currentTarget.files?.[0] || null)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部操作条 */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          {/* 模型：卡片选项 */}
          <div className="flex items-center gap-2">
            <span className="opacity-70">模型</span>
            <div className="flex items-center gap-2">
              {modelChoices.map((m) => (
                <button key={m} type="button" onClick={() => setModel(m)} disabled={mode==='portrait'}
                  className={`px-3 py-1.5 rounded-xl border ${m===model?'border-primary bg-background shadow':'opacity-70 hover:opacity-100'} ${mode==='portrait'?'opacity-60 cursor-not-allowed':''}`}>{modelLabel(m)}</button>
              ))}
            </div>
          </div>
          {mode !== 'portrait' ? (
            <div className="flex items-center gap-2">
              <span className="opacity-70">分辨率</span>
              <div className="flex items-center gap-2">
                {allowedRes.map((r) => (
                  <button key={r} type="button" onClick={() => setResolution(r)}
                    className={`px-3 py-1.5 rounded-xl border ${r===resolution?'border-primary bg-background shadow':'opacity-70 hover:opacity-100'}`}>{r === '1536pro' ? '1536P³pro' : r}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-3 py-1 rounded bg-muted">1536P³</div>
          )}
          {model !== 'scene-portraitv1.5' && (
            <label className="inline-flex items-center gap-2">
              <span>纹理</span>
              <Switch checked={withTexture} onCheckedChange={(v)=> setWithTexture(!!v)} />
            </label>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div aria-live="polite" data-testid="cost-hint" className="text-sm opacity-80">预计消耗 {cost} 积分{leftCredits !== null ? ` ｜ 剩余 ${leftCredits}` : ''}</div>
          <Button type="submit" disabled={!front || submitting}>{submitting ? '提交中…' : '提交生成'}</Button>
        </div>
      </div>

      {message && (<div role="status" className="text-sm text-muted-foreground">{message}</div>)}
      {successTaskId && (
        <div className="text-sm">
          <a className="underline" href="/my-assets" target="_self">前往我的资产</a>
        </div>
      )}
    </form>
  );
}
  const modelLabel = (m: Model) => {
    if (m === 'hitem3dv1') return 'v1'
    if (m === 'hitem3dv1.5') return 'v1.5'
    return '人像 v1.5'
  }
