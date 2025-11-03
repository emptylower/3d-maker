import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { insertAsset } from '@/models/asset'
import { findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
import { getUuid } from '@/lib/hash'

function checkAuth(req: Request) {
  const token = req.headers.get('x-e2e-test-token') || ''
  const expect = process.env.E2E_TEST_TOKEN || ''
  if (!expect || token !== expect) {
    return false
  }
  return true
}

export async function POST(req: Request) {
  try {
    if (!checkAuth(req)) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    const body = (await req.json()) as any
    const { task_id, state = 'success', cover_url, url, cover_data, file_data, file_ext = 'glb' } = body || {}
    if (!task_id) {
      return Response.json({ error: 'task_id required' }, { status: 400 })
    }

    const task = await findGenerationTaskByTaskId(task_id)
    if (!task) {
      return Response.json({ error: 'unknown task_id' }, { status: 404 })
    }

    if (state === 'failed') {
      await updateGenerationTask(task_id, { state: 'failed', updated_at: new Date().toISOString(), error: 'simulated_failed' })
      return Response.json({ ok: true, state: 'failed' })
    }

    const storage = newStorage()
    const asset_uuid = getUuid()

    // cover
    let cover_key: string | undefined
    if (cover_data) {
      const buf = Buffer.from(cover_data, 'base64')
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: 'cover.webp' })
      await storage.uploadFile({ body: buf, key, contentType: 'image/webp', disposition: 'inline' })
      cover_key = key
    } else if (cover_url) {
      const ext = (new URL(cover_url).pathname.split('.').pop() || 'webp').toLowerCase()
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `cover.${ext}` })
      await storage.downloadAndUpload({ url: cover_url, key, disposition: 'inline' })
      cover_key = key
    }

    // file
    let file_key_full: string | undefined
    if (file_data) {
      const buf = Buffer.from(file_data, 'base64')
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `file.${file_ext}` })
      await storage.uploadFile({ body: buf, key, contentType: 'model/gltf-binary', disposition: 'attachment' })
      file_key_full = key
    } else if (url) {
      const ext = (new URL(url).pathname.split('.').pop() || file_ext).toLowerCase()
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `file.${ext}` })
      await storage.downloadAndUpload({ url, key, disposition: 'attachment' })
      file_key_full = key
    }

    await insertAsset({
      uuid: asset_uuid,
      user_uuid: task.user_uuid,
      status: 'active',
      cover_key,
      file_key_full,
      file_format: file_key_full ? (file_key_full.split('.').pop() || '') : undefined,
      created_at: new Date().toISOString(),
    } as any)

    await updateGenerationTask(task_id, {
      state: 'success',
      hitem3d_cover_url: cover_url,
      hitem3d_file_url: url,
      callback_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)

    return Response.json({ ok: true, asset_uuid })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}

