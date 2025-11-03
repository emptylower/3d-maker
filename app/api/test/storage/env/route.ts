function checkAuth(req: Request) {
  const token = req.headers.get('x-e2e-test-token') || ''
  const expect = process.env.E2E_TEST_TOKEN || ''
  if (!expect || token !== expect) {
    return false
  }
  return true
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  const endpoint = process.env.STORAGE_ENDPOINT || ''
  let endpoint_host = ''
  try {
    const u = new URL(endpoint)
    endpoint_host = u.host
  } catch {}
  const accessKey = process.env.STORAGE_ACCESS_KEY || ''
  const secretKey = process.env.STORAGE_SECRET_KEY || ''
  const bucket = process.env.STORAGE_BUCKET || ''
  const region = process.env.STORAGE_REGION || ''
  const downloadMode = process.env.STORAGE_DOWNLOAD_MODE || ''
  const out = {
    endpoint_full: endpoint_host || endpoint,
    access_key_hint: accessKey ? `${accessKey.slice(0,4)}...${accessKey.slice(-4)}` : '',
    secret_key_hint: secretKey ? `${secretKey.slice(0,4)}...${secretKey.slice(-4)}` : '',
    bucket,
    region,
    downloadMode,
  }
  return Response.json(out)
}
