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
      try {
        const ext = (new URL(cover_url).pathname.split('.').pop() || 'webp').toLowerCase()
        const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename: `cover.${ext}` })
        const headers: Record<string, string> = {}
        if (process.env.HITEM3D_REFERER) {
          headers['Referer'] = process.env.HITEM3D_REFERER
          headers['Origin'] = process.env.HITEM3D_REFERER
        }
        headers['User-Agent'] = process.env.HITEM3D_UA || 'Mozilla/5.0'
        headers['Accept'] = '*/*'
        headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
        const ctypeMap: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
        await storage.downloadAndUpload({ url: cover_url, key, disposition: 'inline', headers, contentType: ctypeMap[ext] })
        cover_key = key
      } catch {
        // best-effort: ignore cover failures
      }
    }

    // file (with fallback to *.obj.zip / *.zip when vendor url not accessible)
    let file_key_full: string | undefined
    if (file_url) {
      const baseHeaders: Record<string, string> = {}
      if (process.env.HITEM3D_REFERER) {
        baseHeaders['Referer'] = process.env.HITEM3D_REFERER
        baseHeaders['Origin'] = process.env.HITEM3D_REFERER
      }
      baseHeaders['User-Agent'] = process.env.HITEM3D_UA || 'Mozilla/5.0'
      baseHeaders['Accept'] = '*/*'
      baseHeaders['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'

      const pickZipCandidates = (u: string): string[] => {
        try {
          const url = new URL(u)
          const segs = url.pathname.split('/')
          const last = segs[segs.length - 1]
          if (!last.includes('.')) return []
          const known = new Set(['zip', 'obj', 'glb', 'stl', 'fbx'])
          let name = last
          for (let i = 0; i < 2; i++) {
            const idx = name.lastIndexOf('.')
            if (idx === -1) break
            const ext = name.substring(idx + 1).toLowerCase()
            if (known.has(ext)) name = name.substring(0, idx); else break
          }
          const dir = segs.slice(0, -1).join('/')
          const z1 = new URL(url.toString()); z1.pathname = `${dir}/${name}.obj.zip`
          const z2 = new URL(url.toString()); z2.pathname = `${dir}/${name}.zip`
          const out = [z1.toString()]
          if (z2.toString() !== z1.toString()) out.push(z2.toString())
          return out
        } catch { return [] }
      }

      let targetUrl = file_url
      // try original
      try {
        const head = await fetch(targetUrl, { method: 'HEAD', headers: baseHeaders })
        if (!head.ok) throw new Error('head_not_ok')
      } catch {
        // fallback to zip candidates
        const cands = pickZipCandidates(file_url)
        for (const c of cands) {
          try {
            const head = await fetch(c, { method: 'HEAD', headers: baseHeaders })
            if (head.ok) { targetUrl = c; break }
            const get = await fetch(c, { method: 'GET', headers: baseHeaders })
            if (get.ok) { targetUrl = c; break }
          } catch {}
        }
      }
      const isZip = /\.zip(\?|$)/i.test(targetUrl)
      const ext = (new URL(file_url).pathname.split('.').pop() || 'glb').toLowerCase()
      const filename = isZip ? 'file.zip' : `file.${ext}`
      const key = buildAssetKey({ user_uuid: task.user_uuid, asset_uuid, filename })
      const ctype = isZip ? 'application/zip' : (ext === 'glb' ? 'model/gltf-binary' : undefined)
      await storage.downloadAndUpload({ url: targetUrl, key, disposition: 'attachment', headers: baseHeaders, contentType: ctype })
      file_key_full = key
    }

    // If an existing asset with same task_id exists but without file, update it;
    // if none exists, insert new. When an existing asset already has file_key_full,
    // treat finalize as idempotent and do not create duplicates.
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

    return Response.json({
      code: 0,
      data: { asset_uuid: existing?.uuid || asset_uuid },
    })
  } catch (e: any) {
    console.error('finalize failed:', e)
    const msg = e?.message || 'finalize failed'
    // 直出关键信息便于预发排查（如 Bucket is required）
    return Response.json({ code: -1, message: msg }, { status: 500 })
  }
}
