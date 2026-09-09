import type {
  B2bAgencyCreditPolicyV1,
  B2bFinanceExposureV1,
} from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import { projectCredit } from './credit-projection';

const now = new Date('2026-09-08T12:00:00Z');
const policy = {
  creditLimit: '123456789012345678.12',
  currencyCode: 'IRR',
  effectiveFrom: '2026-09-01',
  expiresAt: '2026-09-08',
  isActive: true,
} as B2bAgencyCreditPolicyV1;
const exposure = {
  status: 'AVAILABLE',
  amount: '123456789012345670.0199',
  currencyCode: 'IRR',
  observedAt: '2026-09-08T11:00:00Z',
  sourceVersion: 3,
} satisfies B2bFinanceExposureV1;
describe('separate-currency credit read projection', () => {
  it('subtracts without floating-point loss and preserves source time/version', () => {
    expect(projectCredit(policy, exposure, now)).toMatchObject({
      status: 'AVAILABLE',
      available: '8.1001',
      observedAt: exposure.observedAt,
      sourceVersion: 3,
    });
  });
  it('retains an over-limit deficit, including a negative amount below one unit', () => {
    expect(
      projectCredit(
        { ...policy, creditLimit: '1.00' },
        { ...exposure, amount: '1.0001' },
        now,
      ),
    ).toMatchObject({ status: 'AVAILABLE', available: '-0.0001' });
  });
  it.each(['USD', 'EUR'])(
    'does not combine or convert %s exposure into IRR',
    (currencyCode) => {
      expect(
        projectCredit(policy, { ...exposure, currencyCode }, now),
      ).toMatchObject({
        status: 'UNAVAILABLE',
        reason: expect.stringContaining('ارز'),
      });
    },
  );
  it.each([
    { isActive: false },
    { effectiveFrom: '2026-09-09' },
    { expiresAt: '2026-09-07' },
    { expiresAt: '2026-02-30' },
  ])('rejects invalid policy dates/status %j', (patch) => {
    expect(projectCredit({ ...policy, ...patch }, exposure, now).status).toBe(
      'UNAVAILABLE',
    );
  });
  it.each([
    { amount: 'NaN' },
    { amount: '1e20' },
    { amount: '1.00001' },
    { observedAt: '2026-09-09T00:00:00Z' },
    { observedAt: 'invalid' },
    { sourceVersion: 0 },
  ])('rejects malformed finance values %j', (patch) => {
    expect(projectCredit(policy, { ...exposure, ...patch }, now).status).toBe(
      'UNAVAILABLE',
    );
  });
  it('does not replace a missing policy or finance producer with zero', () => {
    expect(projectCredit(null, exposure, now).status).toBe('UNAVAILABLE');
    expect(
      projectCredit(
        policy,
        { status: 'UNAVAILABLE', reason: 'FINANCE_PORT_UNAVAILABLE' },
        now,
      ).status,
    ).toBe('UNAVAILABLE');
  });
});
