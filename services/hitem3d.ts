// hitem3D API client (server-side only usage)
// Provides: getToken, submitTask, queryTask with minimal in-memory caching and error mapping

type Hitem3DState = 'created' | 'queueing' | 'processing' | 'success' | 'failed'

export interface SubmitTaskParams {
  request_type: 1 | 2 | 3
  model: 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
  resolution?: '512' | '1024' | '1536' | '1536pro'
  face?: number
  format?: 1 | 2 | 3 | 4
  callback_url?: string
  mesh_url?: string // required when request_type === 2
  images?: Array<{
    filename: string
    content: Uint8Array | ArrayBuffer | Buffer | string
    contentType?: string
  }>
  multi_images?: Array<{
    filename: string
    content: Uint8Array | ArrayBuffer | Buffer | string
    contentType?: string
  }>
}

export interface SubmitTaskResult {
  task_id: string
}

export interface QueryTaskResult {
  task_id: string
  state: Hitem3DState
  id?: string
  cover_url?: string
  url?: string
}

export class Hitem3DClientError extends Error {
  vendorCode?: number
  status?: number
  raw?: unknown
  constructor(message: string, opts?: { vendorCode?: number; status?: number; raw?: unknown }) {
    super(message)
    this.name = 'Hitem3DClientError'
    this.vendorCode = opts?.vendorCode
    this.status = opts?.status
    this.raw = opts?.raw
  }
}

function getBaseUrl() {
  return process.env.HITEM3D_API_BASE?.replace(/\/$/, '') || 'https://api.hitem3d.ai'
}

function getCredentials() {
  const id = process.env.HITEM3D_CLIENT_ID
  const secret = process.env.HITEM3D_CLIENT_SECRET
  if (!id || !secret) {
    throw new Hitem3DClientError('缺少 hitem3D 凭据 (HITEM3D_CLIENT_ID/SECRET)', { vendorCode: 1000 })
  }
  return { id, secret }
}

// minimal in-memory cache for token
let cachedToken: string | null = null
let cachedExpireAt = 0 // ms epoch

function getTokenTtlSeconds() {
  const fromEnv = Number(process.env.HITEM3D_TOKEN_TTL_SECONDS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  // default 24h
  return 24 * 60 * 60
}

function isTokenValid(now = Date.now()) {
  return cachedToken && now < cachedExpireAt - 5000 // 5s skew
}

function mapHitem3dError(vendorCode?: number, fallbackMsg?: string) {
  switch (vendorCode) {
    case 30010000:
      return '积分余额不足，请先购买积分或降低配置。'
    case 10031001:
      return '图片大小超过限制（20MB）。'
    case 10031002:
      return '面数设置不合理（100000～2000000）。'
    case 10031003:
      return '分辨率不合法，请按版本取值。'
    case 50010001:
      return '生成超时或无法解析图片，请重试，积分将自动退回。'
    default:
      return fallbackMsg
        ? `第三方服务调用失败（hitem3D）：${fallbackMsg}`
        : '第三方服务调用失败（hitem3D）'
  }
}

interface Hitem3DResponse<T> {
  code: number
  data: T
  msg?: string
  message?: string
}

async function parseJson<T>(res: Response): Promise<Hitem3DResponse<T>> {
  const txt = await res.text()
  try {
    return JSON.parse(txt)
  } catch (e) {
    throw new Hitem3DClientError('hitem3D 响应解析失败', { status: res.status, raw: txt })
  }
}

export async function getToken(): Promise<string> {
  const now = Date.now()
  if (isTokenValid(now)) return cachedToken as string

  const { id, secret } = getCredentials()
  const basic = Buffer.from(`${id}:${secret}`).toString('base64')

  const base = getBaseUrl()

  // prefer /auth/token, fallback to /get-token if 404
  const urlPrimary = `${base}/open-api/v1/auth/token`
  const urlFallback = `${base}/open-api/v1/get-token`

  const doRequest = async (url: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
      },
    })

  let res = await doRequest(urlPrimary)
  // 若主路径不可用（非 2xx），尝试回退路径
  if (!res.ok) {
    const tryFallback = await doRequest(urlFallback)
    if (!tryFallback.ok) {
      throw new Hitem3DClientError('hitem3D 获取 token 失败', { status: res.status })
    }
    res = tryFallback
  }

  const json = await parseJson<any>(res)
  // hitem3D 文档：code=200 成功；不同镜像字段命名可能有差异
  if (json.code !== 200) {
    const vendorCode = Number(json.code)
    const msg = mapHitem3dError(vendorCode, json.msg || json.message)
    throw new Hitem3DClientError(msg, { vendorCode, raw: json })
  }

  // 兼容 data.accessToken 或 access_token（不同镜像）
  const accessToken = json.data?.accessToken || json.data?.access_token
  if (!accessToken) {
    throw new Hitem3DClientError('hitem3D 返回缺少 accessToken', { raw: json })
  }

  const ttlSec = getTokenTtlSeconds()
  cachedToken = accessToken
  cachedExpireAt = now + ttlSec * 1000
  return accessToken
}

