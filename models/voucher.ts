import { getSupabaseClient } from '@/models/db'
import type { Voucher } from '@/types/voucher'
import type { VoucherRedemption } from '@/types/voucher-redemption'

export async function findVoucherByCode(code: string): Promise<Voucher | undefined> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('vouchers').select('*').eq('code', code).limit(1).maybeSingle()
  if (error) return undefined
  return data as unknown as Voucher | undefined
}

export async function hasUserRedeemedCode(user_uuid: string, code: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('voucher_redemptions')
    .select('code')
    .eq('user_uuid', user_uuid)
    .eq('code', code)
    .limit(1)
    .maybeSingle()
  if (error) return false
  return !!data
}

export async function insertVoucherRedemption(redemption: VoucherRedemption) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('voucher_redemptions').insert(redemption)
  if (error) throw error
  return data
}

export async function incrementVoucherUsedCount(code: string) {
  const supabase = getSupabaseClient()
  const { data: v, error: e1 } = await supabase
    .from('vouchers')
    .select('used_count')
    .eq('code', code)
    .limit(1)
    .maybeSingle()
  if (e1) return
  const used_count = (v?.used_count as number | undefined) ?? 0
  const { error: e2 } = await supabase.from('vouchers').update({ used_count: used_count + 1 }).eq('code', code)
  if (e2) throw e2
}

export async function createVoucher(voucher: Voucher) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('vouchers').insert(voucher)
  if (error) throw error
  return data
}

export async function disableVoucher(code: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.from('vouchers').update({ status: 'disabled' }).eq('code', code)
  if (error) throw error
  return data
}

export async function listVouchers(page = 1, limit = 50) {
  const supabase = getSupabaseClient()
  const from = (page - 1) * limit
  const to = from + limit - 1
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to)
  if (error) return []
  return (data as any[]) || []
}
