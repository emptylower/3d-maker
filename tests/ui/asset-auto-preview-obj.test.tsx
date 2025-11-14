// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('@/components/assets/ViewerOBJ', () => ({
  __esModule: true,
  default: vi.fn(() => null),
}))

import AssetAutoPreviewOBJ from '@/components/assets/AssetAutoPreviewOBJ'
import ViewerOBJ from '@/components/assets/ViewerOBJ'

describe('AssetAutoPreviewOBJ', () => {
  beforeEach(() => {
    ;(ViewerOBJ as any).mockClear()
    // @ts-ignore
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          code: 0,
          data: {
            files: [
              { name: 'file.obj', url: 'https://example.com/file.obj' },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
  })

  it('passes assetId to ViewerOBJ', async () => {
    render(<AssetAutoPreviewOBJ assetUuid="asset-123" />)

    await waitFor(() => {
      expect((ViewerOBJ as any).mock.calls.length).toBeGreaterThan(0)
    })

    const props = (ViewerOBJ as any).mock.calls[0][0]
    expect(props.assetId).toBe('asset-123')
    expect(Array.isArray(props.files)).toBe(true)
  })
})

