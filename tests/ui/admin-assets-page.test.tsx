// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SidebarProvider } from '@/components/ui/sidebar'

vi.mock('@/models/asset', () => ({ listAssets: vi.fn() }))

import Page from '@/app/[locale]/(admin)/admin/assets/page'
import { listAssets } from '@/models/asset'

describe('Admin Assets Page', () => {
  beforeEach(() => {
    ;(listAssets as any).mockReset()
  })

  it('renders assets table title', async () => {
    ;(listAssets as any).mockResolvedValue([
      { uuid: 'a1', user_uuid: 'u1', file_format: 'glb', title: 'Asset 1', created_at: new Date().toISOString() },
    ])
    const node = await (Page as any)()
    render(<SidebarProvider>{node}</SidebarProvider>)
    expect(screen.getByText('Assets')).toBeInTheDocument()
  })
})
