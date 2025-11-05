import { getUserUuid } from '@/services/user'
import { findAssetByUuid } from '@/models/asset'
import { findRendition, upsertRendition } from '@/models/asset-rendition'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'

type Fmt = 'obj' | 'glb' | 'stl' | 'fbx'

function isFmt(v: any): v is Fmt {
  return v === 'obj' || v === 'glb' || v === 'stl' || v === 'fbx'
}

export async function POST(req: Request, ctx: any) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })

    const { uuid } = ctx?.params || {}
    const asset = await findAssetByUuid(uuid)
    if (!asset) return Response.json({ code: -1, message: 'not found' }, { status: 404 })
    if (asset.user_uuid !== user_uuid) return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const fmt = String(body?.format || '')
    const with_texture = Boolean(body?.with_texture) === true
    if (!isFmt(fmt)) return Response.json({ code: -1, message: 'invalid format' }, { status: 400 })

    const existing = await findRendition(asset.uuid, fmt, with_texture)
    if (existing && existing.state === 'success') {
      // Special case: repackage OBJ plain file into zip when needed
      if (fmt === 'obj' && existing.file_key && existing.file_key.endsWith('.obj')) {
        try {
          const repacked = await repackageObjFromStorage(asset.user_uuid, asset.uuid, existing.file_key)
          if (repacked) {
            await upsertRendition({ asset_uuid: asset.uuid, format: fmt, with_texture, state: 'success', file_key: repacked, credits_charged: 0, error: null })
          }
        } catch {}
      }
      return Response.json({ code: 0, data: { state: 'success', task_id: existing.task_id || undefined } }, { status: 200 })
    }
    if (existing && existing.state === 'processing') {
      return Response.json({ code: 0, data: { state: 'processing', task_id: existing.task_id || undefined } }, { status: 200 })
    }

    // Instant-ready optimization: when requesting the same format as original and texture=false
    const instantReady = (process.env.RENDITIONS_INSTANT_READY_FOR_ORIGINAL || '0') === '1'
    const sameAsOriginal = asset.file_format && asset.file_key_full && asset.file_format.toLowerCase() === fmt && with_texture === false
    if (instantReady && sameAsOriginal) {
      await upsertRendition({ asset_uuid: asset.uuid, format: fmt, with_texture, state: 'success', file_key: asset.file_key_full, credits_charged: 0 })
      return Response.json({ code: 0, data: { state: 'success' } }, { status: 200 })
    }

    // create or move to processing. No credits charged here per rules.
    await upsertRendition({ asset_uuid: asset.uuid, format: fmt, with_texture, state: 'processing', credits_charged: 0, error: null })
    // Option B: try vendor direct URL replacement immediately (best-effort)
    try {
      const tried = await tryFetchVendorFormat(asset.user_uuid, asset.uuid, asset.task_id || '', fmt as any)
      if (tried === 'success') {
        return Response.json({ code: 0, data: { state: 'success' } }, { status: 200 })
      }
    } catch {}
    return Response.json({ code: 0, data: { state: 'processing' } }, { status: 202 })
  } catch (e) {
    console.error('renditions POST error:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

export async function GET(req: Request, ctx: any) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const { uuid } = ctx?.params || {}
    const asset = await findAssetByUuid(uuid)
    if (!asset) return Response.json({ code: -1, message: 'not found' }, { status: 404 })
    if (asset.user_uuid !== user_uuid) return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })

    const url = new URL(req.url)
    const fmt = url.searchParams.get('format') || ''
    const wt = url.searchParams.get('with_texture') || 'false'
    const with_texture = wt === 'true'
    if (!isFmt(fmt)) return Response.json({ code: -1, message: 'invalid format' }, { status: 400 })

    const existing = await findRendition(asset.uuid, fmt as Fmt, with_texture)
    if (existing?.state === 'success') return Response.json({ code: 0, data: { state: 'success' } })
    // Option B: attempt when polling and no previous error
    if (with_texture === false && (!existing || !existing.error)) {
      try {
        const tried = await tryFetchVendorFormat(asset.user_uuid, asset.uuid, asset.task_id || '', fmt as Fmt)
        if (tried === 'success') return Response.json({ code: 0, data: { state: 'success' } })
      } catch {}
    }
    const state = existing?.state || 'created'
    return Response.json({ code: 0, data: { state } })
  } catch (e) {
    console.error('renditions GET error:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

async function tryFetchVendorFormat(user_uuid: string, asset_uuid: string, task_id: string, fmt: Fmt) {
  try {
    if (!task_id) return 'skip'
    const task = await findGenerationTaskByTaskId(task_id)
    const vendorUrl = task?.hitem3d_file_url || ''
    if (!vendorUrl) return 'skip'
    const candidates = buildCandidateUrls(vendorUrl, fmt)
    if (!candidates.length) return 'skip'

    let chosen: { url: string; isZip: boolean } | null = null
    for (const c of candidates) {
      try {
        const origin = new URL(c.url).origin
        const headers: Record<string, string> = {}
        headers['Referer'] = process.env.HITEM3D_REFERER || origin
        headers['Origin'] = process.env.HITEM3D_REFERER || origin
        headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
        if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
        const head = await fetch(c.url, { method: 'HEAD', headers })
        if (head.ok) { chosen = c; break }
        const get = await fetch(c.url, { method: 'GET', headers })
        if (get.ok) { chosen = c; break }
      } catch {}
    }
    if (!chosen) {
      await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'processing', credits_charged: 0, error: 'not_found' })
      return 'processing'
    }

    const origin = new URL(chosen.url).origin
    const headers: Record<string, string> = {}
    headers['Referer'] = process.env.HITEM3D_REFERER || origin
    headers['Origin'] = process.env.HITEM3D_REFERER || origin
    headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
    if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID

    const storage = newStorage()
    // If plain OBJ and supplier has no zip, attempt to package OBJ+MTL+textures into zip
    if (!chosen.isZip && fmt === 'obj') {
      try {
        const objRes = await fetch(chosen.url, { headers })
        if (!objRes.ok) throw new Error('obj_get_failed')
        const objText = await objRes.text()
        const { files, anyExtra } = await collectObjPackageFiles(objText, chosen.url, headers)
        // Always include the OBJ itself (use base name from URL)
        const objName = new URL(chosen.url).pathname.split('/').pop() || 'model.obj'
        files.unshift({ name: sanitizeZipPath(objName), data: new TextEncoder().encode(objText) })
        const zipData = buildZip(files)
        const key = buildAssetKey({ user_uuid, asset_uuid, filename: `file.obj.zip` })
        await storage.uploadFile({ body: Buffer.from(zipData), key, contentType: 'application/zip', disposition: 'attachment' })
        await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'success', file_key: key, credits_charged: 0, error: null })
        return 'success'
      } catch {
        // fallback: still package as zip with only OBJ
        try {
          const objRes2 = await fetch(chosen.url, { headers })
          if (!objRes2.ok) throw new Error('obj_get_failed')
          const objText2 = await objRes2.text()
          const objName2 = new URL(chosen.url).pathname.split('/').pop() || 'model.obj'
          const zipData2 = buildZip([{ name: sanitizeZipPath(objName2), data: new TextEncoder().encode(objText2) }])
          const key2 = buildAssetKey({ user_uuid, asset_uuid, filename: `file.obj.zip` })
          await storage.uploadFile({ body: Buffer.from(zipData2), key: key2, contentType: 'application/zip', disposition: 'attachment' })
          await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'success', file_key: key2, credits_charged: 0, error: null })
          return 'success'
        } catch {
          const key = buildAssetKey({ user_uuid, asset_uuid, filename: `file.${fmt}` })
          await storage.downloadAndUpload({ url: chosen.url, key, disposition: 'attachment', headers })
          await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'success', file_key: key, credits_charged: 0, error: null })
          return 'success'
        }
      }
    } else {
      const filename = chosen.isZip ? `file.${fmt}.zip` : `file.${fmt}`
      const key = buildAssetKey({ user_uuid, asset_uuid, filename })
      await storage.downloadAndUpload({ url: chosen.url, key, disposition: 'attachment', headers, contentType: chosen.isZip ? 'application/zip' : undefined })
      await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'success', file_key: key, credits_charged: 0, error: null })
      return 'success'
    }
    // unreachable
    // return 'success'
  } catch (e) {
    try { await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'processing', credits_charged: 0, error: 'exception' }) } catch {}
    return 'processing'
  }
}

