import { getUserUuid } from '@/services/user'

export async function GET(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    const urlObj = new URL(req.url)
    const target = urlObj.searchParams.get('url') || ''
    if (!target) return Response.json({ code: -1, message: 'url required' }, { status: 400 })
    const headers: Record<string, string> = {}
    // Do not send Referer/Origin by default; mimic browser lite headers
    headers['User-Agent'] = process.env.HITEM3D_UA || 'Mozilla/5.0'
    headers['Accept'] = '*/*'
    headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
    const res = await fetch(target, { method: 'GET', headers })
    const buf = await res.arrayBuffer().catch(() => new ArrayBuffer(0))
    // sample first bytes only to avoid huge response
    const bytes = new Uint8Array(buf)
    const sample = bytes.slice(0, Math.min(bytes.length, 64))
    const hdrs: Record<string, string> = {}
    for (const [k, v] of (res.headers as any).entries()) {
      if (['content-type','content-length','server','date','access-control-allow-origin'].includes(k.toLowerCase())) {
        hdrs[k] = v
      }
    }
    return Response.json({ code: 0, data: { status: res.status, ok: res.ok, headers: hdrs, size: bytes.length, sample: Array.from(sample) } })
  } catch (e: any) {
    return Response.json({ code: -1, message: e?.message || 'fetch failed' }, { status: 500 })
  }
}

