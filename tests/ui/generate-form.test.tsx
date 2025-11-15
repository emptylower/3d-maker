// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import GenerateForm from '@/components/generator/GenerateForm'
// We'll mock fetch to inspect the FormData payload that the component builds.

describe('GenerateForm UI + MSW integration', () => {
  beforeEach(() => {
    // @ts-expect-error
    global.fetch = vi.fn(async (url: any, init: any) => {
      // default fallback; tests will override per-case
      return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't-default' } }) }
    })
  })

  it('renders default cost (v1.5/1536/几何) and submits with request_type=1 + format=3(stl)', async () => {
    let seen: Record<string, string> = {}
    ;(global.fetch as any).mockImplementation(async (url: any, init: any) => {
      if (String(url).endsWith('/api/hitem3d/submit')) {
        const fd = init?.body as FormData
        seen.request_type = fd.get('request_type') as any
        seen.model = fd.get('model') as any
        seen.resolution = fd.get('resolution') as any
        seen.format = fd.get('format') as any
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't1' } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    render(<GenerateForm />)
    // 默认 cost: V1.5|1536|no => 40
    expect(screen.getByTestId('cost-hint').textContent).toContain('40')

    // 添加图片并提交
    const f = new File([new Uint8Array([1,2,3])], 'a.png', { type: 'image/png' })
    const input = screen.getByLabelText('上传图片') as HTMLInputElement
    fireEvent.change(input, { target: { files: [f] } })
    fireEvent.click(screen.getByRole('button', { name: '提交生成' }))

    await waitFor(() => {
      expect(seen.request_type).toBe('1')
      expect(seen.model).toBe('hitem3dv1.5')
      expect(seen.resolution).toBe('1536')
      expect(seen.format).toBe('3')
    })

    expect(await screen.findByRole('status')).toHaveTextContent('预览生成中')
  })

  it('启用纹理后提交，request_type=3', async () => {
    let requestType = ''
    ;(global.fetch as any).mockImplementation(async (url: any, init: any) => {
      if (String(url).endsWith('/api/hitem3d/submit')) {
        const fd = init?.body as FormData
        requestType = fd.get('request_type') as any
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { task_id: 't2' } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })

    render(<GenerateForm />)
    const f = new File([new Uint8Array([1,2,3])], 'a.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('上传图片'), { target: { files: [f] } })
    fireEvent.click(screen.getByLabelText('启用纹理'))
    fireEvent.click(screen.getByRole('button', { name: '提交生成' }))

    await waitFor(() => expect(requestType).toBe('3'))
  })
})
