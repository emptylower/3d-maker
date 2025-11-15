// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyAssetsClient from '@/components/assets/MyAssetsClient'

describe('MyAssetsClient', () => {
  const tasks = [
    {
      task_id: 'task-1',
      state: 'processing',
      model_version: 'hitem3dv1.5',
      resolution: '1536',
      request_type: 1,
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:10:00.000Z',
      has_asset: false,
    },
  ]

  const assets = [
    {
      uuid: 'asset-1',
      task_id: 'task-1',
      title: '公开资产',
      cover_url: 'https://cdn.example.com/asset-1.webp',
      created_at: '2025-01-01T00:20:00.000Z',
      is_public: true,
      slug: 'asset-1',
    },
    {
      uuid: 'asset-2',
      task_id: 'task-2',
      title: '私有资产',
      cover_url: 'https://cdn.example.com/asset-2.webp',
      created_at: '2025-01-02T00:00:00.000Z',
      is_public: false,
      slug: null,
    },
  ]

  it('renders assets (with progress when task exists) in \"全部\" tab', () => {
    render(
      <MyAssetsClient
        initialTasks={tasks as any}
        initialAssets={assets as any}
        disableTaskAutoPolling
      />,
    )

    expect(
      screen.getByRole('heading', { name: '我的资产' }),
    ).toBeInTheDocument()
    expect(screen.getByText('已生成资产')).toBeInTheDocument()

    const assetCards = screen.getAllByTestId('asset-card')
    expect(assetCards).toHaveLength(2)
    // one of the asset cards should show progress text
    expect(screen.getByText(/预计进度/)).toBeInTheDocument()
  })

  it('filters to only public assets in "公开的资产" tab', () => {
    render(
      <MyAssetsClient
        initialTasks={tasks as any}
        initialAssets={assets as any}
        disableTaskAutoPolling
      />,
    )

    fireEvent.click(screen.getByText('公开的资产'))

    const cards = screen.getAllByTestId('asset-card')
    expect(cards).toHaveLength(1)
    expect(screen.getByText('公开资产')).toBeInTheDocument()
    expect(screen.queryByText('私有资产')).not.toBeInTheDocument()
  })

  it('shows empty state when no tasks or assets', () => {
    render(
      <MyAssetsClient
        initialTasks={[]}
        initialAssets={[]}
        disableTaskAutoPolling
      />,
    )

    expect(
      screen.getByText(/暂无生成记录或资产/),
    ).toBeInTheDocument()
  })
})
