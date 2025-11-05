import { listSuccessTasksWithoutAsset, findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { getUuid } from '@/lib/hash'
import { insertAsset, findAssetByTaskId, updateAssetByUuid } from '@/models/asset'

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

