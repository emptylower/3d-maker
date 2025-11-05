import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { getUuid } from '@/lib/hash'
import { insertAsset } from '@/models/asset'
import { findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { upsertRendition } from '@/models/asset-rendition'
import { increaseCredits, CreditsTransType } from '@/services/credit'

type CallbackState = 'created' | 'queueing' | 'processing' | 'success' | 'failed'

type CallbackBody = {
  code?: number
  data?: {
    task_id?: string
    state?: CallbackState
    id?: string
    cover_url?: string
    url?: string
  }
  msg?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CallbackBody
    const task_id = body?.data?.task_id || ''
    const state = (body?.data?.state || '') as CallbackState
    const cover_url = body?.data?.cover_url
    const file_url = body?.data?.url

    if (!task_id || !state) {
      // bad payload, but avoid retry storm
      return Response.json({ code: 0, message: 'ignored' })
    }

    const task = await findGenerationTaskByTaskId(task_id)
    if (!task) {
      // unknown task, return 200 to stop vendor retries
      return Response.json({ code: 0, message: 'ignored' })
    }

    // idempotency guards
    if (state === 'success') {
      if (task.state === 'success') {
        return Response.json({ code: 0, message: 'ok' })
      }

      // download and upload to storage
      const storage = newStorage()
      const asset_uuid = getUuid()

      // cover
      let cover_key: string | undefined
      if (cover_url) {
        const coverExt = (new URL(cover_url).pathname.split('.').pop() || 'webp').toLowerCase()
        cover_key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `cover.${coverExt}` })
        const coverOrigin = new URL(cover_url).origin
        const headers: Record<string, string> = {}
        headers['Referer'] = process.env.HITEM3D_REFERER || coverOrigin
        headers['Origin'] = process.env.HITEM3D_REFERER || coverOrigin
        headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
        if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
        const ctypeMap: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
        await storage.downloadAndUpload({ url: cover_url, key: cover_key, disposition: 'inline', headers, contentType: ctypeMap[coverExt] })
      }

      // file
      let file_key_full: string | undefined
      if (file_url) {
        const fileExt = (new URL(file_url).pathname.split('.').pop() || 'glb').toLowerCase()
        file_key_full = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `file.${fileExt}` })
        const fileOrigin = new URL(file_url).origin
        const headers: Record<string, string> = {}
        headers['Referer'] = process.env.HITEM3D_REFERER || fileOrigin
        headers['Origin'] = process.env.HITEM3D_REFERER || fileOrigin
        headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
        if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
        const ctype = fileExt === 'glb' ? 'model/gltf-binary' : undefined
        await storage.downloadAndUpload({ url: file_url, key: file_key_full, disposition: 'attachment', headers, contentType: ctype })
      }

      // create asset record (mocked in tests)
      await insertAsset({
        uuid: asset_uuid,
        user_uuid: task.user_uuid,
        task_id: task.task_id,
        status: 'active',
        cover_key,
        file_key_full,
        file_format: file_key_full ? (file_key_full.split('.').pop() || '') : undefined,
        created_at: new Date().toISOString(),
      })

      await updateGenerationTask(task_id, {
        state: 'success',
        hitem3d_cover_url: cover_url,
        hitem3d_file_url: file_url,
        callback_received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      // Best-effort: auto-complete other formats (OBJ/GLB/STL/FBX) without charging credits
      try {
        const originalExt = (file_key_full?.split('.').pop() || '').toLowerCase()
        const fmts: Array<'obj' | 'glb' | 'stl' | 'fbx'> = ['obj', 'glb', 'stl', 'fbx']
        const toTry = fmts.filter((f) => f !== originalExt)
        await Promise.allSettled(toTry.map((fmt) => tryFetchVendorFormat(task.user_uuid, asset_uuid, task.task_id, fmt)))
      } catch {}

      return Response.json({ code: 0, message: 'ok' })
    }

    if (state === 'failed') {
      // refund once
      const alreadyRefunded = !!task.refunded
      if (!alreadyRefunded) {
        const credits = task.credits_charged || 0
        if (credits > 0) {
          await increaseCredits({ user_uuid: task.user_uuid, trans_type: CreditsTransType.SystemAdd, credits })
        }
        await updateGenerationTask(task_id, {
          state: 'failed',
          refunded: true,
          error: body?.msg || 'vendor_failed',
          callback_received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      return Response.json({ code: 0, message: 'ok' })
    }

    // queueing/processing/created -> no-op
    await updateGenerationTask(task_id, {
      state,
      callback_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    return Response.json({ code: 0, message: 'ok' })
  } catch (e) {
    console.error('callback failed:', e)
    // allow vendor retry
    return Response.json({ code: -1, message: 'callback failed' }, { status: 500 })
  }
}

// Health check for deployment self-test
export async function GET() {
  return Response.json({ ok: true })
}

// Attempt to fetch vendor-provided alternative format and persist to storage/renditions
async function tryFetchVendorFormat(user_uuid: string, asset_uuid: string, task_id: string, fmt: 'obj' | 'glb' | 'stl' | 'fbx') {
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
  } catch {
    try { await upsertRendition({ asset_uuid, format: fmt, with_texture: false, state: 'processing', credits_charged: 0, error: 'exception' }) } catch {}
    return 'processing'
  }
}

function buildCandidateUrls(u: string, fmt: 'obj' | 'glb' | 'stl' | 'fbx'): Array<{ url: string; isZip: boolean }> {
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
