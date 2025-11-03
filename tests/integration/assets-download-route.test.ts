import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks must be declared before importing the route handler
vi.mock('@/models/asset', () => ({ findAssetByUuid: vi.fn() }))
vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))

import { GET } from '@/app/api/assets/[uuid]/download/route'
import { findAssetByUuid } from '@/models/asset'
import { getUserUuid } from '@/services/user'
import { newStorage } from '@/lib/storage'

const ASSET_UUID = 'asset-1'
const OWNER_UUID = 'user-1'
const OTHER_UUID = 'user-2'
const FILE_KEY = 'assets/user-1/asset-1/file.glb'

describe('api/assets/:uuid/download route', () => {
  beforeEach(() => {
    vi.resetModules()
    // default proxy mode for tests unless otherwise set
    process.env.STORAGE_DOWNLOAD_MODE = 'proxy'
    ;(findAssetByUuid as any).mockImplementation(async (uuid: string) => {
      if (uuid !== ASSET_UUID) return null
      return { uuid: ASSET_UUID, user_uuid: OWNER_UUID, status: 'active', file_key_full: FILE_KEY }
    })
  })

  it('returns 403 when not owner', async () => {
    ;(getUserUuid as any).mockResolvedValue(OTHER_UUID)
    ;(newStorage as any).mockReturnValue({})

    const res = await GET(new Request('http://test.local/api/assets/asset-1/download'), { params: { uuid: ASSET_UUID } })
    expect(res.status).toBe(403)
  })

  it('proxy mode: owner receives 200 stream with attachment disposition', async () => {
    ;(getUserUuid as any).mockResolvedValue(OWNER_UUID)
    // mock web ReadableStream body
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1,2,3])); controller.close() } })
    ;(newStorage as any).mockReturnValue({
      getObjectStream: vi.fn(async () => ({ body, contentType: 'model/gltf-binary', contentLength: 3 }))
    })

    const res = await GET(new Request('http://test.local/api/assets/asset-1/download'), { params: { uuid: ASSET_UUID } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment; filename=file.glb')
  })

  it('presigned mode: owner receives 200 json when format=json', async () => {
    process.env.STORAGE_DOWNLOAD_MODE = 'presigned'
    ;(getUserUuid as any).mockResolvedValue(OWNER_UUID)
    ;(newStorage as any).mockReturnValue({
      getSignedUrl: vi.fn(async () => ({ url: 'https://r2.example.com/signed?x-ttl=300', expiresIn: 300 }))
    })

    const res = await GET(new Request('http://test.local/api/assets/asset-1/download?format=json'), { params: { uuid: ASSET_UUID } })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.data.url).toContain('https://r2.example.com/signed')
    expect(json.data.expires_in).toBe(300)
  })
})
