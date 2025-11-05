// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import GeneratePanel from '@/components/generator/GeneratePanel'

describe('GeneratePanel - multi view UI', () => {
  beforeEach(() => {
    // @ts-expect-error
    global.fetch = vi.fn(async (url: any, init: any) => ({ ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't' } }) }))
  })

  it('front-only uses images; front+left uses multi_images with order', async () => {
    let seen: any = {}
    ;(global.fetch as any).mockImplementation(async (url: any, init: any) => {
      if (String(url).endsWith('/api/hitem3d/submit')) {
        const fd = init?.body as FormData
        seen.images = fd.get('images')
        seen.multi_len = (fd.getAll('multi_images') || []).length
        seen.req = fd
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't' } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    const { unmount } = render(<GeneratePanel />)
    // 切换到多视图
    fireEvent.click(screen.getByRole('button', { name: '多视图生成3D' }))

    // 仅前视图
    const front = new File([new Uint8Array([1])], 'front.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('前视图（必选）'), { target: { files: [front] } })
    fireEvent.click(screen.getByRole('button', { name: '提交生成' }))
    await waitFor(() => expect(seen.images).toBeTruthy())
    expect(seen.multi_len).toBe(0)

    // 再来：前+左 → multi_images
    seen = {}
    ;(global.fetch as any).mockClear()
    ;(global.fetch as any).mockImplementation(async (url: any, init: any) => {
      const fd = init?.body as FormData
      seen.images = fd.get('images')
      seen.multi = fd.getAll('multi_images')
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't2' } }) }
    })

    // 清理前一次渲染，避免重复元素
    unmount()
    render(<GeneratePanel />)
    fireEvent.click(screen.getByRole('button', { name: '多视图生成3D' }))
    fireEvent.change(screen.getByLabelText('前视图（必选）'), { target: { files: [front] } })
    const left = new File([new Uint8Array([3])], 'left.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('左视图（可选）'), { target: { files: [left] } })
    fireEvent.click(screen.getByRole('button', { name: '提交生成' }))

    await waitFor(() => expect(seen.images).toBeFalsy())
    expect(seen.multi.length).toBe(2)
  })
})
