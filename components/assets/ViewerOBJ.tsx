"use client";
import React, { useEffect, useRef, useState } from 'react'

type FileItem = { name: string; url: string }

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(s)
  })
}

async function loadThreeViaESM(): Promise<any> {
  const w = window as any
  if (w.__ThreeMods && w.__ThreeMods.THREE && w.__ThreeMods.OBJLoader) return w.__ThreeMods
  const code = `
    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
    import { MTLLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/MTLLoader.js';
    import { OBJLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
    import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';
    window.__ThreeMods = { THREE, MTLLoader, OBJLoader, OrbitControls };
  `
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.type = 'module'
    s.textContent = code
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('failed to load three modules (ESM)'))
    document.head.appendChild(s)
  })
  return w.__ThreeMods
}

async function loadThreeViaLegacy(): Promise<any> {
  const w = window as any
  // legacy UMD globals
  if (!w.THREE) await loadScript('https://unpkg.com/three@0.160.0/build/three.min.js')
  if (!(w.THREE && w.THREE.MTLLoader)) await loadScript('https://unpkg.com/three@0.160.0/examples/js/loaders/MTLLoader.js')
  if (!(w.THREE && w.THREE.OBJLoader)) await loadScript('https://unpkg.com/three@0.160.0/examples/js/loaders/OBJLoader.js')
  if (!(w.THREE && w.THREE.OrbitControls)) await loadScript('https://unpkg.com/three@0.160.0/examples/js/controls/OrbitControls.js')
  return { THREE: w.THREE, MTLLoader: w.THREE.MTLLoader, OBJLoader: w.THREE.OBJLoader, OrbitControls: w.THREE.OrbitControls }
}

async function loadThreeModules(setStatus?: (s: string) => void): Promise<any> {
  try {
    setStatus && setStatus('加载 three 模块…')
    const esm = await Promise.race([
      loadThreeViaESM(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('esm_timeout')), 1500)),
    ])
    setStatus && setStatus('three 模块就绪')
    return esm
  } catch (e) {
    // fallback to legacy UMD
    setStatus && setStatus('兼容模式加载 three…')
    const legacy = await loadThreeViaLegacy()
    setStatus && setStatus('three 模块就绪（兼容）')
    return legacy
  }
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
  const [status, setStatus] = useState<string>('初始化…')

  useEffect(() => {
    let disposed = false
    let renderer: any, scene: any, camera: any, controls: any, animationId: number | null = null
    let added = false

    const run = async () => {
      try {
        const { THREE, MTLLoader, OBJLoader, OrbitControls } = await loadThreeModules(setStatus)

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
        manager.onStart = (url: string, loaded: number, total: number) => { setStatus(`加载开始 (${loaded}/${total})`) }
        manager.onProgress = (url: string, loaded: number, total: number) => { setStatus(`加载中 ${loaded}/${total}`) }
        manager.onLoad = () => { setStatus('解析中…') }
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
                const p = Math.round(ev.loaded * 100 / Math.max(1, ev.total))
                setStatus(`加载模型 ${p}%`)
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
                const p = Math.round(ev.loaded * 100 / Math.max(1, ev.total))
                setStatus(`加载模型 ${p}%`)
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
        const size = new THREE.Vector3(); box.getSize(size)
        const center = new THREE.Vector3(); box.getCenter(center)
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const scale = 1.0 / maxDim
        root.position.sub(center)
        root.scale.setScalar(scale)
        scene.add(root)
        added = true
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
      <div className="text-xs text-muted-foreground mt-1">{status}</div>
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}
