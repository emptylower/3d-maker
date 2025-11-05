import { getUserUuid } from '@/services/user'
import { findAssetByUuid } from '@/models/asset'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { newStorage } from '@/lib/storage'
import { buildAssetKey } from '@/lib/storage-key'

type Fmt = 'obj'

export async function GET(req: Request, ctx: any) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const { uuid } = ctx?.params || {}
    const asset = await findAssetByUuid(uuid)
    if (!asset) return Response.json({ code: -1, message: 'not found' }, { status: 404 })
    if (asset.user_uuid !== user_uuid) return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })

    const url = new URL(req.url)
    const fmt = (url.searchParams.get('format') || 'obj') as Fmt
    if (fmt !== 'obj') return Response.json({ code: -1, message: 'unsupported format' }, { status: 400 })

    const storage = newStorage()
    const prefix = `assets/${asset.user_uuid}/${asset.uuid}/obj/`

    // materialize if not exists
    let keys = await storage.listObjects({ prefix })
    if (!keys || keys.length === 0) {
      const ok = await materializeObjFiles(asset.user_uuid, asset.uuid, asset.task_id || '')
      if (ok) keys = await storage.listObjects({ prefix })
    }

    if (!keys || keys.length === 0) {
      return Response.json({ code: -1, message: 'files not available' }, { status: 404 })
    }

    // sign
    const files: Array<{ name: string; url: string }> = []
    for (const key of keys) {
      const rawName = key.substring(prefix.length)
      const cleanName = dropQueryAndHash(rawName)
      const disp = `attachment; filename=${encodeURIComponent(cleanName)}`
      const { url } = await storage.getSignedUrl({ key, responseDisposition: disp })
      files.push({ name: cleanName, url })
    }

    return Response.json({ code: 0, data: { files } })
  } catch (e) {
    console.error('renditions files error:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

async function materializeObjFiles(user_uuid: string, asset_uuid: string, task_id: string): Promise<boolean> {
  try {
    if (!task_id) return false
    const task = await findGenerationTaskByTaskId(task_id)
    const baseUrl = task?.hitem3d_file_url || ''
    if (!baseUrl) return false
    const objUrl = replaceExt(baseUrl, 'obj')
    if (!objUrl) return false

    const origin = new URL(objUrl).origin
    const headers: Record<string, string> = {}
    headers['Referer'] = process.env.HITEM3D_REFERER || origin
    headers['Origin'] = process.env.HITEM3D_REFERER || origin
    headers['User-Agent'] = process.env.HITEM3D_UA || '3D-MARKER/1.0'
    if (process.env.HITEM3D_APPID) headers['Appid'] = process.env.HITEM3D_APPID

    const storage = newStorage()
    const res = await fetch(objUrl, { headers })
    if (!res.ok) return false
    const objText = await res.text()
    const objPathSeg = new URL(objUrl).pathname.split('/').pop() || 'model.obj'
    await storage.uploadFile({ body: Buffer.from(new TextEncoder().encode(objText)), key: buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(objPathSeg)}` }), contentType: 'text/plain', disposition: 'attachment' })

    const mtlFiles = parseMtllib(objText)
    const fetchedMtls: string[] = []
    for (const m of mtlFiles) {
      try {
        const mUrl = new URL(m, objUrl).toString()
        const mRes = await fetch(mUrl, { headers })
        if (!mRes.ok) continue
        const mText = await mRes.text()
        await storage.uploadFile({ body: Buffer.from(new TextEncoder().encode(mText)), key: buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(m)}` }), contentType: 'text/plain', disposition: 'attachment' })
        // textures referenced in this mtl
        const tex = parseTextures(mText)
        for (const t of tex) {
          try {
            const tUrl = new URL(t, mUrl).toString()
            const tRes = await fetch(tUrl, { headers })
            if (!tRes.ok) continue
            const buf = new Uint8Array(await tRes.arrayBuffer())
            await storage.uploadFile({ body: Buffer.from(buf), key: buildAssetKey({ user_uuid, asset_uuid, filename: `obj/${sanitize(t)}` }), disposition: 'attachment' })
          } catch {}
        }
        fetchedMtls.push(m)
      } catch {}
    }
    return true
  } catch { return false }
}

function replaceExt(u: string, ext: 'obj'): string | null {
  try {
    const url = new URL(u)
    const segs = url.pathname.split('/')
    const last = segs[segs.length - 1]
    if (!last.includes('.')) return null
    const base = last.substring(0, last.lastIndexOf('.'))
    segs[segs.length - 1] = `${base}.${ext}`
    url.pathname = segs.join('/')
    return url.toString()
  } catch { return null }
}

function parseMtllib(objText: string): string[] {
  const set = new Set<string>()
  for (const line of objText.split(/\r?\n/)) {
    const t = line.trim()
    if (t.toLowerCase().startsWith('mtllib ')) {
      const parts = t.split(/\s+/).slice(1).filter(Boolean)
      for (const p of parts) set.add(p)
    }
  }
  return [...set]
}
function parseTextures(mtlText: string): string[] {
  const set = new Set<string>()
  for (const line of mtlText.split(/\r?\n/)) {
    const t = line.trim()
    const lower = t.toLowerCase()
    if (lower.startsWith('map_') || lower.startsWith('bump') || lower.startsWith('disp')) {
      const parts = t.split(/\s+/).filter(Boolean)
      const cand = parts.filter(x => !x.startsWith('-')).pop()
      if (cand) set.add(cand)
    }
  }
  return [...set]
}
function sanitize(name: string) {
  // remove query/hash, leading slashes, backslashes, and parent traversal
  const noQuery = dropQueryAndHash(name)
  return noQuery.replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.+\//g, '')
}
function dropQueryAndHash(s: string) {
  return s.split('?')[0].split('#')[0]
}
