import { getUserUuid } from '@/services/user'
import { findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { getUuid } from '@/lib/hash'
import { insertAsset, findAssetByTaskId, updateAssetByUuid } from '@/models/asset'

export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const task_id = String(body?.task_id || '')
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

    // cover
    let cover_key: string | undefined
    if (cover_url) {
      const ext = (new URL(cover_url).pathname.split('.').pop() || 'webp').toLowerCase()
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `cover.${ext}` })
      const coverOrigin = new URL(cover_url).origin
      const headers: Record<string, string> = {}
      headers['Referer'] = process.env.HITEM3D_REFERER || coverOrigin
      headers['Origin'] = process.env.HITEM3D_REFERER || coverOrigin
      headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
      if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
      await storage.downloadAndUpload({ url: cover_url, key, disposition: 'inline', headers })
      cover_key = key
    }

    // file
    let file_key_full: string | undefined
    if (file_url) {
      const ext = (new URL(file_url).pathname.split('.').pop() || 'glb').toLowerCase()
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `file.${ext}` })
      const fileOrigin = new URL(file_url).origin
      const headers: Record<string, string> = {}
      headers['Referer'] = process.env.HITEM3D_REFERER || fileOrigin
      headers['Origin'] = process.env.HITEM3D_REFERER || fileOrigin
      headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
      if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID
      await storage.downloadAndUpload({ url: file_url, key, disposition: 'attachment', headers })
      file_key_full = key
    }

    // If an existing asset with same task_id exists but without file, update it; else insert new
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
    } else {
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

    return Response.json({ code: 0, data: { asset_uuid } })
  } catch (e: any) {
    console.error('finalize failed:', e)
    const msg = e?.message || 'finalize failed'
    // 直出关键信息便于预发排查（如 Bucket is required）
    return Response.json({ code: -1, message: msg }, { status: 500 })
  }
}
