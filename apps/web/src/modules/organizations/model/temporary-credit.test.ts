import { describe, expect, it } from 'vitest';
import { temporaryCreditIssue } from './temporary-credit';
import type { B2bAgreementTermsV1 } from '@rubi/contracts';

const policy = (
  creditLimit: string,
  currencyCode = 'IRR',
): B2bAgreementTermsV1['creditPolicies'][number] => ({
  currencyCode,
  creditLimit,
  limitType: 'HARD',
  dueDays: 15,
  overdueAction: 'BLOCK',
  effectiveFrom: '2026-09-11',
  expiresAt: '2026-10-11',
});
describe('temporary credit', () => {
  it('compares exact decimal limits independently per currency', () => {
    expect(
      temporaryCreditIssue(
        [policy('999999999999999999.0002')],
        [policy('999999999999999999.0001')],
      ),
    ).toBeNull();
    expect(
      temporaryCreditIssue(
        [policy('101'), policy('9', 'USD')],
        [policy('100'), policy('10', 'USD')],
      ),
    ).not.toBeNull();
  });
  it('requires a dated increase and preserves previous currencies', () => {
    expect(
      temporaryCreditIssue([policy('100')], [policy('100')]),
    ).not.toBeNull();
    expect(
      temporaryCreditIssue(
        [{ ...policy('101'), expiresAt: null }],
        [policy('100')],
      ),
    ).not.toBeNull();
    expect(
      temporaryCreditIssue(
        [policy('101')],
        [policy('100'), policy('10', 'USD')],
      ),
    ).not.toBeNull();
    expect(temporaryCreditIssue([policy('101')], [policy('100')])).toBeNull();
  });
});
