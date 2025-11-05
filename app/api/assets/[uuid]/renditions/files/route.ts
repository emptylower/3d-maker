import { getUserUuid } from '@/services/user'
import { findAssetByUuid } from '@/models/asset'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'

type Fmt = 'obj'

export async function GET(req: Request, ctx: any) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const { uuid } = ctx?.params || {}
    const asset = await findAssetByUuid(uuid)
    if (!asset) return Response.json({ code: -1, message: 'not found' }, { status: 404 })
    if (asset.user_uuid !== user_uuid) return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })

    const url = new URL(req.url)
    const fmt = (url.searchParams.get('format') || 'obj') as Fmt
    const debugEnabled = ['1', 'true', 'yes'].includes((url.searchParams.get('debug') || '').toLowerCase())
    if (fmt !== 'obj') return Response.json({ code: -1, message: 'unsupported format' }, { status: 400 })

    const storage = newStorage()
    const prefix = `assets/${asset.user_uuid}/${asset.uuid}/obj/`

    // materialize if not exists
    let keys = await storage.listObjects({ prefix })
    let debugInfo: any | undefined
    const onlyObjPresent = (arr: string[]) => arr.length > 0 && arr.every(k => /\/obj\/[^/]+\.obj$/i.test(k))
    if (!keys || keys.length === 0 || onlyObjPresent(keys)) {
      const res = await materializeObjFiles(asset.user_uuid, asset.uuid, asset.task_id || '', debugEnabled)
      debugInfo = res.debug
      if (res.ok) keys = await storage.listObjects({ prefix })
    }

    if (!keys || keys.length === 0) {
      const payload: any = { code: -1, message: 'files not available' }
      if (debugEnabled) payload.debug = debugInfo || { note: 'no keys after materialize attempt' }
      return Response.json(payload, { status: 404 })
    }

    // sign
    const files: Array<{ name: string; url: string }> = []
    for (const key of keys) {
      const rawName = key.substring(prefix.length)
      const cleanName = dropQueryAndHash(rawName)
      const disp = `attachment; filename=${encodeURIComponent(cleanName)}`
      const { url } = await storage.getSignedUrl({ key, responseDisposition: disp })
      files.push({ name: cleanName, url })
    }

    const payload: any = { code: 0, data: { files } }
    if (debugEnabled) payload.debug = debugInfo || { note: 'files already existed, no materialize' }
    return Response.json(payload)
  } catch (e) {
    console.error('renditions files error:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

async function materializeObjFiles(user_uuid: string, asset_uuid: string, task_id: string, debugEnabled = false): Promise<{ ok: boolean; debug?: any }> {
  try {
    const dbg: any = debugEnabled ? { steps: [], uploads: [] } : undefined
    const pushStep = (s: any) => { if (dbg) dbg.steps.push(s) }
    if (!task_id) { pushStep({ reason: 'no_task_id' }); return { ok: false, debug: dbg } }
    const task = await findGenerationTaskByTaskId(task_id)
    const baseUrl = task?.hitem3d_file_url || ''
    if (!baseUrl) { pushStep({ reason: 'no_vendor_url' }); return { ok: false, debug: dbg } }
    const objUrl = replaceExt(baseUrl, 'obj')
    if (!objUrl) { pushStep({ reason: 'replace_ext_failed', baseUrl }); return { ok: false, debug: dbg } }

    const origin = new URL(objUrl).origin
    const baseQS = new URL(objUrl).search // keep auth_key style queries
    const headers: Record<string, string> = {}
    headers['Referer'] = process.env.HITEM3D_REFERER || origin
    headers['Origin'] = process.env.HITEM3D_REFERER || origin
    headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
    if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID

    const storage = newStorage()
    const res = await fetch(objUrl, { headers })
    if (debugEnabled) pushStep({ action: 'fetch_obj', url: redactUrl(objUrl), status: res.status, ok: res.ok })
    if (!res.ok) return { ok: false, debug: dbg }
    const objText = await res.text()
    const objUrlObj = new URL(objUrl)
    const objPathSeg = objUrlObj.pathname.split('/').pop() || 'model.obj'
    const objKey = buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(objPathSeg)}` })
    await storage.uploadFile({ body: Buffer.from(new TextEncoder().encode(objText)), key: objKey, contentType: 'text/plain', disposition: 'attachment' })
    if (debugEnabled) dbg.uploads.push({ key: objKey, type: 'obj' })

    let mtlFiles = parseMtllib(objText)
    // Fallback: if mtllib not declared, try baseName.mtl (common convention like 0.mtl)
    if (mtlFiles.length === 0) {
      const guess = (objPathSeg.replace(/\.[^.]+$/i, '') || '0') + '.mtl'
      mtlFiles = [guess]
    }
    if (debugEnabled) pushStep({ action: 'parse_mtllib', count: mtlFiles.length, files: mtlFiles })
    const fetchedMtls: string[] = []
    for (const m of mtlFiles) {
      try {
        const mNorm = m.replace(/\\/g, '/')
        const mUrlObj = new URL(mNorm, objUrl)
        if (!mUrlObj.search) mUrlObj.search = baseQS
        const mUrl = mUrlObj.toString()
        const mRes = await fetch(mUrl, { headers })
        if (debugEnabled) pushStep({ action: 'fetch_mtl', name: mNorm, url: redactUrl(mUrl), status: mRes.status, ok: mRes.ok })
        if (!mRes.ok) continue
        const mText = await mRes.text()
        const mKey = buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(mNorm)}` })
        await storage.uploadFile({ body: Buffer.from(new TextEncoder().encode(mText)), key: mKey, contentType: 'text/plain', disposition: 'attachment' })
        if (debugEnabled) dbg.uploads.push({ key: mKey, type: 'mtl' })
        // textures referenced in this mtl
        const tex = parseTextures(mText)
        if (debugEnabled) pushStep({ action: 'parse_textures', from: mNorm, count: tex.length, files: tex })
        for (const t of tex) {
          try {
            const tNorm = t.replace(/\\/g, '/')
            const tUrlObj = new URL(tNorm, mUrl)
            if (!tUrlObj.search) tUrlObj.search = baseQS
            const tUrl = tUrlObj.toString()
            const tRes = await fetch(tUrl, { headers })
            if (debugEnabled) pushStep({ action: 'fetch_texture', name: tNorm, url: redactUrl(tUrl), status: tRes.status, ok: tRes.ok })
            if (!tRes.ok) continue
            const buf = new Uint8Array(await tRes.arrayBuffer())
            const tKey = buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(tNorm)}` })
            await storage.uploadFile({ body: Buffer.from(buf), key: tKey, disposition: 'attachment' })
            if (debugEnabled) dbg.uploads.push({ key: tKey, type: 'texture' })
          } catch {}
        }
        fetchedMtls.push(m)
      } catch {}
    }
    return { ok: true, debug: dbg }
  } catch (e) {
    return { ok: false, debug: { error: (e as any)?.message || String(e) } }
  }
}

function replaceExt(u: string, ext: 'obj'): string | null {
  try {
    const url = new URL(u)
    const segs = url.pathname.split('/')
    const last = segs[segs.length - 1]
    if (!last.includes('.')) return null
    const base = last.substring(0, last.lastIndexOf('.'))
    segs[segs.length - 1] = `${base}.${ext}`
    url.pathname = segs.join('/')
    return url.toString()
  } catch { return null }
}

function parseMtllib(objText: string): string[] {
  const set = new Set<string>()
  for (const line of objText.split(/\r?\n/)) {
    const t = line.trim()
    if (t.toLowerCase().startsWith('mtllib ')) {
      const parts = t.split(/\s+/).slice(1).filter(Boolean)
      for (const p of parts) set.add(p)
    }
  }
  return [...set]
}
function parseTextures(mtlText: string): string[] {
  const set = new Set<string>()
  for (const line of mtlText.split(/\r?\n/)) {
    const t = line.trim()
    const lower = t.toLowerCase()
    if (lower.startsWith('map_') || lower.startsWith('bump') || lower.startsWith('disp')) {
      const parts = t.split(/\s+/).filter(Boolean)
      const cand = parts.filter(x => !x.startsWith('-')).pop()
      if (cand) set.add(cand)
    }
  }
  return [...set]
}
function sanitize(name: string) {
  // remove query/hash, leading slashes, backslashes, and parent traversal
  const noQuery = dropQueryAndHash(name)
  return noQuery.replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.+\//g, '')
}
function dropQueryAndHash(s: string) {
  return s.split('?')[0].split('#')[0]
}

function redactUrl(u: string) {
  try {
    const url = new URL(u)
    const q = url.search
    if (!q) return `${url.origin}${url.pathname}`
    return `${url.origin}${url.pathname}?…`
  } catch { return 'invalid-url' }
}
