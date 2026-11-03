import { expect, it, vi } from 'vitest';
import { ReservationsPublicService } from './reservations-public.service';
function row(index: number) {
  return {
    id: 'intake-' + index,
    contractId: 'contract-' + index,
    branchId: 'branch',
    contractVersion: 1,
    receivedAt: new Date('2026-10-01T00:00:00Z'),
    snapshot: { contractNumber: 'SYN-' + index },
    purchaseVersion: 1,
    arrangements: [],
    hotelPurchases: [],
    workflowRevisions: [],
    servicePurchases: [
      {
        id: 'purchase-' + index,
        version: 1,
        serviceClientKey: 'hotel',
        coveredServiceClientKeys: ['hotel'],
        serviceKind: 'HOTEL',
        serviceTitleSnapshot: 'Synthetic hotel',
        supplierOrganizationId: 'supplier',
        supplierNameSnapshot: 'Synthetic supplier',
        amount: { toString: () => '10' },
        currencyCode: 'EUR',
        passengerPrices: null,
        actorUserId: 'actor',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        financeRevisions: [],
      },
    ],
  };
}
it('reads all scoped purchase intakes without contract deduplication or UI pagination', async () => {
  const rows = [
    ...Array.from({ length: 126 }, (_, n) => row(n)),
    { ...row(999), contractId: 'contract-0', contractVersion: 0 },
  ];
  const findMany = vi.fn().mockResolvedValue(rows),
    service = new ReservationsPublicService({
      client: { reservationIntake: { findMany } },
    } as never);
  const result = await service.listForFinance(['branch']);
  expect(result).toHaveLength(127);
  expect(result.at(-1)?.servicePurchases?.[0]?.id).toBe('purchase-999');
  expect(findMany).toHaveBeenCalledWith({
    where: { branchId: { in: ['branch'] }, servicePurchases: { some: {} } },
    include: expect.any(Object),
    orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
    take: 10001,
  });
  expect(findMany.mock.calls[0]![0]).not.toHaveProperty('distinct');
  expect(findMany.mock.calls[0]![0]).not.toHaveProperty('skip');
});
it('fails explicitly instead of truncating an oversized financial source', async () => {
  const findMany = vi
      .fn()
      .mockResolvedValue(Array.from({ length: 10001 }, (_, n) => row(n))),
    service = new ReservationsPublicService({
      client: { reservationIntake: { findMany } },
    } as never);
  await expect(service.listForFinance(['branch'])).rejects.toThrow();
});
