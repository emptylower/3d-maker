import { increaseCredits } from '@/services/credit'
import { getIsoTimestr } from '@/lib/time'
import type { Voucher } from '@/types/voucher'

import {
  findVoucherByCode,
  hasUserRedeemedCode,
  insertVoucherRedemption,
  incrementVoucherUsedCount,
  createVoucher as modelCreateVoucher,
  disableVoucher as modelDisableVoucher,
} from '@/models/voucher'

export const VoucherBusinessCode = {
  OK: 0,
  INVALID_CODE: 2101,
  EXPIRED: 2102,
  DISABLED: 2103,
  MAX_REDEMPTIONS: 2104,
  ALREADY_REDEEMED: 2105,
} as const

export type VoucherBusinessCodeType = typeof VoucherBusinessCode[keyof typeof VoucherBusinessCode]

export function normalizeCodeInput(code: string): string {
  return (code || '').trim().toUpperCase()
}

export function isExpired(expires_at?: string, now: Date = new Date()): boolean {
  if (!expires_at) return false
  const t = Date.parse(expires_at)
  if (Number.isNaN(t)) return false
  return new Date(t).getTime() < now.getTime()
}

export function canRedeem(voucher: Voucher, userHasRedeemed: boolean, now: Date = new Date()): VoucherBusinessCodeType {
  if (!voucher) return VoucherBusinessCode.INVALID_CODE
  if (voucher.status !== 'active') return VoucherBusinessCode.DISABLED
  if (voucher.expires_at && isExpired(voucher.expires_at, now)) return VoucherBusinessCode.EXPIRED
  if (typeof voucher.max_redemptions === 'number' && typeof voucher.used_count === 'number' && voucher.used_count >= voucher.max_redemptions) {
    return VoucherBusinessCode.MAX_REDEMPTIONS
  }
  if (userHasRedeemed) return VoucherBusinessCode.ALREADY_REDEEMED
  return VoucherBusinessCode.OK
}

export function computeCreditExpiredAt(valid_months: number, now: Date = new Date()): string {
  if (!valid_months || valid_months <= 0) return ''
  const d = new Date(now)
  d.setMonth(d.getMonth() + valid_months)
  return d.toISOString()
}

function codeToMessage(code: VoucherBusinessCodeType): string {
  switch (code) {
    case VoucherBusinessCode.OK: return 'ok'
    case VoucherBusinessCode.INVALID_CODE: return 'INVALID_CODE'
    case VoucherBusinessCode.EXPIRED: return 'EXPIRED'
    case VoucherBusinessCode.DISABLED: return 'DISABLED'
    case VoucherBusinessCode.MAX_REDEMPTIONS: return 'MAX_REDEMPTIONS'
    case VoucherBusinessCode.ALREADY_REDEEMED: return 'ALREADY_REDEEMED'
    default: return 'error'
  }
}

export async function redeemCode(user_uuid: string, codeInput: string) {
  const code = normalizeCodeInput(codeInput)
  if (!code) {
    return { code: VoucherBusinessCode.INVALID_CODE, message: codeToMessage(VoucherBusinessCode.INVALID_CODE) }
  }

  const voucher = await findVoucherByCode(code)
  if (!voucher) {
    return { code: VoucherBusinessCode.INVALID_CODE, message: codeToMessage(VoucherBusinessCode.INVALID_CODE) }
  }

  const userHasRedeemed = await hasUserRedeemedCode(user_uuid, code)
  const check = canRedeem(voucher as Voucher, !!userHasRedeemed)
  if (check !== VoucherBusinessCode.OK) {
    return { code: check, message: codeToMessage(check) }
  }

  // Only support credits type in this phase
  if (voucher.type !== 'credits') {
    return { code: VoucherBusinessCode.INVALID_CODE, message: codeToMessage(VoucherBusinessCode.INVALID_CODE) }
  }

  // Issue credits
  const credits = voucher.credits || 0
  const expired_at = computeCreditExpiredAt(voucher.valid_months || 0)
  await increaseCredits({ user_uuid, trans_type: 'voucher', credits, expired_at })

  // Record redemption
  await insertVoucherRedemption({ code, user_uuid, redeemed_at: getIsoTimestr(), result: { credits } })

  // Increase used_count
  await incrementVoucherUsedCount(code)

  return { code: VoucherBusinessCode.OK, message: 'ok', data: { credits } }
}

export function generateVoucherCode(): string {
  const len = Math.floor(Math.random() * 3) + 10 // 10-12
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // avoid confusing chars
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function createVoucher(params: { code?: string; credits: number; valid_months: number; max_redemptions?: number; expires_at?: string; issued_by?: string }) {
  const code = normalizeCodeInput(params.code || generateVoucherCode())
  const voucher: Voucher = {
    code,
    type: 'credits',
    credits: params.credits,
    valid_months: params.valid_months || 0,
    expires_at: params.expires_at,
    max_redemptions: typeof params.max_redemptions === 'number' ? params.max_redemptions : 1,
    used_count: 0,
    status: 'active',
    issued_by: params.issued_by,
    created_at: getIsoTimestr(),
  }
  await modelCreateVoucher(voucher)
  return voucher
}

export async function disableVoucher(codeInput: string) {
  const code = normalizeCodeInput(codeInput)
  await modelDisableVoucher(code)
  return { code, status: 'disabled' as const }
}

