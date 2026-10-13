import { describe, expect, it } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { manualSnapshotCodes } from './manual-access-policy';
import { assertManualApiAccess } from './manual-api-access';
const actor = (screens: string[]): AuthenticatedActor => ({
  userId: 'test',
  sessionId: 'test',
  branchIds: [],
  permissions: manualSnapshotCodes({
    permissionCodes: ['iam.users.manage', 'customers.update'],
    screenIds: screens,
    allowedControlIds: [],
  }) as AuthenticatedActor['permissions'],
});
describe('manual screen API enforcement', () => {
  it.each([
    ['/api/v1/procurement/ticket-purchases/inbox', 'ticket-purchases.home'],
    ['/api/iam/users', 'system.users'],
    ['/api/workbench/notes/123', 'workbench.tab.notes'],
    ['/workbench/calendar/attachment', 'workbench.tab.calendar'],
    ['/customers/123/contacts', 'customers.tab.contacts'],
  ])(
    'rejects a direct request to %s after its screen is unchecked',
    (path, screen) => {
      expect(() => assertManualApiAccess(actor([screen]), path)).not.toThrow();
      expect(() => assertManualApiAccess(actor([]), path)).toThrow();
    },
  );
  it('keeps cross-module identity lookups under native domain controls', () => {
    expect(() =>
      assertManualApiAccess(actor([]), '/customers/123'),
    ).not.toThrow();
  });
  it.each([
    '/ticket-catalog/sale-price-targets',
    '/ticket-catalog/offers/sale-commissions',
    '/ticket-catalog/offers/outbound/round-trip-sale-price/return',
    '/ticket-catalog/offers/offer/standalone-sale-price',
  ])('blocks direct pricing writes to %s when pricing is unchecked', (path) => {
    expect(() => assertManualApiAccess(actor([]), path, 'PATCH')).toThrow();
    expect(() =>
      assertManualApiAccess(actor(['sales.ticket-prices']), path, 'PATCH'),
    ).not.toThrow();
  });
});
