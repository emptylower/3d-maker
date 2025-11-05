import { getUserInfo } from '@/services/user'
import { findGenerationTaskByTaskId, listSuccessTasksWithoutAsset, updateGenerationTask } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'
import { newStorage } from '@/lib/storage'
import { getUuid } from '@/lib/hash'
import { buildAssetKey } from '@/lib/storage-key'
import { insertAsset } from '@/models/asset'

function isAdmin(email?: string | null) {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!email) return false
  return admins.includes(email)
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo()
    const email = (user as any)?.email as string | undefined
    if (!isAdmin(email)) return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const task_ids = Array.isArray(body?.task_ids) ? (body.task_ids as string[]) : []
    const limit = Number(body?.limit) > 0 ? Number(body.limit) : 20
    const dry_run = body?.dry_run === true

    let targets: string[] = []
    if (task_ids.length > 0) {
      targets = task_ids
    } else {
      const rows = await listSuccessTasksWithoutAsset(limit)
      targets = rows.map((r) => r.task_id)
    }

    const processed: any[] = []
    const errors: any[] = []
    const storage = newStorage()

    for (const task_id of targets) {
      try {
        const task = await findGenerationTaskByTaskId(task_id)
        if (!task) { processed.push({ task_id, status: 'skip_no_task' }); continue }

        const vendor = await queryTask(task_id)
        if (vendor.state !== 'success') { processed.push({ task_id, status: 'skip_state_'+vendor.state }); continue }

        if (dry_run) { processed.push({ task_id, status: 'dry_run' }); continue }

        const asset_uuid = getUuid()
        const user_uuid = task.user_uuid
        const cover_url = vendor.cover_url
        const file_url = vendor.url

        // cover
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

        // file
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

        await insertAsset({
          uuid: asset_uuid,
          user_uuid,
          task_id: task_id,
          status: 'active',
          cover_key,
          file_key_full,
          file_format: file_key_full ? (file_key_full.split('.').pop() || '') : undefined,
          created_at: new Date().toISOString(),
        } as any)

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

    return Response.json({ code: 0, data: { total: targets.length, processed, errors } })
  } catch (e: any) {
    const msg = e?.message || 'batch finalize failed'
    return Response.json({ code: -1, message: msg }, { status: 500 })
  }
}

