"use client";
import React, { useEffect, useRef, useState } from 'react'

type FileItem = { name: string; url: string }

async function loadThreeModules(): Promise<any> {
  // Bundle via npm to avoid CDN/CSP issues
  const THREE = await import('three')
  const { MTLLoader } = await import('three/examples/jsm/loaders/MTLLoader.js')
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  return { THREE, MTLLoader, OBJLoader, OrbitControls }
}

function prefer<T>(arr: T[], pick: (x: T) => boolean): T | null {
  for (const x of arr) if (pick(x)) return x
  return arr.length ? arr[0] : null
}

function normalizeName(n: string) {
  return n.replace(/^\/+/, '').replace(/\\/g, '/').split('?')[0].split('#')[0]
}

function basename(n: string) {
  const s = normalizeName(n)
  const segs = s.split('/')
  return segs[segs.length - 1]
}

export default function ViewerOBJ({ files, height = 360 }: { files: FileItem[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('初始化…')
  const [progress, setProgress] = useState<number>(0)
  const [showModel, setShowModel] = useState<boolean>(false)

  useEffect(() => {
    let disposed = false
    let renderer: any, scene: any, camera: any, controls: any, animationId: number | null = null
    let added = false

    const run = async () => {
      try {
        setShowModel(false)
        setProgress(0)
        const { THREE, MTLLoader, OBJLoader, OrbitControls } = await loadThreeModules()

        if (disposed) return

        const el = containerRef.current!
        const width = el.clientWidth || el.parentElement?.clientWidth || 600
        const heightPx = height

        // Build name->url map
        const map = new Map<string, string>()
        for (const f of files) {
          const n = normalizeName(f.name)
          const b = basename(n)
          map.set(n, f.url)
          map.set(b, f.url)
          map.set(n.toLowerCase(), f.url)
          map.set(b.toLowerCase(), f.url)
        }
        console.log('[OBJ] files:', files.map(f => f.name))
        setStatus('已获取文件清单')

        // pick obj & mtl
        const objs = files.filter(f => /\.obj$/i.test(f.name))
        const mtls = files.filter(f => /\.mtl$/i.test(f.name))
        const obj = prefer(objs, f => /(^|\/)file\.obj$/i.test(f.name) || /(^|\/)0\.obj$/i.test(f.name))
        const mtl = prefer(mtls, f => /(^|\/)file\.mtl$/i.test(f.name) || /(^|\/)0\.mtl$/i.test(f.name))
        if (!obj) throw new Error('OBJ 文件缺失')
        console.log('[OBJ] chosen:', { obj: obj.name, mtl: mtl?.name })
        setStatus(`准备加载：${obj.name}${mtl ? ' + ' + mtl.name : ''}`)

        // Scene
        scene = new THREE.Scene()
        scene.background = new THREE.Color(0xf7f7f7)
        camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, heightPx)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        try { (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace } catch {}
        el.innerHTML = ''
        el.appendChild(renderer.domElement)

        // Lights
        const hemi = new THREE.HemisphereLight(0xffffff, 0x999999, 0.95)
        hemi.position.set(0, 1, 0)
        scene.add(hemi)
        const dir = new THREE.DirectionalLight(0xffffff, 0.85)
        dir.position.set(5, 10, 7)
        dir.castShadow = false
        scene.add(dir)

        // Grid/ground (soft)
        const grid = new THREE.GridHelper(10, 10, 0xcccccc, 0xeaeaea)
        grid.position.y = -0.001
        scene.add(grid)

        // Controls
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.target.set(0, 0, 0)

        // URL modifier: map requested to signed ones
        const manager = new THREE.LoadingManager()
        manager.onStart = (_url: string, loaded: number, total: number) => {
          setStatus(`加载开始 (${loaded}/${total})`)
          if (total > 0) setProgress(Math.min(99, Math.round((loaded / total) * 100)))
        }
        manager.onProgress = (_url: string, loaded: number, total: number) => {
          setStatus(`加载中 ${loaded}/${total}`)
          if (total > 0) setProgress((prev) => Math.max(prev, Math.min(99, Math.round((loaded / total) * 100))))
        }
        manager.onLoad = () => {
          if (!added) { setStatus('解析中…') }
        }
        manager.setURLModifier((url: string) => {
          try {
            const u = new URL(url, location.href)
            // Try full name after last '/obj/'
            const idx = u.pathname.lastIndexOf('/obj/')
            const key = idx >= 0 ? u.pathname.substring(idx + 5) : u.pathname.split('/').pop() || ''
            const clean = normalizeName(key)
            const byExact = map.get(clean) || map.get(clean.toLowerCase())
            if (byExact) return byExact
            const byBase = map.get(basename(clean)) || map.get(basename(clean).toLowerCase())
            if (byBase) return byBase
          } catch {}
          // fallback
          const bn = basename(url)
          const out = map.get(bn) || map.get(bn.toLowerCase()) || url
          return out
        })

        // Two-path load: try with MTL, but fallback to OBJ-only if it stalls > 2s
        const objLoader = new OBJLoader(manager)
        const loadWithMtl = async () => {
          let materials: any = null
          if (mtl) {
            console.log('[OBJ] loading MTL:', mtl.url)
            const mtlLoader = new MTLLoader(manager)
            mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true })
            try {
              const base = new URL(mtl.url)
              base.pathname = base.pathname.replace(/[^/]+$/, '')
              mtlLoader.setResourcePath(base.toString())
              mtlLoader.setPath(base.toString())
            } catch {}
            await new Promise<void>((resolve) => {
              mtlLoader.load(mtl.url, (mat: any) => {
                try { mat.preload() } catch {}
                materials = mat
                resolve()
              }, (ev: any) => {
                if (ev && typeof ev.loaded === 'number' && typeof ev.total === 'number') {
                  const p = Math.round(ev.loaded * 100 / Math.max(1, ev.total))
                  setStatus(`加载材质 ${p}%`)
                }
              }, () => resolve()) // resolve even if mtl missing
            })
          }
          if (materials) objLoader.setMaterials(materials)
          console.log('[OBJ] loading OBJ(with mtl?):', !!materials)
          const g: any = await new Promise((resolve, reject) => {
            objLoader.load(obj.url, (gg: any) => resolve(gg), (ev: any) => {
              if (ev && typeof ev.loaded === 'number' && typeof ev.total === 'number') {
                const p = Math.round((ev.loaded * 100) / Math.max(1, ev.total))
                setStatus(`加载模型 ${p}%`)
                setProgress((prev) => Math.max(prev, Math.min(99, p)))
              }
            }, (e: any) => reject(e))
          })
          return g
        }
        const loadObjOnly = async () => {
          console.log('[OBJ] fallback: loading OBJ only')
          const g: any = await new Promise((resolve, reject) => {
            objLoader.load(obj.url, (gg: any) => resolve(gg), (ev: any) => {
              if (ev && typeof ev.loaded === 'number' && typeof ev.total === 'number') {
                const p = Math.round((ev.loaded * 100) / Math.max(1, ev.total))
                setStatus(`加载模型 ${p}%`)
                setProgress((prev) => Math.max(prev, Math.min(99, p)))
              }
            }, (e: any) => reject(e))
          })
          return g
        }
        const timeout = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 2000))
        let root: any
        try {
          const raced: any = await Promise.race([loadWithMtl(), timeout])
          if (raced === 'TIMEOUT') {
            root = await loadObjOnly()
          } else {
            root = raced
          }
        } catch (e) {
          console.warn('[OBJ] with MTL failed, retrying OBJ only:', e)
          root = await loadObjOnly()
        }

        // Normalize scale and center
        root.traverse((c: any) => {
          if (c.isMesh) {
            c.castShadow = true; c.receiveShadow = true
            if (!c.material) {
              c.material = new (THREE as any).MeshStandardMaterial({ color: 0xdddddd })
            }
          }
        })
        const box = new THREE.Box3().setFromObject(root)
        const center = new THREE.Vector3(); box.getCenter(center)
        const size = new THREE.Vector3(); box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const scale = 1.0 / maxDim
        // Move model to origin and uniform scale
        root.position.sub(center)
        root.scale.setScalar(scale)
        scene.add(root)
        // Fallback: if no texture map was applied via MTL, apply the first image to all meshes
        let hasTextureMap = false
        root.traverse((c: any) => {
          if (c.isMesh) {
            const mats = Array.isArray(c.material) ? c.material : [c.material]
            if (mats.some((m: any) => m && m.map)) hasTextureMap = true
          }
        })
        if (!hasTextureMap) {
          const texFile = files.find(f => /\.(png|jpe?g|webp)$/i.test(f.name))
          if (texFile) {
            try {
              const tLoader = new THREE.TextureLoader(manager)
              await new Promise<void>((resolve) => {
                tLoader.load(texFile.url, (tex: any) => {
                  try {
                    root.traverse((c: any) => {
                      if (c.isMesh) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material]
                        for (const m of mats) { if (m) { m.map = tex; m.needsUpdate = true } }
                      }
                    })
                  } catch {}
                  resolve()
                }, undefined, () => resolve())
              })
            } catch {}
          }
        }

        // Frame camera to fit whole model
        const sphere = new THREE.Sphere()
        box.getBoundingSphere(sphere)
        const radius = Math.max(sphere.radius * scale, 0.5)
        const fov = (camera.fov * Math.PI) / 180
        const dist = radius / Math.sin(fov / 2) * 1.2
        camera.near = Math.max(dist / 100, 0.01)
        camera.far = Math.max(dist * 10, 100)
        camera.position.set(0, radius * 0.6, dist)
        camera.lookAt(0, 0, 0)
        camera.updateProjectionMatrix()
        controls.target.set(0, 0, 0)
        controls.update()
        added = true
        // prevent late onLoad from overriding status
        manager.onLoad = () => {}
        setStatus(`就绪：尺寸 ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`)
        try {
          const box2 = new THREE.Box3().setFromObject(root)
          const size2 = new THREE.Vector3(); box2.getSize(size2)
          setStatus(`就绪：尺寸 ${size2.x.toFixed(2)} × ${size2.y.toFixed(2)} × ${size2.z.toFixed(2)}`)
        } catch {}

        // Animate
        const tick = () => {
          if (disposed) return
          controls.update()
          renderer.render(scene, camera)
          animationId = requestAnimationFrame(tick)
        }
        tick()

        // Resize
        const onResize = () => {
          const w = el.clientWidth || el.parentElement?.clientWidth || width
          camera.aspect = w / heightPx
          camera.updateProjectionMatrix()
          renderer.setSize(w, heightPx)
        }
        window.addEventListener('resize', onResize)
        // Render at least once in case RAF is throttled
        renderer.render(scene, camera)
        // Mark as ready (no more network loads expected)
        setProgress(100)
        setShowModel(true)
      } catch (e: any) {
        console.error('ViewerOBJ error:', e)
        if (!disposed) setError(e?.message || 'failed to preview OBJ')
      }
    }
    run()

    return () => {
      disposed = true
      try { if (animationId) cancelAnimationFrame(animationId) } catch {}
      try { if (controls && controls.dispose) controls.dispose() } catch {}
      try { if (renderer) { renderer.dispose?.(); renderer.forceContextLoss?.(); renderer.domElement?.remove?.() } } catch {}
    }
  }, [files, height])

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', background: '#f7f7f7', position: 'relative' }} />
      {!showModel && (
        <div style={{
          position: 'relative',
          marginTop: -height + 0,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(247,247,247,0.9)',
          borderRadius: 8,
        }}>
          <div style={{ width: '66%', maxWidth: 420 }}>
            <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#111827', transition: 'width 180ms ease' }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{status}（{progress}%）</div>
          </div>
        </div>
      )}
      <div className="text-xs text-muted-foreground mt-1">{status}</div>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}
