import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import { validatePayee } from './bank-payee';
const id = 'ba000000-0000-4000-9000-000000000001';
const row = {
  id,
  brokerId: 'broker-a',
  fingerprint: 'current',
  ibanFingerprint: 'iban',
  account: { accountFingerprint: 'current', ibanFingerprint: 'iban' },
  owner: {},
};
function check(result: unknown, party = { brokerId: 'broker-a' }) {
  const findFirst = vi.fn().mockResolvedValue(result);
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    financeBeneficiary: { findFirst },
  } as unknown as Prisma.TransactionClient;
  return {
    findFirst,
    payment: validatePayee(tx, 'branch-a', 'book-a', id, 'EUR', party),
  };
}
describe('direct bank transfer beneficiary', () => {
  it('requires an active external destination in the right company, currency and payment direction', async () => {
    const { findFirst, payment } = check(row);
    await expect(payment).resolves.toBe(id);
    expect(findFirst.mock.calls[0]?.[0].where).toMatchObject({
      book: { branchId: 'branch-a', id: 'book-a' },
      blacklisted: false,
      direction: { in: ['ALL', 'PAYMENT'] },
      bankBranch: { isActive: true },
      owner: { active: true },
      account: {
        kind: 'BANK',
        branchId: 'branch-a',
        isExternal: true,
        isActive: true,
        deletedAt: null,
        OR: [{ currencyCode: 'EUR' }, { currencyCode: null }],
      },
    });
  });
  it('rejects a different owner, unavailable account and account details changed since designation', async () => {
    for (const candidate of [
      null,
      { ...row, brokerId: 'broker-b' },
      { ...row, fingerprint: 'superseded' },
      { ...row, ibanFingerprint: 'other' },
    ])
      await expect(check(candidate).payment).rejects.toThrow();
  });
});
