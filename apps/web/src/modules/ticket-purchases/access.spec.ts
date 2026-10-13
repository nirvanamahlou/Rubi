import { describe, it, expect } from 'vitest';
import {
  canViewRoute,
  accessGroupForRoute,
  screenPermission,
  USER_ACCESS_PROFILE_PERMISSION,
} from '@nora/contracts';
describe('Travel purchase route access', () => {
  it('retains existing Procurement screen grants and requires business read access', () => {
    expect(accessGroupForRoute('/ticket-purchases')?.id).toBe('procurement');
    expect(canViewRoute([], '/ticket-purchases')).toBe(false);
    expect(canViewRoute(['finance.payment.create'], '/ticket-purchases')).toBe(
      false,
    );
    expect(
      canViewRoute(['procurement.quote.manage'], '/ticket-purchases'),
    ).toBe(true);
    expect(
      canViewRoute(
        ['procurement.quote.manage', USER_ACCESS_PROFILE_PERMISSION],
        '/ticket-purchases',
      ),
    ).toBe(false);
    expect(
      canViewRoute(
        [
          'procurement.quote.manage',
          USER_ACCESS_PROFILE_PERMISSION,
          screenPermission('procurement.home'),
        ],
        '/ticket-purchases',
      ),
    ).toBe(true);
  });
});
