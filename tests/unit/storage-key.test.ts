import { describe, it, expect } from 'vitest'
import { buildAssetKey } from '@/lib/storage-key'

describe('storage key builder (docs/tech/storage.md)', () => {
  it('builds key as assets/{user_uuid}/{asset_uuid}/file.glb', () => {
    const key = buildAssetKey({
      user_uuid: 'u-123',
      asset_uuid: 'a-456',
      filename: 'file.glb',
    })
    expect(key).toBe('assets/u-123/a-456/file.glb')
  })

  it('throws on invalid params', () => {
    expect(() => buildAssetKey({ user_uuid: '', asset_uuid: 'a', filename: 'f' })).toThrow()
    expect(() => buildAssetKey({ user_uuid: 'u', asset_uuid: '', filename: 'f' })).toThrow()
    expect(() => buildAssetKey({ user_uuid: 'u', asset_uuid: 'a', filename: '' })).toThrow()
  })
})

