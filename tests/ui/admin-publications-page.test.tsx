// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarProvider } from '@/components/ui/sidebar'

vi.mock('@/models/publication', () => ({ listPublications: vi.fn() }))

import Page from '@/app/[locale]/(admin)/admin/publications/page'
import { listPublications } from '@/models/publication'

describe('Admin Publications Page', () => {
  beforeEach(() => {
    ;(listPublications as any).mockReset()
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ code: 0 }) }))
  })

  it('renders publications and triggers offline action', async () => {
    ;(listPublications as any).mockResolvedValue([
      { id: 1, slug: 'p-1', title: 'Pub 1', status: 'online', created_at: new Date().toISOString() },
    ])
    const node = await (Page as any)()
    render(<SidebarProvider>{node}</SidebarProvider>)
    expect(screen.getByText('Publications')).toBeInTheDocument()
    const btn = screen.getByText('Offline')
    fireEvent.click(btn)
    expect(global.fetch).toHaveBeenCalledWith('/api/publications/offline', expect.any(Object))
  })
})
