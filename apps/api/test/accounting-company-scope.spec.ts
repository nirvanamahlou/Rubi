import { describe, expect, it } from 'vitest';
import { AccountingCompanyScope } from '../src/finance/accounting/accounting-company-scope';
import type { AuthenticatedActor } from '@nora/contracts';

describe('accounting company mapping', () => {
  const actor = { permissions: [] } as unknown as AuthenticatedActor;
  it('uses the parent ledger for academy without changing issuer context', async () => {
    const current = { selection: 'JAHAN_ACADEMIA', isAggregate: false };
    const service = new AccountingCompanyScope({
      current: async () => ({ data: current }),
      selectable: async () => ({
        data: [
          {
            id: 'parent',
            code: 'JAHAN_BASTAN',
            persianName: 'جهان باستان پایتخت',
          },
          { id: 'academy', code: 'JAHAN_ACADEMIA', persianName: 'جهان آکادمی' },
        ],
      }),
    } as never);
    expect(await service.current(actor)).toMatchObject({
      company: { id: 'parent' },
      companies: [{ id: 'parent' }],
    });
    expect(current.selection).toBe('JAHAN_ACADEMIA');
  });
  it('rejects inaccessible root companies and unauthorized aggregate context', async () => {
    const service = new AccountingCompanyScope({
      current: async () => ({ data: { selection: 'ALL', isAggregate: true } }),
      selectable: async () => ({ data: [] }),
    } as never);
    await expect(service.current(actor)).rejects.toThrow();
    await expect(
      service.current(
        { ...actor, permissions: ['legal-entity.aggregate.read'] },
        true,
      ),
    ).rejects.toThrow();
  });
});
