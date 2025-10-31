import { REGISTER_BONUS } from '../domain/constants';
import { CreditsSummary } from '../domain/types';
import { CreditsRepo, CreditsServiceDeps, ProfileInput } from '../repo/creditsRepo';

export class CreditsService {
  private repo: CreditsRepo;
  private adminEmail: string;

  constructor(deps: CreditsServiceDeps) {
    this.repo = deps.repo;
    this.adminEmail = deps.adminEmail;
  }

  async ensureRegisterBonus(input: ProfileInput): Promise<{ awarded: boolean; balance: number }> {
    const { userId, email } = input;

    // Role assignment
    const role = email.toLowerCase() === this.adminEmail.toLowerCase() ? 'admin' : 'user';
    await this.repo.upsertProfile(userId, role);

    // Ensure wallet exists
    await this.repo.createWallet(userId);

    // Idempotent grant: only if no prior register_bonus
    const already = await this.repo.hasLedgerReason(userId, 'register_bonus');
    if (!already) {
      await this.repo.addLedger(userId, REGISTER_BONUS, 'register_bonus');
      const w = await this.repo.incrementWallet(userId, REGISTER_BONUS);
      return { awarded: true, balance: w.balance };
    }
    const w = await this.repo.getWallet(userId);
    return { awarded: false, balance: w?.balance ?? 0 };
  }

  async getSummary(userId: string): Promise<CreditsSummary> {
    const w = (await this.repo.getWallet(userId)) ?? (await this.repo.createWallet(userId));
    const ledger = await this.repo.listLedger(userId, 50);
    return {
      balance: w.balance,
      ledger: ledger.map((l) => ({ delta: l.delta, reason: l.reason, createdAt: l.createdAt }))
    };
  }
}

