export interface Voucher {
  code: string;
  type: 'credits';
  credits: number;
  valid_months: number;
  plan_id?: string;
  expires_at?: string; // voucher usable until this time; optional means no voucher expiry
  max_redemptions: number;
  used_count: number;
  status: 'active' | 'disabled';
  issued_by?: string;
  created_at?: string;
}

