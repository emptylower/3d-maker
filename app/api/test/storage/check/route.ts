import { newStorage } from '@/lib/storage'
import { S3Client, PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3'

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
    const storage = newStorage()
    const key = `e2e-check/${Date.now()}.txt`
    const body = Buffer.from(`ok-${Date.now()}`)

    // Try lib-storage first
    try {
      const out = await storage.uploadFile({ body, key, contentType: 'text/plain', disposition: 'inline' })
      return Response.json({ ok: true, via: 'uploadFile', bucket: out.bucket, key: out.key, location: out.location })
    } catch (err: any) {
      // Fallback: direct S3 client with forcePathStyle=true for detailed diagnostics
      const cfg = {
        endpoint: process.env.STORAGE_ENDPOINT || '',
        region: process.env.STORAGE_REGION || 'auto',
        credentials: {
          accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
          secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
        },
        forcePathStyle: true,
      } as any
      const s3 = new S3Client(cfg)
      const bucket = process.env.STORAGE_BUCKET || ''
      try {
        // attempt list buckets (may fail depending on permissions)
        try {
          const lb = await s3.send(new ListBucketsCommand({}))
          // return only names
          const names = (lb.Buckets || []).map(b => b.Name)
          // ignore in final result; continue to put
        } catch (e) {}
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain', ContentDisposition: 'inline' }))
        return Response.json({ ok: true, via: 'PutObject', bucket, key })
      } catch (e: any) {
        const meta = (e?.$metadata || {})
        const details = {
          name: e?.name,
          message: e?.message,
          httpStatusCode: meta.httpStatusCode,
          requestId: meta.requestId,
          extendedRequestId: meta.extendedRequestId,
          endpoint_tail: (cfg.endpoint || '').slice(-16),
          access_key_hint: (cfg.credentials?.accessKeyId || '').slice(0,4) + '...' + (cfg.credentials?.accessKeyId || '').slice(-4),
          bucket,
          region: cfg.region,
        }
        return Response.json({ error: 'put_failed', details }, { status: 500 })
      }
    }
  } catch (e: any) {
    return Response.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}
