import type { AuthenticatedActor } from '@nora/contracts';
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
function setup(rows: unknown[], revisions: unknown[] = []) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const queryRaw = vi.fn().mockResolvedValue(revisions);
  const tx = { reservationIntake: { findMany }, $queryRaw: queryRaw };
  const transaction = vi.fn((work: (client: typeof tx) => unknown) => work(tx));
  const ids = vi.fn().mockResolvedValue(['contract-1']);
  const service = new ReservationsPublicService(
    { client: { $transaction: transaction } } as never,
    undefined,
    undefined,
    { ids } as never,
  );
  return { service, findMany, queryRaw, transaction, ids };
}

it('reads all scoped purchase intakes without contract deduplication or UI pagination', async () => {
  const rows = [
    ...Array.from({ length: 126 }, (_, n) => row(n)),
    { ...row(999), contractId: 'contract-0', contractVersion: 0 },
  ];
  const { service, findMany, queryRaw, transaction } = setup(rows);
  const result = await service.listForFinance(['branch']);
  expect(result).toHaveLength(127);
  expect(result.at(-1)?.servicePurchases?.[0]?.id).toBe('purchase-999');
  expect(findMany).toHaveBeenCalledWith({
    where: { branchId: { in: ['branch'] }, servicePurchases: { some: {} } },
    select: expect.any(Object),
    orderBy: [{ receivedAt: 'desc' }, { id: 'asc' }],
    take: 10001,
  });
  expect(findMany.mock.calls[0]![0]).not.toHaveProperty('distinct');
  expect(findMany.mock.calls[0]![0]).not.toHaveProperty('skip');
  const select = findMany.mock.calls[0]![0].select;
  expect(select).not.toHaveProperty('workflowRevisions');
  expect(select).not.toHaveProperty('arrangements');
  expect(select).not.toHaveProperty('hotelPurchases');
  expect(select.servicePurchases.select).not.toHaveProperty('financeRevisions');
  expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: 'RepeatableRead',
  });
  expect(queryRaw).toHaveBeenCalledWith(
    expect.any(Array),
    expect.arrayContaining(['purchase-0', 'purchase-999']),
  );
});
it('fails explicitly instead of truncating an oversized financial source', async () => {
  const { service, queryRaw } = setup(
    Array.from({ length: 10001 }, (_, n) => row(n)),
  );
  await expect(service.listForFinance(['branch'])).rejects.toThrow();
  expect(queryRaw).not.toHaveBeenCalled();
});

it('exposes one final contract purchase as a pending Finance payable without expanding it into services', async () => {
  const item = row(1);
  item.servicePurchases[0] = {
    ...item.servicePurchases[0]!,
    serviceClientKey: 'contract-total-purchase',
    coveredServiceClientKeys: ['contract-total-purchase', 'flight', 'hotel'],
    serviceKind: 'OTHER',
    serviceTitleSnapshot: 'Contract total purchase',
    amount: { toString: () => '123.45' },
  };
  const { service } = setup([item]);
  const result = await service.listForFinance(['branch']);
  expect(result[0]?.servicePurchases).toHaveLength(1);
  expect(result[0]?.servicePurchases?.[0]).toMatchObject({
    serviceClientKey: 'contract-total-purchase',
    amount: '123.45',
    finance: { status: 'PENDING', paidAmount: '0', remainingAmount: '123.45' },
  });
});

it('reads only selected purchase revisions and retains legacy paid balances and company scope', async () => {
  const intake = row(1);
  const newest = intake.servicePurchases[0]!;
  intake.servicePurchases.push({ ...newest, id: 'old-hotel', version: 0 });
  const { service, findMany, queryRaw, ids } = setup(
    [intake],
    [
      {
        purchaseId: newest.id,
        version: 4,
        status: 'PAID',
        cumulativePaid: null,
        remainingAmount: null,
      },
    ],
  );
  const actor = {
    userId: 'actor',
    sessionId: 'session',
    branchIds: ['branch'],
    permissions: ['finance.read'],
  } satisfies AuthenticatedActor;
  const result = await service.listForFinance(actor.branchIds, actor);

  expect(ids).toHaveBeenCalledWith(actor);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        branchId: { in: ['branch'] },
        contractId: { in: ['contract-1'] },
        servicePurchases: { some: {} },
      },
    }),
  );
  expect(queryRaw).toHaveBeenCalledExactlyOnceWith(expect.any(Array), [
    newest.id,
  ]);
  expect(result[0]?.servicePurchases).toMatchObject([
    {
      id: newest.id,
      finance: {
        status: 'PAID',
        version: 4,
        paidAmount: '10',
        remainingAmount: '0',
      },
    },
  ]);
});
