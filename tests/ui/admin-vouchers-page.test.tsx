// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SidebarProvider } from '@/components/ui/sidebar'

vi.mock('@/models/voucher', () => ({ listVouchers: vi.fn() }))

import Page from '@/app/[locale]/(admin)/admin/vouchers/page'
import { listVouchers } from '@/models/voucher'

describe('Admin Vouchers Page', () => {
  beforeEach(() => {
    ;(listVouchers as any).mockReset()
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ code: 0 }) }))
  })

  it('renders vouchers and triggers disable action', async () => {
    ;(listVouchers as any).mockResolvedValue([
      { code: 'ABCD', credits: 100, valid_months: 0, max_redemptions: 1, used_count: 0, status: 'active', issued_by: 'admin@example.com', created_at: new Date().toISOString() },
    ])
    const node = await (Page as any)()
    render(<SidebarProvider>{node}</SidebarProvider>)
    expect(screen.getByText('Vouchers')).toBeInTheDocument()
    const btn = screen.getByText('Disable')
    fireEvent.click(btn)
    expect(global.fetch).toHaveBeenCalledWith('/api/vouchers/disable', expect.any(Object))
  })
})
