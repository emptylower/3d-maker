import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/user', () => ({ getUserUuid: vi.fn() }))
vi.mock('@/models/generation-task', () => ({ findGenerationTaskByTaskId: vi.fn() }))
vi.mock('@/services/hitem3d', () => ({ queryTask: vi.fn() }))

import { GET } from '@/app/api/hitem3d/status/route'
import { getUserUuid } from '@/services/user'
import { findGenerationTaskByTaskId } from '@/models/generation-task'
import { queryTask } from '@/services/hitem3d'

describe('api/hitem3d/status route', () => {
  beforeEach(() => {
    ;(getUserUuid as any).mockReset()
    ;(findGenerationTaskByTaskId as any).mockReset()
    ;(queryTask as any).mockReset()
  })

  it('returns 401 when no auth', async () => {
    ;(getUserUuid as any).mockResolvedValue('')
    const res = await GET(new Request('http://test.local/api/hitem3d/status?task_id=x') as any)
    expect(res.status).toBe(401)
  })

  it('returns local or vendor state', async () => {
    ;(getUserUuid as any).mockResolvedValue('u1')
    ;(findGenerationTaskByTaskId as any).mockResolvedValue({ task_id: 't1', user_uuid: 'u1', state: 'processing' })
    ;(queryTask as any).mockResolvedValue({ task_id: 't1', state: 'success' })
    const res = await GET(new Request('http://test.local/api/hitem3d/status?task_id=t1') as any)
    expect(res.status).toBe(200)
    const js = await res.json()
    expect(js.data.state).toBe('success')
  })
})

