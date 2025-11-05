export type RenditionState = 'created' | 'processing' | 'success' | 'failed'

export interface AssetRendition {
  id?: number
  asset_uuid: string
  format: 'obj' | 'glb' | 'stl' | 'fbx'
  with_texture: boolean
  state: RenditionState
  task_id?: string | null
  file_key?: string | null
  credits_charged: number
  error?: string | null
  created_at?: string
  updated_at?: string
}

import { getSupabaseClient } from './db'

export async function findRendition(asset_uuid: string, format: AssetRendition['format'], with_texture: boolean): Promise<AssetRendition | undefined> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('asset_renditions')
    .select('*')
    .eq('asset_uuid', asset_uuid)
    .eq('format', format)
    .eq('with_texture', with_texture)
    .limit(1)
    .single()
  if (error) return undefined as any
  return data as any
}

export async function upsertRendition(rec: AssetRendition): Promise<AssetRendition> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('asset_renditions')
    .upsert(rec as any, { onConflict: 'asset_uuid,format,with_texture' })
    .select('*')
    .single()
  if (error) throw error
  return data as any
}

export async function updateRenditionState(asset_uuid: string, format: AssetRendition['format'], with_texture: boolean, patch: Partial<AssetRendition>): Promise<void> {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('asset_renditions')
    .update(patch as any)
    .eq('asset_uuid', asset_uuid)
    .eq('format', format)
    .eq('with_texture', with_texture)
  if (error) throw error
}

