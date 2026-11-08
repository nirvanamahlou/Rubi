import { describe, it, expect } from 'vitest';
import { ReportingService } from './reporting.service';
const actor = {
  userId: 'user',
  permissions: ['reporting.read'],
  branchIds: [],
};
describe('safe reporting readiness', () => {
  it('returns prerequisites without querying protected business data or granting execution', async () => {
    const service = new ReportingService();
    expect(
      service.readiness('account_balances', actor).readiness?.requirements
        .length,
    ).toBeGreaterThan(0);
    await expect(
      service.preview(
        'account_balances',
        { filters: {}, page: 1, pageSize: 5, timezone: 'Asia/Tehran' },
        actor,
      ),
    ).rejects.toThrow();
  });
  it('rejects unknown report codes and users without reporting permission', () => {
    const service = new ReportingService();
    expect(() => service.readiness('unknown', actor)).toThrow();
    expect(() =>
      service.readiness('account_balances', { ...actor, permissions: [] }),
    ).toThrow();
  });
});
