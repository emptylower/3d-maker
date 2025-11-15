import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserUuid: vi.fn(async () => 'u1') }))

const findAssetByUuid = vi.fn(async (uuid: string) => ({
  uuid,
  user_uuid: 'u1',
  task_id: 'task-1',
  cover_key: null,
}))
const updateAssetByUuid = vi.fn(async () => {})

vi.mock('@/models/asset', () => ({
  findAssetByUuid: (...args: any[]) => findAssetByUuid(...args),
  updateAssetByUuid: (...args: any[]) => updateAssetByUuid(...args),
}))

vi.mock('@/models/generation-task', () => ({
  findGenerationTaskByTaskId: vi.fn(async () => ({ hitem3d_file_url: 'https://vendor.example.com/model.glb' })),
}))

const listObjects = vi.fn(async () => [
  'assets/u1/a1/obj/model.obj',
  'assets/u1/a1/obj/material_0.png',
])
const getSignedUrl = vi.fn(async ({ key }: { key: string }) => ({
  url: `https://signed.example.com/${key}`,
  expiresIn: 300,
}))

vi.mock('@/lib/storage', () => ({
  newStorage: vi.fn(() => ({
    listObjects,
    getSignedUrl,
  })),
}))

import { GET } from '@/app/api/assets/[uuid]/renditions/files/route'

describe('api/assets/:uuid/renditions/files cover fallback', () => {
  beforeEach(() => {
    ;(findAssetByUuid as any).mockClear()
    ;(updateAssetByUuid as any).mockClear()
    listObjects.mockClear()
    getSignedUrl.mockClear()
  })

  it('updates cover_key from first texture when missing', async () => {
    const req = new Request('http://localhost/api/assets/a1/renditions/files?format=obj')
    const res = await GET(req as any, { params: { uuid: 'a1' } } as any)
    expect(res.status).toBe(200)

    // cover fallback should use material_0.png as preferred texture
    expect(updateAssetByUuid).toHaveBeenCalledWith('a1', {
      cover_key: 'assets/u1/a1/obj/material_0.png',
    })

    const json: any = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.files).toHaveLength(2)
    expect(json.data.files[0].url).toContain('https://signed.example.com/')
  })
})

