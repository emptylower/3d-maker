import { CreditsSummary, CreditsWallet, LedgerEntry, LedgerReason } from '../domain/types';

export interface CreditsRepo {
  getWallet(userId: string): Promise<CreditsWallet | null>;
  createWallet(userId: string): Promise<CreditsWallet>;
  incrementWallet(userId: string, delta: number): Promise<CreditsWallet>;

  addLedger(userId: string, delta: number, reason: LedgerReason, externalRef?: string | null): Promise<LedgerEntry>;
  hasLedgerReason(userId: string, reason: LedgerReason): Promise<boolean>;
  listLedger(userId: string, limit?: number): Promise<LedgerEntry[]>;

  upsertProfile(userId: string, role: 'user' | 'admin'): Promise<void>;
}

export interface CreditsServiceDeps {
  repo: CreditsRepo;
  adminEmail: string;
}

export interface ProfileInput {
  userId: string;
  email: string;
}

