// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssetCard } from '@/components/assets/AssetCard'

describe('AssetCard', () => {
  it('renders cover, title and actions', () => {
    const asset: any = {
      uuid: 'asset-1',
      task_id: 'task-1',
      title: '测试资产',
      cover_url: 'https://cdn.example.com/asset-1.webp',
      created_at: '2025-01-01T00:00:00.000Z',
      is_public: true,
      slug: 'asset-1',
    }

    render(<AssetCard asset={asset} />)

    expect(screen.getByText('测试资产')).toBeInTheDocument()
    expect(screen.getByText('已公开')).toBeInTheDocument()
    expect(screen.getByText('查看资产')).toBeInTheDocument()
    expect(screen.getByText('下载')).toBeInTheDocument()
    expect(screen.getByText('在广场查看')).toBeInTheDocument()
  })
})

