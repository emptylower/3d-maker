// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/models/generation-task', () => ({ listGenerationTasks: vi.fn() }))

import Page from '@/app/[locale]/(admin)/admin/generation-tasks/page'
import { listGenerationTasks } from '@/models/generation-task'

describe('Admin Generation Tasks Page', () => {
  beforeEach(() => {
    ;(listGenerationTasks as any).mockReset()
  })

  it('renders tasks table title', async () => {
    ;(listGenerationTasks as any).mockResolvedValue([
      { task_id: 't1', user_uuid: 'u1', model_version: 'hitem3dv1', state: 'created', created_at: new Date().toISOString() },
    ])
    const node = await (Page as any)()
    render(node)
    expect(screen.getByText('Generation Tasks')).toBeInTheDocument()
  })
})

