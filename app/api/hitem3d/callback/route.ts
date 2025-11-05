import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'
import { getUuid } from '@/lib/hash'
import { insertAsset } from '@/models/asset'
import { findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'
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
        await storage.downloadAndUpload({ url: cover_url, key: cover_key, disposition: 'inline' })
      }

      // file
      let file_key_full: string | undefined
      if (file_url) {
        const fileExt = (new URL(file_url).pathname.split('.').pop() || 'glb').toLowerCase()
        file_key_full = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `file.${fileExt}` })
        await storage.downloadAndUpload({ url: file_url, key: file_key_full, disposition: 'attachment' })
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
