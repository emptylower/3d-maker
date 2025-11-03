import { getSupabaseClient } from '@/models/db'
import type { Report } from '@/types/report'

export async function listReports(page = 1, limit = 50): Promise<Report[]> {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}

