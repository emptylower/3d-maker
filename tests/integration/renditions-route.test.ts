import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks
const getUserUuid = vi.fn(async () => 'u1')
vi.mock('@/services/user', async () => ({
  getUserUuid: (...args: any[]) => getUserUuid(...args),
}))

const findAssetByUuid = vi.fn(async (uuid: string) => ({ uuid, user_uuid: 'u1', file_key_full: 'k/origin.glb', file_format: 'glb' }))
vi.mock('@/models/asset', async () => ({
  findAssetByUuid: (...args: any[]) => findAssetByUuid(...args),
}))

let store: any = {}
const findRendition = vi.fn(async (asset_uuid: string, format: string, with_texture: boolean) => {
  const key = `${asset_uuid}|${format}|${with_texture}`
  return store[key]
})
const upsertRendition = vi.fn(async (rec: any) => {
  const key = `${rec.asset_uuid}|${rec.format}|${rec.with_texture}`
  store[key] = { ...store[key], ...rec }
  return store[key]
})
vi.mock('@/models/asset-rendition', async () => ({
  findRendition: (...args: any[]) => findRendition(...args),
  upsertRendition: (...args: any[]) => upsertRendition(...args),
}))

vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))

import { POST, GET } from '@/app/api/assets/[uuid]/renditions/route'
import { GET as DownloadGET } from '@/app/api/assets/[uuid]/download/route'
import { newStorage } from '@/lib/storage'

describe('api/assets/:uuid/renditions route', () => {
  beforeEach(() => {
    store = {}
    findAssetByUuid.mockClear()
    findRendition.mockClear()
    upsertRendition.mockClear()
  })

  it('POST creates processing when not exists, idempotent on repeat', async () => {
    const req1 = new Request('http://localhost/api/assets/a1/renditions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format: 'glb', with_texture: false }),
    })
    const res1 = await POST(req1 as any, { params: { uuid: 'a1' } } as any)
    expect(res1.status).toBe(202)
    const js1 = await res1.json()
    expect(js1.data.state).toBe('processing')
    expect(upsertRendition).toHaveBeenCalledTimes(1)

    const req2 = new Request('http://localhost/api/assets/a1/renditions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ format: 'glb', with_texture: false }),
    })
    const res2 = await POST(req2 as any, { params: { uuid: 'a1' } } as any)
    expect(res2.status).toBe(200)
    const js2 = await res2.json()
    expect(js2.data.state).toBe('processing')
    expect(upsertRendition).toHaveBeenCalledTimes(1)
  })

  it('GET returns state; download returns 409 when rendition not ready and 200 stream when ready', async () => {
    // state check
    const res = await GET(new Request('http://localhost/api/assets/a1/renditions?format=glb&with_texture=false') as any, { params: { uuid: 'a1' } } as any)
    expect(res.status).toBe(200)
    const js = await res.json()
    expect(js.data.state).toBe('created')

    // download not ready -> 409 WAIT_RENDITION
    const d1 = await DownloadGET(new Request('http://localhost/api/assets/a1/download?format=glb') as any, { params: { uuid: 'a1' } } as any)
    expect(d1.status).toBe(409)
    const d1j = await d1.json()
    expect(d1j.code).toBe('WAIT_RENDITION')

    // make it success
    store['a1|glb|false'] = { asset_uuid: 'a1', format: 'glb', with_texture: false, state: 'success', file_key: 'r/glb/a1.glb' }
    process.env.STORAGE_DOWNLOAD_MODE = 'proxy'
    const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1,2,3])); c.close() } })
    ;(newStorage as any).mockReturnValue({ getObjectStream: vi.fn(async () => ({ body, contentType: 'model/gltf-binary', contentLength: 3 })) })
    const d2 = await DownloadGET(new Request('http://localhost/api/assets/a1/download?format=glb') as any, { params: { uuid: 'a1' } } as any)
    expect(d2.status).toBe(200)
  })
})
