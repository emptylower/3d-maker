"use client";
import React, { useState } from "react";
import GenerateForm from "@/components/generator/GenerateForm";
import GenerateFormMulti from "@/components/generator/GenerateFormMulti";
import UploadGuideDialog from "@/components/generator/UploadGuideDialog";

type Mode = "general" | "portrait";

export default function GeneratePanel() {
  const [mode, setMode] = useState<Mode>("general");
  const [tab, setTab] = useState<"single" | "multi">("single");

  const onClickMode = (m: Mode) => setMode(m);
  const onClickTab = (t: "single" | "multi") => setTab(t);

  return (
    <div className="grid gap-4" data-testid="generate-panel">
      {/* 顶部模式切换：通用 / 人像（胶囊按钮） */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full bg-muted p-1">
          <button type="button" aria-label="切换通用" onClick={() => onClickMode('general')}
            className={`px-4 py-1 rounded-full text-sm ${mode==='general'?'bg-background shadow':'opacity-70'}`}>通用</button>
          <button type="button" aria-label="切换人像" onClick={() => onClickMode('portrait')}
            className={`px-4 py-1 rounded-full text-sm ${mode==='portrait'?'bg-background shadow':'opacity-70'}`}>人像</button>
        </div>
      </div>

      {/* 主卡片 */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur p-4">
        {/* 页签标题 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6 text-sm">
            <button type="button" aria-label="单图生成3D" onClick={() => onClickTab('single')}
              className={`pb-1 ${tab==='single'?'border-b-2 border-primary font-semibold':'opacity-70'}`}>Image to 3D</button>
            <button type="button" aria-label="多视图生成3D" onClick={() => onClickTab('multi')}
              className={`pb-1 ${tab==='multi'?'border-b-2 border-primary font-semibold':'opacity-70'}`}>Multi-view to 3D</button>
          </div>
          <UploadGuideDialog />
        </div>

        {/* 内容区 */}
        <div className="">
          {tab === 'single' ? (
            <GenerateForm __mode={mode} {...(mode === 'portrait' ? { __overrideModel: 'scene-portraitv1.5', __overrideResolution: '1536', __fixedTexture: true } : {})} />
          ) : (
            <GenerateFormMulti mode={mode} />
          )}
        </div>
      </div>
    </div>
  );
}
