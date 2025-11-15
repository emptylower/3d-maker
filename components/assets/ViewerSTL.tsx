"use client";
import React, { useEffect, useRef, useState } from 'react'

async function loadThreeStlModules(): Promise<any> {
  const THREE = await import('three')
  const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  return { THREE, STLLoader, OrbitControls }
}

export default function ViewerSTL({ src, height = 360 }: { src: string; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [uiProgress, setUiProgress] = useState<number>(0)
  const [showModel, setShowModel] = useState<boolean>(false)
  const targetRef = useRef<number>(0)

  // Smooth progress animation toward targetRef
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setUiProgress((prev) => {
        const target = targetRef.current
        if (prev >= target) return prev
        const step = Math.max(0.5, (target - prev) * 0.15)
        const next = Math.min(target, prev + step)
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    let disposed = false
    let renderer: any, scene: any, camera: any, controls: any, animationId: number | null = null

    const run = async () => {
      try {
        setShowModel(false)
        targetRef.current = 0
        setUiProgress(0)

        const { THREE, STLLoader, OrbitControls } = await loadThreeStlModules()
        if (disposed) return

        const el = containerRef.current
        if (!el) return

        const width = el.clientWidth || el.parentElement?.clientWidth || 600
        const heightPx = height

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0xf7f7f7)
        camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, heightPx)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        try { (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace } catch {}
        el.innerHTML = ''
        el.appendChild(renderer.domElement)

        const hemi = new THREE.HemisphereLight(0xffffff, 0x999999, 0.95)
        hemi.position.set(0, 1, 0)
        scene.add(hemi)
        const dir = new THREE.DirectionalLight(0xffffff, 0.85)
        dir.position.set(5, 10, 7)
        dir.castShadow = false
        scene.add(dir)

        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.6
        controls.minDistance = 0.2
        controls.maxDistance = 10

        const manager = new THREE.LoadingManager()
        manager.onStart = () => {
          targetRef.current = 10
        }
        manager.onProgress = (_url: string, loaded: number, total: number) => {
          const p = total > 0 ? (loaded / total) * 80 + 10 : 40
          targetRef.current = Math.max(targetRef.current, Math.min(95, p))
        }
        manager.onLoad = () => {
          targetRef.current = 98
        }

        const loader = new STLLoader(manager)
        const geometry: any = await new Promise((resolve, reject) => {
          loader.load(src, (geo: any) => resolve(geo), undefined, (err: any) => reject(err))
        })

        geometry.computeBoundingBox()
        const box = geometry.boundingBox || new (THREE as any).Box3().setFromCenterAndSize(
          new (THREE as any).Vector3(0, 0, 0),
          new (THREE as any).Vector3(1, 1, 1),
        )
        const size = new (THREE as any).Vector3()
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const scale = 1.0 / maxDim
        const center = new (THREE as any).Vector3()
        box.getCenter(center)

        geometry.translate(-center.x, -center.y, -center.z)
        geometry.scale(scale, scale, scale)

        const material = new (THREE as any).MeshStandardMaterial({
          color: 0xdddddd,
          metalness: 0.15,
          roughness: 0.8,
        })
        const mesh = new (THREE as any).Mesh(geometry, material)
        mesh.castShadow = true
        mesh.receiveShadow = true
        scene.add(mesh)

        const sphere = new (THREE as any).Sphere()
        box.getBoundingSphere(sphere)
        const radius = Math.max(sphere.radius * scale, 0.5)
        const fov = (camera.fov * Math.PI) / 180
        const dist = (radius / Math.sin(fov / 2)) * 1.2
        camera.near = Math.max(dist / 100, 0.01)
        camera.far = Math.max(dist * 10, 100)
        camera.position.set(0, radius * 0.6, dist)
        camera.lookAt(0, 0, 0)
        camera.updateProjectionMatrix()
        controls.target.set(0, 0, 0)
        controls.update()

        // Reveal after a short delay to避免闪烁
        targetRef.current = 100
        setTimeout(() => {
          if (!disposed) setShowModel(true)
        }, 150)

        const tick = () => {
          if (disposed) return
          controls.update()
          renderer.render(scene, camera)
          animationId = requestAnimationFrame(tick)
        }
        tick()

        const onResize = () => {
          const w = el.clientWidth || el.parentElement?.clientWidth || width
          camera.aspect = w / heightPx
          camera.updateProjectionMatrix()
          renderer.setSize(w, heightPx)
        }
        window.addEventListener('resize', onResize)
        renderer.render(scene, camera)
      } catch (e: any) {
        console.error('ViewerSTL error:', e)
        if (!disposed) setError(e?.message || 'STL 预览失败')
      }
    }

    run()

    return () => {
      disposed = true
      try { if (animationId) cancelAnimationFrame(animationId) } catch {}
      try { if (controls && controls.dispose) controls.dispose() } catch {}
      try {
        if (renderer) {
          renderer.dispose?.()
          renderer.forceContextLoss?.()
          renderer.domElement?.remove?.()
        }
      } catch {}
    }
  }, [src, height])

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: 8,
          overflow: 'hidden',
          background: '#f7f7f7',
        }}
      >
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        {!showModel && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(247,247,247,0.92)',
            }}
          >
            <div style={{ width: '66%', maxWidth: 420 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="#111827"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="31.4"
                    strokeDashoffset="15.7"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 8 8"
                      to="360 8 8"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
                <div style={{ fontSize: 13, color: '#374151' }}>正在加载 STL 模型…</div>
                <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
                  {Math.round(uiProgress)}%
                </div>
              </div>
              <div
                style={{
                  height: 8,
                  background: '#e5e7eb',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(uiProgress)}%`,
                    height: '100%',
                    background: '#111827',
                    transition: 'width 240ms ease',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}
