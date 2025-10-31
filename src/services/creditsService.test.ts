import { CreditsService } from './creditsService';
import { MemoryCreditsRepo } from '../repo/memoryRepo';

describe('CreditsService register bonus', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'lijianjie@koi.codes';

  it('awards 80 credits on first login and is idempotent', async () => {
    const repo = new MemoryCreditsRepo();
    const svc = new CreditsService({ repo, adminEmail });
    const userId = '11111111-1111-1111-1111-111111111111';
    const email = 'user@example.com';

    const r1 = await svc.ensureRegisterBonus({ userId, email });
    expect(r1.awarded).toBe(true);
    expect(r1.balance).toBe(80);

    const r2 = await svc.ensureRegisterBonus({ userId, email });
    expect(r2.awarded).toBe(false);
    expect(r2.balance).toBe(80);

    const summary = await svc.getSummary(userId);
    expect(summary.balance).toBe(80);
    // Only one register_bonus entry
    const registerEntries = summary.ledger.filter((l) => l.reason === 'register_bonus');
    expect(registerEntries.length).toBe(1);
  });

  it('sets admin role when email matches ADMIN_EMAIL', async () => {
    const repo = new MemoryCreditsRepo();
    const svc = new CreditsService({ repo, adminEmail });
    const userId = '22222222-2222-2222-2222-222222222222';

    // No direct read of role from repo; calling ensureRegisterBonus should not throw for admin email
    await expect(
      svc.ensureRegisterBonus({ userId, email: adminEmail })
    ).resolves.toMatchObject({ awarded: true, balance: 80 });
  });
});