export async function submitTask(params: SubmitTaskParams): Promise<SubmitTaskResult> {
  // validate inputs
  if (!params) throw new Hitem3DClientError('参数错误', { vendorCode: 1000 })
  if (!params.request_type) throw new Hitem3DClientError('缺少 request_type', { vendorCode: 1000 })
  if (!params.model) throw new Hitem3DClientError('缺少 model', { vendorCode: 1000 })
  if (!params.images && !params.multi_images) {
    throw new Hitem3DClientError('缺少图片：images 或 multi_images 必须二选一', { vendorCode: 1000 })
  }
  if (params.request_type === 2 && !params.mesh_url) {
    throw new Hitem3DClientError('request_type=2 时 mesh_url 必填', { vendorCode: 1000 })
  }

  const token = await getToken()

  const form = new FormData()
  form.append('request_type', String(params.request_type))
  form.append('model', params.model)
  if (params.resolution) form.append('resolution', String(params.resolution))
  if (typeof params.face === 'number') form.append('face', String(params.face))
  if (typeof params.format === 'number') form.append('format', String(params.format))
  const cb = params.callback_url || process.env.HITEM3D_CALLBACK_URL
  if (cb) form.append('callback_url', cb)
  if (params.mesh_url) form.append('mesh_url', params.mesh_url)

  type BlobContent = string | Uint8Array | ArrayBuffer | Buffer
  const toBlob = (content: BlobContent, contentType?: string) => {
    const ctype = contentType || 'application/octet-stream'
    if (typeof content === 'string') return new Blob([content], { type: ctype })
    if (content instanceof Uint8Array) return new Blob([content], { type: ctype })
    if (content instanceof ArrayBuffer) return new Blob([new Uint8Array(content)], { type: ctype })
    // Buffer is a subclass of Uint8Array in Node.js
    // @ts-ignore
    if (typeof Buffer !== 'undefined' && content instanceof Buffer) return new Blob([content], { type: ctype })
    return new Blob([], { type: ctype })
  }

  if (params.images) {
    for (const f of params.images) {
      form.append('images', toBlob(f.content, f.contentType), f.filename)
    }
  }
  if (params.multi_images) {
    for (const f of params.multi_images) {
      form.append('multi_images', toBlob(f.content, f.contentType), f.filename)
    }
  }

  const res = await fetch(`${getBaseUrl()}/open-api/v1/submit-task`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (!res.ok) {
    throw new Hitem3DClientError('hitem3D 提交任务失败', { status: res.status })
  }
  const json = await parseJson<{ task_id?: string }>(res)
  if (json.code !== 200) {
    const vendorCode = Number(json.code)
    const msg = mapHitem3dError(vendorCode, json.msg || json.message)
    throw new Hitem3DClientError(msg, { vendorCode, raw: json })
  }
  const task_id = json.data?.task_id
  if (!task_id) {
    throw new Hitem3DClientError('hitem3D 返回缺少 task_id', { raw: json })
  }
  return { task_id }
}

export async function queryTask(task_id: string): Promise<QueryTaskResult> {
  if (!task_id) throw new Hitem3DClientError('缺少 task_id', { vendorCode: 1000 })
  const token = await getToken()
  const url = new URL(`${getBaseUrl()}/open-api/v1/query-task`)
  url.searchParams.set('task_id', task_id)

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Hitem3DClientError('hitem3D 查询任务失败', { status: res.status })
  }
  const json = await parseJson<any>(res)
  if (json.code !== 200) {
    const vendorCode = Number(json.code)
    const msg = mapHitem3dError(vendorCode, json.msg || json.message)
    throw new Hitem3DClientError(msg, { vendorCode, raw: json })
  }
  const data = json.data || {}
  const result: QueryTaskResult = {
    task_id: data.task_id,
    state: data.state,
    id: data.id,
    cover_url: data.cover_url,
    url: data.url,
  }
  return result
}

// for tests only
export function resetHitem3DTokenCacheForTest() {
  cachedToken = null
  cachedExpireAt = 0
}