async function repackageObjFromStorage(user_uuid: string, asset_uuid: string, file_key: string): Promise<string | null> {
  try {
    const storage = newStorage()
    const { url } = await storage.getSignedUrl({ key: file_key })
    const res = await fetch(url)
    if (!res.ok) return null
    const objText = await res.text()
    const baseName = file_key.split('/').pop() || 'file.obj'
    const zip = buildZip([{ name: sanitizeZipPath(baseName), data: new TextEncoder().encode(objText) }])
    const newKey = file_key.replace(/\.obj$/i, '.obj.zip')
    await storage.uploadFile({ body: Buffer.from(zip), key: newKey, contentType: 'application/zip', disposition: 'attachment' })
    return newKey
  } catch { return null }
}

function buildCandidateUrls(u: string, fmt: Fmt): Array<{ url: string; isZip: boolean }> {
  try {
    const url = new URL(u)
    const segs = url.pathname.split('/')
    const last = segs[segs.length - 1]
    if (!last.includes('.')) return []
    const base = last.substring(0, last.lastIndexOf('.'))
    const dir = segs.slice(0, -1).join('/')
    const plain = new URL(url.toString()); plain.pathname = `${dir}/${base}.${fmt}`
    const z1 = new URL(url.toString()); z1.pathname = `${dir}/${base}.${fmt}.zip`
    const z2 = new URL(url.toString()); z2.pathname = `${dir}/${base}.zip`
    return [
      { url: z1.toString(), isZip: true },
      { url: z2.toString(), isZip: true },
      { url: plain.toString(), isZip: false },
    ]
  } catch { return [] }
}

