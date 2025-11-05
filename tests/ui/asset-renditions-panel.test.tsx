// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import RenditionsPanel from '@/components/assets/RenditionsPanel'

describe('RenditionsPanel', () => {
  beforeEach(() => {
    const calls: any[] = []
    // @ts-expect-error
    global.fetch = vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), init })
      if (String(url).includes('/renditions') && (!init || init.method === 'GET')) {
        // simplify: always success
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { state: 'success' } }) }
      }
      if (String(url).includes('/renditions') && init?.method === 'POST') {
        return { ok: true, status: 202, json: async () => ({ code: 0, data: { state: 'processing' } }) }
      }
      if (String(url).includes('/download')) {
        return { ok: true, status: 200, json: async () => ({ code: 0, data: { url: 'https://signed.example.com/k' } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    })
  })
  afterEach(() => {})

  it('click GLB 生成 → 轮询成功后可下载', async () => {
    render(<RenditionsPanel assetUuid="a1" />)

    fireEvent.click(screen.getByTestId('gen-glb'))
    // POST 已发出
    const postCalls = (global.fetch as any).mock.calls.filter((args: any[]) => String(args[0]).includes('/renditions') && args[1]?.method === 'POST')
    expect(postCalls.length).toBeGreaterThan(0)

    // 进入 processing 再到 ready
    expect(await screen.findByTestId('processing-glb')).toBeDisabled()

    // 立即应出现下载按钮（GET 成功）
    const dl = await screen.findByTestId('download-glb')
    expect(dl).toBeEnabled()

    fireEvent.click(dl)
    // fetch 被调用至 /download?format=glb&response=json
    const calls = (global.fetch as any).mock.calls.map((c: any[]) => String(c[0]))
    expect(calls.some((u: string) => u.includes('/api/assets/a1/download') && u.includes('format=glb') && u.includes('response=json'))).toBeTruthy()
  })
})
