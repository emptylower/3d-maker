"use client";
import React, { useEffect, useRef, useState } from 'react'

type FileItem = { name: string; url: string }

async function loadThreeModules() {
  // Load from npm packages (bundled by Next), safe for SSR since called in useEffect.
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

  useEffect(() => {
    let disposed = false
    let renderer: any, scene: any, camera: any, controls: any, animationId: number | null = null

    const run = async () => {
      try {
        const { THREE, MTLLoader, OBJLoader, OrbitControls } = await loadThreeModules()

        if (disposed) return

        const el = containerRef.current!
        const width = el.clientWidth || el.parentElement?.clientWidth || 600
        const heightPx = height

        // Build name->url map
        const map = new Map<string, string>()
        for (const f of files) {
          const n = normalizeName(f.name)
          map.set(n, f.url)
          map.set(basename(n), f.url)
        }

        // pick obj & mtl
        const objs = files.filter(f => /\.obj$/i.test(f.name))
        const mtls = files.filter(f => /\.mtl$/i.test(f.name))
        const obj = prefer(objs, f => /(^|\/)file\.obj$/i.test(f.name) || /(^|\/)0\.obj$/i.test(f.name))
        const mtl = prefer(mtls, f => /(^|\/)file\.mtl$/i.test(f.name) || /(^|\/)0\.mtl$/i.test(f.name))
        if (!obj) throw new Error('OBJ 文件缺失')

        // Scene
        scene = new THREE.Scene()
        scene.background = new THREE.Color(0xf7f7f7)
        camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 1000)
        camera.position.set(0.6, 0.6, 1.2)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(width, heightPx)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        el.innerHTML = ''
        el.appendChild(renderer.domElement)

        // Lights
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9)
        hemi.position.set(0, 1, 0)
        scene.add(hemi)
        const dir = new THREE.DirectionalLight(0xffffff, 0.8)
        dir.position.set(3, 10, 10)
        scene.add(dir)

        // Grid/ground (soft)
        const grid = new THREE.GridHelper(10, 10, 0xcccccc, 0xeaeaea)
        grid.position.y = -0.001
        scene.add(grid)

        // Controls
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.target.set(0, 0.4, 0)

        // URL modifier: map requested to signed ones
        const manager = new THREE.LoadingManager()
        manager.setURLModifier((url: string) => {
          try {
            const u = new URL(url, location.href)
            // Try full name after last '/obj/'
            const idx = u.pathname.lastIndexOf('/obj/')
            const key = idx >= 0 ? u.pathname.substring(idx + 5) : u.pathname.split('/').pop() || ''
            const clean = normalizeName(key)
            const byExact = map.get(clean)
            if (byExact) return byExact
            const byBase = map.get(basename(clean))
            if (byBase) return byBase
          } catch {}
          // fallback
          const bn = basename(url)
          return map.get(bn) || url
        })

        // Load materials (optional)
        let materials: any = null
        if (mtl) {
          const mtlLoader = new MTLLoader(manager)
          mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true })
          await new Promise<void>((resolve, reject) => {
            mtlLoader.load(mtl.url, (mat: any) => {
              try { mat.preload() } catch {}
              materials = mat
              resolve()
            }, undefined, () => resolve()) // resolve even if mtl missing
          })
        }

        const objLoader = new OBJLoader(manager)
        if (materials) objLoader.setMaterials(materials)
        const root: any = await new Promise((resolve, reject) => {
          objLoader.load(obj.url, (g: any) => resolve(g), undefined, (e: any) => reject(e))
        })

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
        const size = new THREE.Vector3(); box.getSize(size)
        const center = new THREE.Vector3(); box.getCenter(center)
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const scale = 1.0 / maxDim
        root.position.sub(center)
        root.scale.setScalar(scale)
        scene.add(root)

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
      <div ref={containerRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', background: '#f7f7f7' }} />
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}
