export type LedgerReason = 'register_bonus' | 'purchase' | 'model_task' | 'refund' | 'admin_adjust';

export interface CreditsWallet {
  userId: string;
  balance: number;
  updatedAt: string; // ISO
}

export interface LedgerEntry {
  id: string;
  userId: string;
  delta: number;
  reason: LedgerReason;
  externalRef?: string | null;
  createdAt: string; // ISO
}

export interface CreditsSummary {
  balance: number;
  ledger: Array<Pick<LedgerEntry, 'delta' | 'reason' | 'createdAt'>>;
}

