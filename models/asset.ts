export type Asset = {
  uuid: string
  user_uuid: string
  status?: string
  file_key_full?: string
  cover_key?: string
  file_format?: string
  title?: string
  task_id?: string
  created_at?: string
}

// 占位实现：实际 Step-08 会连 Supabase。当前用于被集成测试 mock。
import { getSupabaseClient } from '@/models/db'

export async function findAssetByUuid(uuid: string): Promise<Asset | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('uuid', uuid)
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as any) || null
}

export async function insertAsset(asset: Asset): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('assets').insert(asset as any)
  if (error) throw error
}

export async function listAssets(page = 1, limit = 50): Promise<Asset[]> {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}

export async function findAssetByTaskId(task_id: string): Promise<Asset | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('task_id', task_id)
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as any) || null
}

export async function updateAssetByUuid(uuid: string, patch: Partial<Asset>): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from('assets').update(patch as any).eq('uuid', uuid)
  if (error) throw error
}

export async function listAssetsByUser(user_uuid: string, page = 1, limit = 50): Promise<Asset[]> {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('user_uuid', user_uuid)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}
