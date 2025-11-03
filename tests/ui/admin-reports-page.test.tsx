// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/models/report', () => ({ listReports: vi.fn() }))

import Page from '@/app/[locale]/(admin)/admin/reports/page'
import { listReports } from '@/models/report'

describe('Admin Reports Page', () => {
  beforeEach(() => {
    ;(listReports as any).mockReset()
  })

  it('renders reports table title', async () => {
    ;(listReports as any).mockResolvedValue([
      { id: 1, publication_id: 2, user_uuid: 'user-1', reason: 'spam', created_at: new Date().toISOString() },
    ])
    const node = await (Page as any)()
    render(node)
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })
})

