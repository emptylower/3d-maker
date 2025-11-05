"use client";
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUp } from "lucide-react";
import { resolveCreditsCost } from "@/lib/credits/cost";

type Mode = "general" | "portrait";

export default function GenerateFormMulti({ mode = "general" as Mode }) {
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [left, setLeft] = useState<File | null>(null);
  const [right, setRight] = useState<File | null>(null);
  const [withTexture, setWithTexture] = useState(mode === "portrait" ? true : false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const files = useMemo(() => ({ front, back, left, right }), [front, back, left, right]);

  const areExtraViewsPresent = !!(back || left || right);

  const cost = useMemo(() => {
    const request_type = (mode === "portrait" ? 3 : withTexture ? 3 : 1) as 1 | 3;
    const model = (mode === "portrait" ? "scene-portraitv1.5" : "hitem3dv1.5") as any;
    return resolveCreditsCost({ model, request_type, resolution: "1536" });
  }, [mode, withTexture]);

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
      const request_type = mode === "portrait" ? 3 : withTexture ? 3 : 1;
      const model = mode === "portrait" ? "scene-portraitv1.5" : "hitem3dv1.5";
      fd.append("request_type", String(request_type));
      fd.append("model", model);
      fd.append("resolution", "1536");
      // 默认预览产出 GLB
      fd.append("format", "2");

      if (!areExtraViewsPresent) {
        fd.append("images", front, front.name || "front.png");
      } else {
        // 顺序：前/后/左/右；未选择的不占位
        fd.append("multi_images", front, front.name || "front.png");
        if (back) fd.append("multi_images", back, back.name || "back.png");
        if (left) fd.append("multi_images", left, left.name || "left.png");
        if (right) fd.append("multi_images", right, right.name || "right.png");
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
      } else {
        setMessage('提交失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="px-3 py-1 rounded bg-muted">{mode==='portrait' ? '人像 v1.5' : 'v1.5'}</div>
          <div className="px-3 py-1 rounded bg-muted">1536P³</div>
          {mode==='general' && (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" aria-label="启用纹理" checked={withTexture} onChange={(e) => setWithTexture(e.currentTarget.checked)} />
              <span>纹理</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div aria-live="polite" data-testid="cost-hint" className="text-sm opacity-80">预计消耗 {cost} 积分</div>
          <Button type="submit" disabled={!front || submitting}>{submitting ? '提交中…' : '提交生成'}</Button>
        </div>
      </div>

      {message && (<div role="status" className="text-sm text-muted-foreground">{message}</div>)}
    </form>
  );
}
