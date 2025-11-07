import { getUserUuid } from '@/services/user'
import { findAssetByUuid } from '@/models/asset'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { inflateRawSync } from 'zlib'

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

    // materialize if not exists (or only zip present)
    let keys = await storage.listObjects({ prefix })
    let debugInfo: any | undefined
    const hasRenderable = (arr: string[]) => arr.some(k => /\/obj\/[^/]+\.(obj|mtl|png|jpe?g|webp)$/i.test(k))
    if (!keys || keys.length === 0 || !hasRenderable(keys)) {
      const res = await materializeObjFiles(asset.user_uuid, asset.uuid, asset.task_id || '', debugEnabled)
      debugInfo = res.debug
      if (res.ok) keys = await storage.listObjects({ prefix })
      // As a fallback, try to extract from existing zip in R2 (file.obj.zip under root or obj/)
      if ((!keys || keys.length === 0 || !hasRenderable(keys))) {
        const extracted = await tryExtractFromExistingZipInStorage(asset.user_uuid, asset.uuid, debugEnabled)
        if (debugEnabled) {
          debugInfo = debugInfo || {}
          debugInfo.extract_from_storage = extracted
        }
        if (extracted?.ok) keys = await storage.listObjects({ prefix })
      }
    }

    if (!keys || keys.length === 0) {
      const payload: any = { code: -1, message: 'files not available' }
      if (debugEnabled) payload.debug = debugInfo || { note: 'no keys after materialize attempt' }
      return Response.json(payload, { status: 404 })
    }

    // sign
    const files: Array<{ name: string; url: string }> = []
    for (const key of keys.filter(k => /\/obj\/[^/]+\.(obj|mtl|png|jpe?g|webp)$/i.test(k))) {
      const rawName = key.substring(prefix.length)
      const cleanName = dropQueryAndHash(rawName)
      const lower = cleanName.toLowerCase()
      // For preview subresources, prefer inline to avoid browsers treating as download
      const inline = (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.obj') || lower.endsWith('.mtl'))
      const disp = inline ? `inline; filename=${encodeURIComponent(cleanName)}` : `attachment; filename=${encodeURIComponent(cleanName)}`
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
    // Try vendor-provided ZIP first (common for OBJ+MTL+textures)
    const zipCandidates = buildZipCandidates(baseUrl)
    if (debugEnabled) pushStep({ action: 'zip_candidates', urls: zipCandidates.map(redactUrl) })
    for (const z of zipCandidates) {
      try {
        const head = await fetch(z, { method: 'HEAD', headers })
        if (debugEnabled) pushStep({ action: 'fetch_zip_head', url: redactUrl(z), status: head.status, ok: head.ok })
        let ok = head.ok
        if (!ok) {
          const get = await fetch(z, { method: 'GET', headers })
          if (debugEnabled) pushStep({ action: 'fetch_zip_get', url: redactUrl(z), status: get.status, ok: get.ok })
          ok = get.ok
        }
        if (!ok) continue
        const keyZip = buildAssetKey({ user_uuid, asset_uuid, filename: `obj/file.obj.zip` })
        await storage.downloadAndUpload({ url: z, key: keyZip, disposition: 'attachment', headers, contentType: 'application/zip' })
        if (debugEnabled) dbg.uploads.push({ key: keyZip, type: 'zip-pass-through' })
        // Try extract zip entries to obj/
        try {
          const res = await extractZipKeyToObj(user_uuid, asset_uuid, keyZip, debugEnabled)
          if (debugEnabled) dbg.uploads.push({ extracted: res?.count || 0 })
        } catch {}
        return { ok: true, debug: dbg }
      } catch {}
    }
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
    const objBaseName = (objPathSeg.replace(/\.[^.]+$/i, '') || '0')
    if (mtlFiles.length === 0) {
      const guess = objBaseName + '.mtl'
      mtlFiles = [guess]
    }
    if (debugEnabled) pushStep({ action: 'parse_mtllib', count: mtlFiles.length, files: mtlFiles })
    // Build candidate mtl names: declared + <objBase>.mtl + 0.mtl + materials.mtl (dedup)
    const mtlNameCandidates = Array.from(new Set<string>([
      ...mtlFiles,
      `${objBaseName}.mtl`,
      `0.mtl`,
      `materials.mtl`,
    ]))
    if (debugEnabled) pushStep({ action: 'mtl_candidates', items: mtlNameCandidates })
    const fetchedMtls: string[] = []
    for (const m of mtlNameCandidates) {
      try {
        const mNorm = m.replace(/\\/g, '/')
        const candidateUrls = buildMtlUrlCandidates(objUrl, mNorm)
        if (debugEnabled) pushStep({ action: 'mtl_candidate_urls', name: mNorm, urls: candidateUrls.map(redactUrl) })
        for (const raw of candidateUrls) {
          try {
            const mUrlObj = new URL(raw)
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
            break
          } catch {}
        }
      } catch {}
    }
    return { ok: true, debug: dbg }
  } catch (e) {
    return { ok: false, debug: { error: (e as any)?.message || String(e) } }
  }
}

async function tryExtractFromExistingZipInStorage(user_uuid: string, asset_uuid: string, debugEnabled = false): Promise<{ ok: boolean; count?: number; note?: string }> {
  try {
    const storage = newStorage()
    const basePrefix = `assets/${user_uuid}/${asset_uuid}/`
    const keys = await storage.listObjects({ prefix: basePrefix })
    const candidates = (keys || []).filter(k => /\/file\.obj\.zip$/i.test(k) || /\/obj\/file\.obj\.zip$/i.test(k))
    if (!candidates.length) return { ok: false, note: 'no_zip_found' }
    let total = 0
    for (const zipKey of candidates) {
      try {
        const r = await extractZipKeyToObj(user_uuid, asset_uuid, zipKey, debugEnabled)
        total += r?.count || 0
      } catch {}
    }
    return { ok: total > 0, count: total }
  } catch (e) {
    return { ok: false, note: 'exception' }
  }
}

