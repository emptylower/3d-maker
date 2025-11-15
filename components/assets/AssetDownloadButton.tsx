"use client";
import React from 'react'
import { Button } from '@/components/ui/button'

export default function AssetDownloadButton({ assetUuid }: { assetUuid: string }) {
  const onClick = () => {
    if (typeof window === 'undefined') return
    // 简单直接：跳转到后端下载接口，由后端判断权限与预签名
    window.location.href = `/api/assets/${assetUuid}/download`
  }

  return (
    <Button
      size="lg"
      className="w-full justify-center rounded-xl bg-emerald-500 text-sm font-medium text-slate-950 hover:bg-emerald-400"
      onClick={onClick}
    >
      下载模型
    </Button>
  )
}

