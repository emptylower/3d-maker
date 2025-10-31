import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { CreditsRepo } from './creditsRepo';
import { CreditsWallet, LedgerEntry, LedgerReason } from '../domain/types';
import { getSupabaseAdmin } from '../lib/supabaseServer';

export class SupabaseCreditsRepo implements CreditsRepo {
  private tableWallet = 'credits_wallet';
  private tableLedger = 'credits_ledger';
  private tableProfiles = 'profiles';

  async getWallet(userId: string): Promise<CreditsWallet | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from(this.tableWallet)
      .select('user_id,balance,updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { userId: data.user_id, balance: data.balance, updatedAt: data.updated_at };
  }

  async createWallet(userId: string): Promise<CreditsWallet> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { userId, balance: 0, updatedAt: new Date().toISOString() };
    const { data, error } = await supabase
      .from(this.tableWallet)
      .insert({ user_id: userId, balance: 0 })
      .select('user_id,balance,updated_at')
      .single();
    if (error && !String(error.message).includes('duplicate key')) throw error;
    if (!data) {
      // likely already exists, read back
      const w = await this.getWallet(userId);
      if (!w) throw new Error('createWallet failed and no existing wallet');
      return w;
    }
    return { userId: data.user_id, balance: data.balance, updatedAt: data.updated_at };
  }

  async incrementWallet(userId: string, delta: number): Promise<CreditsWallet> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { userId, balance: delta, updatedAt: new Date().toISOString() };
    const { data, error } = await supabase
      .from(this.tableWallet)
      .update({ balance: supabase.rpc as any }) // placeholder to satisfy TS, we do raw update below
      .eq('user_id', userId) as unknown as PostgrestSingleResponse<any>;
    // Supabase PostgREST cannot do arithmetic update in one call without RPC; do read-modify-write
    if (error) {
      // fallback read-modify-write
      const w = (await this.getWallet(userId)) ?? (await this.createWallet(userId));
      const { data: upd, error: err2 } = await supabase
        .from(this.tableWallet)
        .update({ balance: w.balance + delta })
        .eq('user_id', userId)
        .select('user_id,balance,updated_at')
        .single();
      if (err2) throw err2;
      return { userId: upd.user_id, balance: upd.balance, updatedAt: upd.updated_at };
    }
    // should not reach here; but keep readback
    const w2 = await this.getWallet(userId);
    if (!w2) throw new Error('incrementWallet failed');
    return w2;
  }

  async addLedger(userId: string, delta: number, reason: LedgerReason, externalRef?: string | null): Promise<LedgerEntry> {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return {
        id: 'local',
        userId,
        delta,
        reason,
        externalRef: externalRef ?? null,
        createdAt: new Date().toISOString()
      };
    }
    const { data, error } = await supabase
      .from(this.tableLedger)
      .insert({ user_id: userId, delta, reason, external_ref: externalRef ?? null })
      .select('id,user_id,delta,reason,external_ref,created_at')
      .single();
    if (error) throw error;
    return {
      id: data.id,
      userId: data.user_id,
      delta: data.delta,
      reason: data.reason,
      externalRef: data.external_ref,
      createdAt: data.created_at
    };
  }

  async hasLedgerReason(userId: string, reason: LedgerReason): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;
    const { data, error } = await supabase
      .from(this.tableLedger)
      .select('id')
      .eq('user_id', userId)
      .eq('reason', reason)
      .limit(1);
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async listLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from(this.tableLedger)
      .select('id,user_id,delta,reason,external_ref,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((d) => ({
      id: d.id,
      userId: d.user_id,
      delta: d.delta,
      reason: d.reason,
      externalRef: d.external_ref,
      createdAt: d.created_at
    }));
  }

  async upsertProfile(userId: string, role: 'user' | 'admin'): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;
    const { error } = await supabase
      .from(this.tableProfiles)
      .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
    if (error) throw error;
  }
}

