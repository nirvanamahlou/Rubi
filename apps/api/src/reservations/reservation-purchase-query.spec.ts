import { describe, expect, it } from 'vitest';
import {
  parsePurchaseQuery,
  purchaseFlightFacts,
} from './reservation-purchase-query';
import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';
describe('purchase filter boundary', () => {
  it.each([
    { status: 'PAID' },
    { dateBy: 'bad' },
    { direction: 'bad' },
    { from: '2026-02-30' },
    { to: 'bad' },
    { from: '2026-10-10', to: '2026-10-09' },
    { status: ['ALL'] },
  ])('rejects invalid or repeated filters: %j', (q) => {
    expect(() => parsePurchaseQuery(q as never)).toThrow();
  });
  it('accepts inclusive equal-date bounds and explicit oldest-first ordering', () => {
    expect(
      parsePurchaseQuery({
        status: 'UNREGISTERED',
        dateBy: 'CHECK_IN',
        from: '2026-10-09',
        to: '2026-10-09',
        direction: 'ASC',
      }),
    ).toMatchObject({
      page: 1,
      status: 'UNREGISTERED',
      dateBy: 'CHECK_IN',
      direction: 'ASC',
    });
  });
  it('projects authorized facts only, preserves actual cost date and omits cancelled requests', () => {
    const request = {
      id: 'r',
      branchId: 'b',
      offerId: 'o',
      catalogProductReference: 'o',
      createdAt: '2026-10-01T10:00:00Z',
      serviceDate: '2026-10-15',
      status: 'PENDING',
    };
    const item = {
      request,
      cost: { createdAt: '2026-10-04T10:00:00Z', invoiceAmount: 'private' },
    } as unknown as TicketPurchaseInboxItemV1;
    const facts = purchaseFlightFacts([
      item,
      { ...item, request: { ...item.request, status: 'CANCELLED' } },
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      registered: true,
      purchasedAt: '2026-10-04T10:00:00Z',
    });
    expect(JSON.stringify(facts)).not.toContain('private');
  });
});
