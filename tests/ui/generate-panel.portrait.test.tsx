// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import GeneratePanel from '@/components/generator/GeneratePanel'

describe('GeneratePanel - portrait mode', () => {
  beforeEach(() => {
    // @ts-expect-error
    global.fetch = vi.fn(async (url: any, init: any) => {
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't' } }) }
    })
  })

  it('fixes request_type=3, model=scene-portraitv1.5 and 1536 resolution', async () => {
    let seen: Record<string, string> = {}
    ;(global.fetch as any).mockImplementation(async (url: any, init: any) => {
      if (String(url).endsWith('/api/hitem3d/submit')) {
        const fd = init?.body as FormData
        seen.request_type = String(fd.get('request_type'))
        seen.model = String(fd.get('model'))
        seen.resolution = String(fd.get('resolution'))
        seen.format = String(fd.get('format'))
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't' } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    render(<GeneratePanel />)
    fireEvent.click(screen.getByRole('button', { name: '切换人像' }))

    // 单图提交
    const f = new File([new Uint8Array([1,2,3])], 'a.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传图片'), { target: { files: [f] } })
    fireEvent.click(screen.getByRole('button', { name: '提交生成' }))

    await waitFor(() => {
      expect(seen.request_type).toBe('3')
      expect(seen.model).toBe('scene-portraitv1.5')
      expect(seen.resolution).toBe('1536')
      expect(seen.format).toBe('2')
    })
  })
})

