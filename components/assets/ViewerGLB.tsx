"use client";
import React, { useEffect, useState } from 'react'

export default function ViewerGLB({ src, poster }: { src: string; poster?: string }) {
  const [ready, setReady] = useState<boolean>(false)

  useEffect(() => {
    // lazy load model-viewer if not present
    const has = typeof window !== 'undefined' && (window as any).customElements?.get('model-viewer')
    if (has) {
      setReady(true)
      return
    }
    const script = document.createElement('script')
    script.type = 'module'
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js'
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])

  if (!ready) {
    return <div className="w-full h-56 bg-muted animate-pulse rounded" />
  }

  return (
    <model-viewer
      src={src}
      poster={poster}
      crossorigin="anonymous"
      camera-controls
      auto-rotate
      ar
      style={{ width: '100%', height: '280px', background: 'var(--background)' }}
    />
  )
}
