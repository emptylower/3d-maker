import { listSuccessTasksWithoutAsset, findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { getUuid } from '@/lib/hash'
import { insertAsset, findAssetByTaskId, updateAssetByUuid } from '@/models/asset'
import { upsertRendition } from '@/models/asset-rendition'

function allowedByHeader(req: Request) {
  // Vercel Cron will include x-vercel-cron header. We also allow optional token via query (?token=...)
  const isCron = req.headers.get('x-vercel-cron') !== null
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const expect = process.env.AUTO_FINALIZE_TOKEN || ''
  if (expect && token === expect) return true
  return isCron
}

export async function GET(req: Request) {
  try {
    if (!allowedByHeader(req)) return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })
    const url = new URL(req.url)
    const limitEnv = Number(process.env.AUTO_FINALIZE_LIMIT) || 20
    const limit = Number(url.searchParams.get('limit')) || limitEnv

    const rows = await listSuccessTasksWithoutAsset(limit)
    const storage = newStorage()
    const processed: any[] = []
    const errors: any[] = []

    for (const r of rows) {
      const task_id = r.task_id
      try {
        const task = await findGenerationTaskByTaskId(task_id)
        if (!task) { processed.push({ task_id, status: 'skip_no_task' }); continue }
        const vendor = await queryTask(task_id)
        if (vendor.state !== 'success') { processed.push({ task_id, status: 'skip_state_'+vendor.state }); continue }

        const user_uuid = task.user_uuid
        const asset_uuid = getUuid()
        const cover_url = vendor.cover_url
        const file_url = vendor.url

        let cover_key: string | undefined
        if (cover_url) {
          const ext = (new URL(cover_url).pathname.split('.').pop() || 'webp').toLowerCase()
          const key = buildAssetKey({ user_uuid, asset_uuid, filename: `cover.${ext}` })
          const origin = new URL(cover_url).origin
          const headers: Record<string, string> = {}
          headers['Referer'] = process.env.HITEM3D_REFERER || origin
          headers['Origin'] = process.env.HITEM3D_REFERER || origin
          headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
          if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
          await storage.downloadAndUpload({ url: cover_url, key, disposition: 'inline', headers })
          cover_key = key
        }

        let file_key_full: string | undefined
        if (file_url) {
          const ext = (new URL(file_url).pathname.split('.').pop() || 'glb').toLowerCase()
          const key = buildAssetKey({ user_uuid, asset_uuid, filename: `file.${ext}` })
          const origin = new URL(file_url).origin
          const headers: Record<string, string> = {}
          headers['Referer'] = process.env.HITEM3D_REFERER || origin
          headers['Origin'] = process.env.HITEM3D_REFERER || origin
          headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
          if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
          await storage.downloadAndUpload({ url: file_url, key, disposition: 'attachment', headers })
          file_key_full = key
        }

        const existing = await findAssetByTaskId(task_id)
        if (existing && !existing.file_key_full) {
          await updateAssetByUuid(existing.uuid, {
            status: 'active',
            cover_key,
            file_key_full,
            file_format: file_key_full ? (file_key_full.split('.').pop() || '') : undefined,
            task_id,
            user_uuid,
            updated_at: new Date().toISOString(),
          } as any)
        } else {
          await insertAsset({
            uuid: asset_uuid,
            user_uuid,
            task_id,
            status: 'active',
            cover_key,
            file_key_full,
            file_format: file_key_full ? (file_key_full.split('.').pop() || '') : undefined,
            created_at: new Date().toISOString(),
          } as any)
        }

        await updateGenerationTask(task_id, {
          state: 'success',
          hitem3d_cover_url: cover_url,
          hitem3d_file_url: file_url,
          callback_received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)

        // Auto-complete other formats best-effort
        try {
          const originalExt = (file_key_full?.split('.').pop() || '').toLowerCase()
          const fmts: Array<'obj' | 'glb' | 'stl' | 'fbx'> = ['obj', 'glb', 'stl', 'fbx']
          const toTry = fmts.filter((f) => f !== originalExt)
          await Promise.allSettled(toTry.map((fmt) => tryFetchVendorFormat(task.user_uuid, existing?.uuid || asset_uuid, task.task_id, fmt)))
        } catch {}

        processed.push({ task_id, status: 'ok' })
      } catch (e: any) {
        errors.push({ task_id, error: e?.message || 'failed' })
      }
    }

    return Response.json({ code: 0, data: { total: rows.length, processed, errors } })
  } catch (e: any) {
    return Response.json({ code: -1, message: e?.message || 'cron failed' }, { status: 500 })
  }
}

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
