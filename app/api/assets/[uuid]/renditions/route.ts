import { getUserUuid } from '@/services/user'
import { findAssetByUuid } from '@/models/asset'
import { findRendition, upsertRendition } from '@/models/asset-rendition'

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
    await upsertRendition({ asset_uuid: asset.uuid, format: fmt, with_texture, state: 'processing', credits_charged: 0 })
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
    const state = existing?.state || 'created'
    return Response.json({ code: 0, data: { state } })
  } catch (e) {
    console.error('renditions GET error:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}
