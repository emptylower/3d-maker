export type GenerationTask = {
  id?: number
  task_id: string
  user_uuid: string
  request_type: 1 | 2 | 3
  model_version: 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
  resolution?: '512' | '1024' | '1536' | '1536pro'
  face?: number
  format?: 1 | 2 | 3 | 4
  state: 'created' | 'queueing' | 'processing' | 'success' | 'failed'
  hitem3d_cover_url?: string
  hitem3d_file_url?: string
  credits_charged?: number
  refunded?: boolean
  error?: string
  callback_received_at?: string
  created_at?: string
  updated_at?: string
}

// 占位：后续步骤将实现 Supabase 落库。当前用于被集成测试 mock。
import { getSupabaseClient } from '@/models/db'

export async function insertGenerationTask(task: GenerationTask) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('generation_tasks').insert(task as any)
  if (error) throw error
}

export async function findGenerationTaskByTaskId(task_id: string): Promise<GenerationTask | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('generation_tasks')
    .select('*')
    .eq('task_id', task_id)
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as any) || null
}

export async function updateGenerationTask(task_id: string, patch: Partial<GenerationTask>) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('generation_tasks').update(patch as any).eq('task_id', task_id)
  if (error) throw error
}

export async function listGenerationTasks(page = 1, limit = 50): Promise<GenerationTask[]> {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('generation_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}

// Admin helper: list success tasks that have no corresponding asset record
export async function listSuccessTasksWithoutAsset(limit = 50): Promise<GenerationTask[]> {
  const supabase = getSupabaseClient()
  // 取最近若干 success 任务
  const { data: tasks, error: errTasks } = await supabase
    .from('generation_tasks')
    .select('*')
    .eq('state', 'success')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (errTasks || !tasks || tasks.length === 0) return [] as any

  const ids = (tasks as any[]).map((t) => t.task_id).filter(Boolean)
  if (ids.length === 0) return [] as any
  // 查询已有资产任务映射
  const { data: assets } = await supabase
    .from('assets')
    .select('task_id')
    .in('task_id', ids as any)
  const existing = new Set<string>((assets as any[] | null)?.map((a) => a.task_id).filter(Boolean) || [])
  const result = (tasks as any[]).filter((t) => !existing.has(t.task_id))
  return result as any
}
