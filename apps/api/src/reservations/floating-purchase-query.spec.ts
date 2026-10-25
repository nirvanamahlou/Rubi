import { it, expect, vi } from 'vitest';
import { ReservationsPublicService } from './reservations-public.service';
import { purchaseSelectionSql } from './reservation-purchase-selection';
import { parsePurchaseQuery } from './reservation-purchase-query';
it('binds owner and floating inventory before summary and page selection', () => {
  for (const summary of [true, false]) {
    const sql = purchaseSelectionSql(
      ['11111111-1111-4111-8111-111111111111'],
      parsePurchaseQuery({ kind: 'HOTEL', page: '2' }),
      undefined,
      summary,
      ['floating-offer'],
      { ownerUserId: 'seller' },
    );
    expect(sql.text).toContain('"salesOwnerUserId"::text');
    expect(sql.values).toContain('seller');
    expect(sql.text).not.toContain("'seller'");
    expect(sql.values).toContain('["floating-offer"]');
    expect(sql.text.indexOf('salesOwnerUserId')).toBeLessThan(
      sql.text.indexOf('), services AS'),
    );
  }
});

it('rechecks owner and branch during hydration, not just SQL selection', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce([{ total: 1 }])
    .mockResolvedValueOnce([{ id: 'intake', clientKey: 'hotel' }]);
  const findMany = vi.fn().mockResolvedValue([]);
  const service = new ReservationsPublicService({
    client: { $queryRaw: query, reservationIntake: { findMany } },
  } as never);
  await service.purchaseInbox(['branch'], { kind: 'HOTEL' }, undefined, {
    ownerUserId: 'seller',
  });
  expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
    branchId: { in: ['branch'] },
    salesOwnerUserId: 'seller',
  });
});