function sanitizeZipPath(name: string): string {
  return name.replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.+\//g, '')
}

async function collectObjPackageFiles(objText: string, objUrl: string, headers: Record<string, string>) {
  const base = new URL(objUrl)
  const mtlFiles = new Set<string>()
  const texFiles = new Set<string>()
  const lines = objText.split(/\r?\n/)
  for (const line of lines) {
    const t = line.trim()
    if (t.toLowerCase().startsWith('mtllib ')) {
      const parts = t.split(/\s+/).slice(1).filter(Boolean)
      for (const p of parts) mtlFiles.add(p)
    }
  }
  const files: Array<{ name: string; data: Uint8Array }> = []
  const te = new TextEncoder()
  for (const mtl of mtlFiles) {
    try {
      const url = new URL(mtl, base)
      const res = await fetch(url.toString(), { headers })
      if (!res.ok) continue
      const txt = await res.text()
      files.push({ name: sanitizeZipPath(mtl), data: te.encode(txt) })
      // parse textures
      const tl = txt.split(/\r?\n/)
      for (const l of tl) {
        const s = l.trim()
        const lower = s.toLowerCase()
        if (lower.startsWith('map_') || lower.startsWith('bump') || lower.startsWith('disp')) {
          const tokens = s.split(/\s+/).filter(Boolean)
          const cand = tokens.filter(x => !x.startsWith('-')).pop()
          if (cand) texFiles.add(cand)
        }
      }
    } catch {}
  }
  // fetch textures
  for (const tex of texFiles) {
    try {
      const url = new URL(tex, base)
      const res = await fetch(url.toString(), { headers })
      if (!res.ok) continue
      const buf = new Uint8Array(await res.arrayBuffer())
      files.push({ name: sanitizeZipPath(tex), data: buf })
    } catch {}
  }
  return { files, anyExtra: files.length > 0 }
}

