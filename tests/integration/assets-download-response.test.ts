import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/models/asset', () => ({ findAssetByUuid: vi.fn() }))
vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/lib/storage', () => ({ newStorage: vi.fn() }))

import { GET } from '@/app/api/assets/[uuid]/download/route'
import { findAssetByUuid } from '@/models/asset'
import { getUserUuid } from '@/services/user'
import { newStorage } from '@/lib/storage'

const ASSET_UUID = 'asset-2'
const OWNER_UUID = 'user-2'
const FILE_KEY = 'assets/user-2/asset-2/file.glb'

describe('api/assets/:uuid/download route - response=json support', () => {
  beforeEach(() => {
    process.env.STORAGE_DOWNLOAD_MODE = 'presigned'
    ;(getUserUuid as any).mockResolvedValue(OWNER_UUID)
    ;(findAssetByUuid as any).mockResolvedValue({ uuid: ASSET_UUID, user_uuid: OWNER_UUID, status: 'active', file_key_full: FILE_KEY })
    ;(newStorage as any).mockReturnValue({ getSignedUrl: vi.fn(async () => ({ url: 'https://signed.example.com/k', expiresIn: 300 })) })
  })

  it('returns JSON when response=json (preferred param)', async () => {
    const res = await GET(new Request('http://test.local/api/assets/asset-2/download?response=json'), { params: { uuid: ASSET_UUID } })
    expect(res.status).toBe(200)
    const js = await res.json() as any
    expect(js.data.url).toContain('https://signed.example.com')
  })
})

