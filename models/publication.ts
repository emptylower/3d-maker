import { getSupabaseClient } from '@/models/db'
import type { Publication } from '@/types/publication'

export async function listPublications(page = 1, limit = 50): Promise<Publication[]> {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('publications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}

export async function listPublicationsByUser(user_uuid: string, page = 1, limit = 50): Promise<Publication[]> {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('publications')
    .select('*')
    .eq('user_uuid', user_uuid)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}

export async function offlinePublication(id: number) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('publications').update({ status: 'offline' }).eq('id', id)
  if (error) throw error
  return data
}

