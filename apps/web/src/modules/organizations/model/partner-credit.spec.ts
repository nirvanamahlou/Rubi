import { describe, expect, it } from 'vitest';
import type {
  B2bAgencyCreditPolicyV1,
  PartnerFinanceV1,
} from '@nora/contracts';
import { projectPartnerCredit } from './partner-credit';
const now = new Date('2026-10-17T12:00:00Z');
const policy: B2bAgencyCreditPolicyV1 = {
  id: 'policy',
  profileId: 'supplier',
  creditLimit: '100',
  currencyCode: 'USD',
  effectiveFrom: '2026-10-01',
  expiresAt: null,
  isActive: true,
  version: 1,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
};
const finance: PartnerFinanceV1 = {
  version: 1,
  organizationId: 'supplier',
  branchId: 'branch',
  role: 'SUPPLIER',
  creditDirection: 'COUNTERPARTY_TO_US',
  observedAt: now.toISOString(),
  purchases: [],
  payments: [],
  totals: [{ currencyCode: 'USD', purchases: '50', paid: '20', balance: '30' }],
  reconciliationRequired: [],
};
describe('credit extended by supplier to us', () => {
  it('deducts our payable from the credit granted by the counterparty', () => {
    expect(projectPartnerCredit(policy, finance, 1, now)).toMatchObject({
      status: 'AVAILABLE',
      available: '70.0000',
    });
  });
  it('does not inflate the credit limit by a prepaid balance', () => {
    expect(
      projectPartnerCredit(
        policy,
        {
          ...finance,
          totals: [
            { currencyCode: 'USD', purchases: '0', paid: '20', balance: '-20' },
          ],
        },
        1,
        now,
      ),
    ).toMatchObject({ status: 'AVAILABLE', available: '100.0000' });
  });
  it('does not merge currencies', () => {
    expect(
      projectPartnerCredit({ ...policy, currencyCode: 'IRR' }, finance, 1, now),
    ).toMatchObject({ status: 'AVAILABLE', exposure: '0' });
  });
  it('blocks expired, ambiguous and unreconciled credit', () => {
    expect(
      projectPartnerCredit(
        { ...policy, expiresAt: '2026-10-16' },
        finance,
        1,
        now,
      ).status,
    ).toBe('UNAVAILABLE');
    expect(projectPartnerCredit(policy, finance, 2, now).status).toBe(
      'UNAVAILABLE',
    );
    expect(
      projectPartnerCredit(
        policy,
        { ...finance, reconciliationRequired: ['old'] },
        1,
        now,
      ).status,
    ).toBe('UNAVAILABLE');
  });
});
