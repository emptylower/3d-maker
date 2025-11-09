"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUp } from "lucide-react";
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

export default function GenerateFormMulti({ mode = "general" as Mode }) {
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
  const [face, setFace] = useState<string>("")

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
      if (face && Number(face) >= 100000 && Number(face) <= 2000000) {
        fd.append('face', String(Math.floor(Number(face))))
      }

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

  return (
    <form onSubmit={onSubmit} className="grid gap-4" data-testid="generate-form-multi">
      {/* 主体上传区：左大卡 + 右侧三小卡 */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
          <div className="rounded-xl border bg-muted/20 p-6 h-64 flex flex-col items-center justify-center text-center">
            <ImageUp className="w-10 h-10 opacity-70 mb-3" />
            <div className="font-semibold mb-1">前视图（必选）</div>
            <div className="text-xs opacity-70">支持格式：JPG/JPEG/PNG/Webp</div>
            <div className="text-xs opacity-70">最大大小：20MB</div>
            <div className="mt-3">
              <Label htmlFor="front-input" className="sr-only">前视图（必选）</Label>
              <Input id="front-input" type="file" accept="image/*" onChange={(e) => setFront(e.currentTarget.files?.[0] || null)} />
            </div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="grid gap-4 grid-rows-3 h-64">
            <div className="rounded-xl border bg-muted/20 p-4 text-center h-full flex flex-col justify-center">
              <div className="text-sm mb-2">后视图（可选）</div>
              <Label htmlFor="back-input" className="sr-only">后视图（可选）</Label>
              <Input id="back-input" type="file" accept="image/*" onChange={(e) => setBack(e.currentTarget.files?.[0] || null)} />
            </div>
            <div className="rounded-xl border bg-muted/20 p-4 text-center h-full flex flex-col justify-center">
              <div className="text-sm mb-2">左视图（可选）</div>
              <Label htmlFor="left-input" className="sr-only">左视图（可选）</Label>
              <Input id="left-input" type="file" accept="image/*" onChange={(e) => setLeft(e.currentTarget.files?.[0] || null)} />
            </div>
            <div className="rounded-xl border bg-muted/20 p-4 text-center h-full flex flex-col justify-center">
              <div className="text-sm mb-2">右视图（可选）</div>
              <Label htmlFor="right-input" className="sr-only">右视图（可选）</Label>
              <Input id="right-input" type="file" accept="image/*" onChange={(e) => setRight(e.currentTarget.files?.[0] || null)} />
            </div>
          </div>
        </div>
      </div>

      {/* 底部操作条 */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/10 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <span>模型</span>
            <select className="border rounded px-2 py-1" value={model} onChange={(e) => setModel(e.target.value as Model)} disabled={mode==='portrait'}>
              {modelChoices.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          {mode !== 'portrait' ? (
            <label className="inline-flex items-center gap-2">
              <span>分辨率</span>
              <select className="border rounded px-2 py-1" value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                {allowedRes.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="px-3 py-1 rounded bg-muted">1536P³</div>
          )}
          {model !== 'scene-portraitv1.5' && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" aria-label="启用纹理" checked={withTexture} onChange={(e) => setWithTexture(e.currentTarget.checked)} />
              <span>纹理</span>
            </label>
          )}
          {/* 高级：面数（可选） */}
          <label className="inline-flex items-center gap-2">
            <span>面数</span>
            <input
              type="number"
              className="border rounded px-2 py-1 w-28"
              placeholder="自动"
              min={100000}
              max={2000000}
              value={face}
              onChange={(e) => setFace(e.currentTarget.value)}
            />
          </label>
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
