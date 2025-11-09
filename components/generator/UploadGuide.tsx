"use client";
import React from "react";

export default function UploadGuide() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        className="text-xs opacity-70 hover:opacity-100"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-expanded={open}
      >
        上传指南
      </button>
      {open && (
        <div
          className="absolute right-0 z-10 mt-2 w-72 rounded-xl border bg-card p-3 text-xs shadow-lg"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <div className="font-medium mb-1">更好效果的小贴士</div>
          <ul className="space-y-1 text-muted-foreground">
            <li>主体清晰完整，背景简洁纯色。</li>
            <li>单图：优先选择标准正面视图。</li>
            <li>多视图：前视图必选；后/左/右视图可选更佳。</li>
            <li>避免过暗/过曝与强反光；文件 ≤ 20MB。</li>
          </ul>
        </div>
      )}
    </div>
  );
}

