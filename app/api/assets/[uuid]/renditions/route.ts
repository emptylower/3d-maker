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
    if (existing && (existing.state === 'processing' || existing.state === 'success')) {
      return Response.json({ code: 0, data: { state: existing.state, task_id: existing.task_id || undefined } }, { status: 200 })
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
    const filename = chosen.isZip ? `file.${fmt}.zip` : `file.${fmt}`
    const key = buildAssetKey({ user_uuid, asset_uuid, filename })
    await storage.downloadAndUpload({ url: chosen.url, key, disposition: 'attachment', headers, contentType: chosen.isZip ? 'application/zip' : undefined })
    await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'success', file_key: key, credits_charged: 0, error: null })
    return 'success'
  } catch (e) {
    try { await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'processing', credits_charged: 0, error: 'exception' }) } catch {}
    return 'processing'
  }
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