// Minimal ZIP generator (store method, no compression, with central directory)
function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder()
  const LFH = 0x04034b50
  const CDH = 0x02014b50
  const EOCD = 0x06054b50
  const version = 20
  const now = new Date()
  const dosTime = toDosTime(now)
  const dosDate = toDosDate(now)
  let offset = 0
  const records: any[] = []
  const chunks: Uint8Array[] = []

  const push = (arr: number[]) => { const u = new Uint8Array(arr); chunks.push(u); offset += u.length }
  const pushBuf = (buf: Uint8Array) => { chunks.push(buf); offset += buf.length }

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc = crc32(f.data)
    const localHeader = [] as number[]
    // Local File Header
    localHeader.push(
      ...u32(LFH),            // signature
      ...u16(version),        // version needed to extract
      ...u16(0),              // general purpose bit flag
      ...u16(0),              // compression method (store)
      ...u16(dosTime),        // last mod file time
      ...u16(dosDate),        // last mod file date
    )
    localHeader.push(...u32(crc), ...u32(f.data.length), ...u32(f.data.length))
    localHeader.push(...u16(nameBytes.length), ...u16(0))
    const localOffset = offset
    push(localHeader)
    pushBuf(nameBytes)
    pushBuf(f.data)

    records.push({ nameBytes, crc, size: f.data.length, offset: localOffset })
  }

  const cdStart = offset
  for (const r of records) {
    const cd = [] as number[]
    cd.push(
      ...u32(CDH),        // signature
      ...u16(version),    // version made by
      ...u16(version),    // version needed to extract
      ...u16(0),          // general purpose bit flag
      ...u16(0),          // compression method
      ...u16(dosTime),    // last mod time
      ...u16(dosDate),    // last mod date
      ...u32(r.crc),
      ...u32(r.size),     // comp size
      ...u32(r.size),     // uncomp size
      ...u16(r.nameBytes.length), // file name length
      ...u16(0),          // extra length
      ...u16(0),          // file comment length
      ...u16(0),          // disk number start
      ...u16(0),          // internal file attrs
      ...u32(0),          // external file attrs
      ...u32(r.offset),   // relative offset of local header
    )
    push(cd)
    pushBuf(r.nameBytes)
  }
  const cdSize = offset - cdStart
  const eocd = [] as number[]
  eocd.push(
    ...u32(EOCD),
    ...u16(0),                 // number of this disk
    ...u16(0),                 // number of the disk with the start of the central directory
    ...u16(records.length),    // total entries on this disk
    ...u16(records.length),    // total entries
  )
  eocd.push(...u32(cdSize), ...u32(cdStart), ...u16(0))
  push(eocd)

  // join chunks
  let total = 0; for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) { out.set(c, pos); pos += c.length }
  return out
}

function u16(n: number) { return [n & 0xff, (n >>> 8) & 0xff] }
function u32(n: number) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff] }

function crc32(data: Uint8Array): number {
  let c = ~0 >>> 0
  for (let i = 0; i < data.length; i++) {
    c = (c >>> 8) ^ CRC32_TABLE[(c ^ data[i]) & 0xff]
  }
  return (~c) >>> 0
}

const CRC32_TABLE = (() => {
  const t = new Array<number>(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c >>> 0
  }
  return t
})()

function toDosTime(d: Date): number {
  const sec = Math.floor(d.getSeconds() / 2)
  const min = d.getMinutes()
  const hr = d.getHours()
  return (hr << 11) | (min << 5) | sec
}
function toDosDate(d: Date): number {
  const year = d.getFullYear() - 1980
  const month = d.getMonth() + 1
  const day = d.getDate()
  return (year << 9) | (month << 5) | day
}
