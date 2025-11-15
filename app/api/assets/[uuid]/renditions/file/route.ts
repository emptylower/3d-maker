import { getUserUuid } from '@/services/user'
import { findAssetByUuid } from '@/models/asset'
import { newStorage } from '@/lib/storage'

function dropQueryAndHash(s: string) {
  return s.split('?')[0].split('#')[0]
}

function sanitizeName(name: string) {
  const noQuery = dropQueryAndHash(name || '')
  // remove leading slashes, backslashes, and parent traversal
  return noQuery.replace(/^\/+/, '').replace(/\\/g, '/').replace(/\.+\//g, '')
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

    const url = new URL(req.url)
    const name = url.searchParams.get('name')
    if (!name) {
      return Response.json({ code: -1, message: 'missing name' }, { status: 400 })
    }

    const safeName = sanitizeName(name)
    if (!safeName || safeName.includes('/') && safeName.startsWith('../')) {
      return Response.json({ code: -1, message: 'invalid name' }, { status: 400 })
    }

    const key = `assets/${asset.user_uuid}/${asset.uuid}/obj/${safeName}`
    const storage = newStorage()

    try {
      const { body, contentType, contentLength } = await storage.getObjectStream({ key })

      let stream: any = body as any
      // @ts-ignore
      if (body && typeof (body as any).pipe === 'function' && (global as any).ReadableStream && (body as any).readable) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { Readable } = require('node:stream')
          // @ts-ignore
          if (Readable && Readable.toWeb) {
            // @ts-ignore
            stream = Readable.toWeb(body)
          }
        } catch {}
      }

      const headers: Record<string, string> = {
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename=${encodeURIComponent(safeName)}`,
      }
      if (contentType) headers['Content-Type'] = contentType
      if (contentLength) headers['Content-Length'] = String(contentLength)

      return new Response(stream as any, { status: 200, headers })
    } catch (e) {
      console.error('renditions file proxy error:', e)
      return Response.json({ code: -1, message: 'file not found' }, { status: 404 })
    }
  } catch (e) {
    console.error('renditions file route error:', e)
    return Response.json({ code: -1, message: 'internal error' }, { status: 500 })
  }
}

