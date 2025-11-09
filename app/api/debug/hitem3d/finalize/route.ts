import { getUserUuid } from '@/services/user'
import { findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { getUuid } from '@/lib/hash'
import { insertAsset, findAssetByTaskId, updateAssetByUuid } from '@/models/asset'

// Convenience GET endpoint to finalize by task_id via query param for debugging.
// Usage: /api/debug/hitem3d/finalize?task_id=...
export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const url = new URL(req.url)
    const task_id = url.searchParams.get('task_id') || ''
    if (!task_id) return Response.json({ code: -1, message: 'task_id required' }, { status: 400 })

    const task = await findGenerationTaskByTaskId(task_id)
    if (!task || task.user_uuid !== user_uuid) return Response.json({ code: -1, message: 'not found' }, { status: 404 })

    const vendor = await queryTask(task_id)
    if (vendor.state !== 'success') {
      return Response.json({ code: 0, data: { state: vendor.state } }, { status: 202 })
    }

    const cover_url = vendor.cover_url
    const file_url = vendor.url
    const storage = newStorage()
    const asset_uuid = getUuid()

    // headers: mimic browser; do not send referer/origin unless configured
    const baseHeaders = () => {
      const headers: Record<string, string> = {}
      if (process.env.HITEM3D_REFERER) {
        headers['Referer'] = process.env.HITEM3D_REFERER
        headers['Origin'] = process.env.HITEM3D_REFERER
      }
      headers['User-Agent'] = process.env.HITEM3D_UA || 'Mozilla/5.0'
      headers['Accept'] = '*/*'
      headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
      return headers
    }

    // cover
    let cover_key: string | undefined
    if (cover_url) {
      const ext = (new URL(cover_url).pathname.split('.').pop() || 'webp').toLowerCase()
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `cover.${ext}` })
      const ctypeMap: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
      await storage.downloadAndUpload({ url: cover_url, key, disposition: 'inline', headers: baseHeaders(), contentType: ctypeMap[ext] })
      cover_key = key
    }

    // file
    let file_key_full: string | undefined
    if (file_url) {
      const ext = (new URL(file_url).pathname.split('.').pop() || 'glb').toLowerCase()
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `file.${ext}` })
      const ctype = ext === 'glb' ? 'model/gltf-binary' : undefined
      await storage.downloadAndUpload({ url: file_url, key, disposition: 'attachment', headers: baseHeaders(), contentType: ctype })
      file_key_full = key
    }

    // Upsert asset
    const existing = await findAssetByTaskId(task.task_id)
    if (existing && !existing.file_key_full) {
      await updateAssetByUuid(existing.uuid, {
        status: 'active',
        cover_key,
        file_key_full,
        file_format: file_key_full ? (file_key_full.split('.').pop() || '') : undefined,
        task_id: task.task_id,
        user_uuid: task.user_uuid,
        updated_at: new Date().toISOString(),
      } as any)
    } else if (!existing) {
      await insertAsset({
        uuid: asset_uuid,
        user_uuid: task.user_uuid,
        task_id: task.task_id,
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

    return Response.json({ code: 0, data: { asset_uuid: existing?.uuid || asset_uuid } })
  } catch (e: any) {
    return Response.json({ code: -1, message: e?.message || 'debug finalize failed' }, { status: 500 })
  }
}

