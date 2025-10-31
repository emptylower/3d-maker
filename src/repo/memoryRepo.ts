import { randomUUID } from 'node:crypto';
import { CreditsSummary, CreditsWallet, LedgerEntry, LedgerReason } from '../domain/types';
import { CreditsRepo } from './creditsRepo';

type Role = 'user' | 'admin';

export class MemoryCreditsRepo implements CreditsRepo {
  private wallets = new Map<string, CreditsWallet>();
  private ledgers = new Map<string, LedgerEntry[]>();
  private roles = new Map<string, Role>();

  async getWallet(userId: string): Promise<CreditsWallet | null> {
    return this.wallets.get(userId) ?? null;
  }
  async createWallet(userId: string): Promise<CreditsWallet> {
    if (this.wallets.has(userId)) return this.wallets.get(userId)!;
    const w: CreditsWallet = { userId, balance: 0, updatedAt: new Date().toISOString() };
    this.wallets.set(userId, w);
    return w;
  }
  async incrementWallet(userId: string, delta: number): Promise<CreditsWallet> {
    const w = (await this.getWallet(userId)) ?? (await this.createWallet(userId));
    w.balance += delta;
    w.updatedAt = new Date().toISOString();
    this.wallets.set(userId, w);
    return w;
  }

  async addLedger(userId: string, delta: number, reason: LedgerReason, externalRef?: string | null): Promise<LedgerEntry> {
    const entry: LedgerEntry = {
      id: randomUUID(),
      userId,
      delta,
      reason,
      externalRef: externalRef ?? null,
      createdAt: new Date().toISOString()
    };
    const arr = this.ledgers.get(userId) ?? [];
    arr.push(entry);
    this.ledgers.set(userId, arr);
    return entry;
  }

  async hasLedgerReason(userId: string, reason: LedgerReason): Promise<boolean> {
    const arr = this.ledgers.get(userId) ?? [];
    return arr.some((l) => l.reason === reason);
  }

  async listLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
    const arr = this.ledgers.get(userId) ?? [];
    return arr.slice(-limit).reverse();
  }

  async upsertProfile(userId: string, role: Role): Promise<void> {
    this.roles.set(userId, role);
  }
}

