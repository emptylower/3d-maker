"use client";
import React, { useState } from "react";
import GenerateForm from "@/components/generator/GenerateForm";
import GenerateFormMulti from "@/components/generator/GenerateFormMulti";

type Mode = "general" | "portrait";

export default function GeneratePanel() {
  const [mode, setMode] = useState<Mode>("general");
  const [tab, setTab] = useState<"single" | "multi">("single");

  const onClickMode = (m: Mode) => setMode(m);
  const onClickTab = (t: "single" | "multi") => setTab(t);

  return (
    <div className="grid gap-6" data-testid="generate-panel">
      {/* 顶部模式切换：通用 / 人像 */}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="切换通用"
          className={`px-3 py-1 rounded ${mode === 'general' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
          onClick={() => onClickMode('general')}
        >通用</button>
        <button
          type="button"
          aria-label="切换人像"
          className={`px-3 py-1 rounded ${mode === 'portrait' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
          onClick={() => onClickMode('portrait')}
        >人像</button>
      </div>

      {/* 页签：单图 / 多视图 */}
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="单图生成3D"
          className={`px-3 py-1 rounded ${tab === 'single' ? 'bg-muted-foreground/10' : 'bg-secondary'}`}
          onClick={() => onClickTab('single')}
        >单图生成3D</button>
        <button
          type="button"
          aria-label="多视图生成3D"
          className={`px-3 py-1 rounded ${tab === 'multi' ? 'bg-muted-foreground/10' : 'bg-secondary'}`}
          onClick={() => onClickTab('multi')}
        >多视图生成3D</button>
      </div>

      {tab === 'single' ? (
        // portrait 模式下固定纹理（请求类型=3）、固定 model 与分辨率
        <GenerateForm
          // 以下 prop 只在 portrait 模式时生效；保持向后兼容默认 props
          {...(mode === 'portrait'
            ? { __overrideModel: 'scene-portraitv1.5', __overrideResolution: '1536', __fixedTexture: true }
            : {})}
        />
      ) : (
        <GenerateFormMulti mode={mode} />
      )}
    </div>
  );
}

