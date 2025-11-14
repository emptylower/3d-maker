// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { TaskCard } from '@/components/assets/TaskCard'

describe('TaskCard', () => {
  beforeEach(() => {
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/hitem3d/status')) {
        return new Response(JSON.stringify({ code: 0, data: { state: 'success' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/assets/by-task')) {
        return new Response(JSON.stringify({ code: 0, data: { asset_uuid: null } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/hitem3d/finalize')) {
        return new Response(JSON.stringify({ code: 0, data: { asset_uuid: 'asset-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    })
    // @ts-ignore
    global.fetch = fetchMock
    // @ts-ignore
    window.fetch = fetchMock
  })

  const task = {
    task_id: 'task-1',
    state: 'processing',
    model_version: 'hitem3dv1.5',
    resolution: '1536',
    request_type: 1,
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:05:00.000Z',
    has_asset: false,
  }

  it('renders title and estimated progress', () => {
    render(
      <TaskCard
        task={task as any}
        disableAutoPolling
      />,
    )

    expect(screen.getByText('模型生成中')).toBeInTheDocument()
    expect(screen.getByText(/预计进度/)).toBeInTheDocument()
  })

  it('refresh button triggers status calls', async () => {
    const handleAssetReady = vi.fn()

    render(
      <TaskCard
        task={task as any}
        onAssetReady={handleAssetReady}
        disableAutoPolling
      />,
    )

    const btn = screen.getByText('刷新状态')
    await act(async () => {
      fireEvent.click(btn)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(handleAssetReady).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'asset-1' }),
      )
    })
  })
})
