import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/models/db', () => ({ getSupabaseClient: vi.fn() }))
import { getSupabaseClient } from '@/models/db'
import { insertGenerationTask, findGenerationTaskByTaskId, updateGenerationTask } from '@/models/generation-task'

function mockFromChain(handlers: any) {
  return {
    from: vi.fn().mockReturnValue(handlers),
  }
}

describe('models/generation-task', () => {
  beforeEach(() => {
    ;(getSupabaseClient as any).mockReset()
  })

  it('insertGenerationTask inserts without error', async () => {
    const handlers = { insert: vi.fn(async () => ({ error: null })) }
    ;(getSupabaseClient as any).mockReturnValue(mockFromChain(handlers))
    await insertGenerationTask({ task_id: 't-1', user_uuid: 'u-1', request_type: 3, model_version: 'hitem3dv1', state: 'created' })
    expect(handlers.insert).toHaveBeenCalled()
  })

  it('findGenerationTaskByTaskId returns data or null', async () => {
    const handlersOk = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn(async () => ({ data: { task_id: 't-1' }, error: null })) }) }) }),
    }
    ;(getSupabaseClient as any).mockReturnValueOnce({ from: vi.fn().mockReturnValue(handlersOk) })
    const ok = await findGenerationTaskByTaskId('t-1')
    expect(ok?.task_id).toBe('t-1')

    const handlersErr = {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn(async () => ({ data: null, error: new Error('x') })) }) }) }),
    }
    ;(getSupabaseClient as any).mockReturnValueOnce({ from: vi.fn().mockReturnValue(handlersErr) })
    const miss = await findGenerationTaskByTaskId('missing')
    expect(miss).toBeNull()
  })

  it('updateGenerationTask updates without error', async () => {
    const handlers = { update: vi.fn().mockReturnValue({ eq: vi.fn(async () => ({ error: null })) }) }
    ;(getSupabaseClient as any).mockReturnValue(mockFromChain(handlers))
    await updateGenerationTask('t-1', { state: 'success' })
    expect(handlers.update).toHaveBeenCalled()
  })
})

