import { newStorage } from '@/lib/storage'
import { findAssetByUuid } from '@/models/asset'
import { findRendition } from '@/models/asset-rendition'
import { getUserUuid } from '@/services/user'

function filenameFromKey(key: string) {
  const segs = key.split('/')
  return segs[segs.length - 1] || 'download.bin'
}

export async function GET(req: Request, ctx: any) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) {
      return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    }

    const { uuid } = ctx?.params || {}
    const asset = await findAssetByUuid(uuid)
    if (!asset) {
      return Response.json({ code: -1, message: 'not found' }, { status: 404 })
    }

    if (asset.user_uuid !== user_uuid) {
      return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })
    }

    const urlObj = new URL(req.url)
    const format = urlObj.searchParams.get('format')
    const responseMode = urlObj.searchParams.get('response')
    const wantsJson = responseMode === 'json' || format === 'json'
    const with_texture = urlObj.searchParams.get('with_texture') === 'true'

    // If specific rendition requested (glb/obj/stl/fbx), ensure it's ready
    const fmtWanted = format && ['obj', 'glb', 'stl', 'fbx'].includes(format) ? (format as any) : null
    if (fmtWanted) {
      const r = await findRendition(asset.uuid, fmtWanted as any, !!with_texture)
      if (!r || r.state !== 'success' || !r.file_key) {
        return Response.json({ code: 'WAIT_RENDITION' }, { status: 409 })
      }
      // override key with rendition file
      const key = r.file_key
      const mode = (process.env.STORAGE_DOWNLOAD_MODE || 'proxy').toLowerCase()
      const storage = newStorage()
      if (mode === 'presigned') {
        const { url, expiresIn } = await storage.getSignedUrl({ key })
        // follow behavior: allow response=json (preferred) or legacy format=json
        if (wantsJson) {
          return Response.json({ code: 0, message: 'ok', data: { url, expires_in: expiresIn } })
        }
        return Response.redirect(url, 302)
      }
      const { body, contentType, contentLength } = await storage.getObjectStream({ key })
      let stream: any = body as any
      // @ts-ignore
      if (body && typeof (body as any).pipe === 'function' && (global as any).ReadableStream && (body as any).readable) {
        try {
          const { Readable } = require('node:stream')
          // @ts-ignore
          if (Readable && Readable.toWeb) {
            // @ts-ignore
            stream = Readable.toWeb(body)
          }
        } catch {}
      }
      const filename = filenameFromKey(key)
      const headers: Record<string, string> = {
        'Content-Disposition': `attachment; filename=${filename}`,
      }
      if (contentType) headers['Content-Type'] = contentType
      if (contentLength) headers['Content-Length'] = String(contentLength)
      return new Response(stream as any, { status: 200, headers })
    }

    // fallback to original asset file
    const key = asset.file_key_full
    if (!key) {
      return Response.json({ code: -1, message: 'file not ready' }, { status: 409 })
    }

    const mode = (process.env.STORAGE_DOWNLOAD_MODE || 'proxy').toLowerCase()
    const storage = newStorage()

    if (mode === 'presigned') {
      const { url, expiresIn } = await storage.getSignedUrl({ key })
      if (wantsJson) {
        return Response.json({ code: 0, message: 'ok', data: { url, expires_in: expiresIn } })
      }
      return Response.redirect(url, 302)
    }

    // proxy mode: stream via server
    const { body, contentType, contentLength } = await storage.getObjectStream({ key })

    // convert to web stream if needed
    let stream: any = body as any
    // @ts-ignore
    if (body && typeof (body as any).pipe === 'function' && (global as any).ReadableStream && (body as any).readable) {
      try {
        // Node Readable -> Web ReadableStream
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Readable } = require('node:stream')
        // @ts-ignore
        if (Readable && Readable.toWeb) {
          // @ts-ignore
          stream = Readable.toWeb(body)
        }
      } catch {}
    }

    const filename = filenameFromKey(key)
    const headers: Record<string, string> = {
      'Content-Disposition': `attachment; filename=${filename}`,
    }
    if (contentType) headers['Content-Type'] = contentType
    if (contentLength) headers['Content-Length'] = String(contentLength)
    return new Response(stream as any, { status: 200, headers })
  } catch (e: any) {
    console.error('download failed:', e)
    return Response.json({ code: -1, message: 'download failed' }, { status: 500 })
  }
}