async function extractZipKeyToObj(user_uuid: string, asset_uuid: string, zipKey: string, debugEnabled = false): Promise<{ count: number }> {
  const storage = newStorage()
  const { url } = await storage.getSignedUrl({ key: zipKey })
  const res = await fetch(url)
  if (!res.ok) throw new Error('zip_fetch_failed')
  const buf = new Uint8Array(await res.arrayBuffer())
  const entries = unzipEntries(buf)
  let count = 0
  for (const e of entries) {
    const name = dropQueryAndHash(e.name)
    if (!/\.(obj|mtl|png|jpe?g|webp)$/i.test(name)) continue
    const key = buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(name)}` })
    const lower = name.toLowerCase()
    let contentType: string | undefined
    if (lower.endsWith('.png')) contentType = 'image/png'
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg'
    else if (lower.endsWith('.webp')) contentType = 'image/webp'
    else if (lower.endsWith('.obj') || lower.endsWith('.mtl')) contentType = 'text/plain'
    await storage.uploadFile({ body: Buffer.from(e.data), key, disposition: 'attachment', contentType })
    count++
  }
  return { count }
}

type ZipEntry = { name: string; data: Uint8Array }
function unzipEntries(data: Uint8Array): ZipEntry[] {
  const sigEOCD = 0x06054b50
  const sigCDH = 0x02014b50
  const sigLFH = 0x04034b50
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  // find EOCD by scanning backwards (max comment 64k)
  const maxBack = Math.min(data.byteLength, 0xffff + 22)
  let eocdPos = -1
  for (let i = data.byteLength - 22; i >= data.byteLength - maxBack; i--) {
    if (i < 0) break
    if (dv.getUint32(i, true) === sigEOCD) { eocdPos = i; break }
  }
  if (eocdPos < 0) return []
  const cdSize = dv.getUint32(eocdPos + 12, true)
  const cdOffset = dv.getUint32(eocdPos + 16, true)
  const out: ZipEntry[] = []
  let p = cdOffset
  while (p < cdOffset + cdSize) {
    if (dv.getUint32(p, true) !== sigCDH) break
    const compMethod = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const unCompSize = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const lfhOffset = dv.getUint32(p + 42, true)
    const nameBytes = data.slice(p + 46, p + 46 + nameLen)
    const name = new TextDecoder().decode(nameBytes)
    p += 46 + nameLen + extraLen + commentLen
    // read local header to get data start
    if (dv.getUint32(lfhOffset, true) !== sigLFH) continue
    const nlen = dv.getUint16(lfhOffset + 26, true)
    const xlen = dv.getUint16(lfhOffset + 28, true)
    const dataStart = lfhOffset + 30 + nlen + xlen
    const comp = data.slice(dataStart, dataStart + compSize)
    let body: Uint8Array | null = null
    if (compMethod === 0) {
      body = comp
    } else if (compMethod === 8) {
      try {
        const inflated = inflateRawSync(Buffer.from(comp))
        body = new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.length)
      } catch {
        body = null
      }
    }
    if (body && body.length === unCompSize) {
      out.push({ name, data: body })
    } else if (body) {
      // still push when sizes mismatch; many tools omit sizes in LFH
      out.push({ name, data: body })
    }
  }
  return out
}

function replaceExt(u: string, ext: 'obj'): string | null {
  try {
    const url = new URL(u)
    const segs = url.pathname.split('/')
    const last = segs[segs.length - 1]
    if (!last.includes('.')) return null
    // Strip known extensions (e.g., .obj.zip -> base)
    const known = new Set(['zip', 'obj', 'glb', 'stl', 'fbx'])
    let name = last
    for (let i = 0; i < 2; i++) {
      const idx = name.lastIndexOf('.')
      if (idx === -1) break
      const e = name.substring(idx + 1).toLowerCase()
      if (known.has(e)) { name = name.substring(0, idx) } else { break }
    }
    segs[segs.length - 1] = `${name}.${ext}`
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

function buildMtlUrlCandidates(objUrl: string, mtlName: string): string[] {
  try {
    const base = new URL(objUrl)
    // same directory as OBJ
    const same = new URL(mtlName, base).toString()
    // heuristic: vendor sometimes places MTL in target/original (drop 'model' segment)
    const alt = new URL(base.toString())
    alt.pathname = alt.pathname.replace('/model/', '/')
    const altUrl = new URL(mtlName, alt).toString()
    const set = new Set<string>([same, altUrl])
    return Array.from(set)
  } catch { return [] }
}

function buildZipCandidates(vendorUrl: string): string[] {
  try {
    const u = new URL(vendorUrl)
    const segs = u.pathname.split('/')
    const last = segs[segs.length - 1]
    if (!last.includes('.')) return []
    const known = new Set(['zip', 'obj', 'glb', 'stl', 'fbx'])
    let name = last
    for (let i = 0; i < 2; i++) {
      const idx = name.lastIndexOf('.')
      if (idx === -1) break
      const e = name.substring(idx + 1).toLowerCase()
      if (known.has(e)) { name = name.substring(0, idx) } else { break }
    }
    const dir = segs.slice(0, -1).join('/')
    const z1 = new URL(u.toString()); z1.pathname = `${dir}/${name}.obj.zip`
    const z2 = new URL(u.toString()); z2.pathname = `${dir}/${name}.zip`
    const out = [z1.toString()]
    if (z2.toString() !== z1.toString()) out.push(z2.toString())
    return out
  } catch { return [] }
}
