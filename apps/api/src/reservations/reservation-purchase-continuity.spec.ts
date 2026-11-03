import { expect, it, vi } from 'vitest';
import { ReservationsPublicService } from './reservations-public.service';
const date = new Date('2026-11-01T10:00:00Z');
function purchase(id: string, key: string, version = 1) {
  return {
    id,
    version,
    serviceClientKey: key,
    coveredServiceClientKeys: [key],
    serviceKind: 'HOTEL',
    serviceTitleSnapshot: 'Hotel',
    supplierNameSnapshot: 'Supplier',
    currencyCode: 'EUR',
    amount: { toString: () => '250' },
    passengerPrices: null,
    createdAt: date,
    financeRevisions: [],
  };
}
function intake(
  id: string,
  version: number,
  costs: ReturnType<typeof purchase>[] = [],
) {
  return {
    id,
    requestId: id,
    contractId: 'contract',
    contractVersion: version,
    branchId: 'branch',
    purchaseVersion: 0,
    receivedAt: date,
    snapshot: {
      serviceSelections: [],
      passengerIds: [],
      contractNumber: 'SYNTH',
    },
    arrangements: [],
    workflowRevisions: [],
    hotelPurchases: [],
    servicePurchases: costs,
  };
}
it('retains original purchase IDs and costs across an amendment without copying financial records', async () => {
  const current = intake('new', 3);
  const old = intake('old', 2, [
    purchase('original', 'hotel', 9),
    purchase('transfer', 'transfer'),
  ]);
  const findMany = vi.fn().mockResolvedValue([old]);
  const db = {
    client: {
      reservationIntake: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany,
      },
    },
  };
  const service = new ReservationsPublicService(db as never);
  const result = await service.purchaseContext('new', ['branch']);
  expect(result.purchaseVersion).toBe(0);
  expect(result.servicePurchases?.map((p) => p.id)).toEqual([
    'original',
    'transfer',
  ]);
  expect(result.servicePurchases?.[0]).toMatchObject({
    amount: '250',
    currencyCode: 'EUR',
    version: 9,
  });
  expect(current.servicePurchases).toEqual([]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        contractId: 'contract',
        branchId: 'branch',
        contractVersion: { lt: 3 },
      }),
      orderBy: [
        { contractVersion: 'desc' },
        { receivedAt: 'desc' },
        { id: 'asc' },
      ],
    }),
  );
  expect(
    await service.contractPurchaseContext('contract', 'branch'),
  ).toMatchObject({
    servicePurchases: expect.arrayContaining([
      expect.objectContaining({ id: 'original' }),
    ]),
  });
});
it('prefers a newly recorded cost over a larger revision counter on an older intake', async () => {
  const current = intake('new', 3, [purchase('current', 'hotel', 1)]);
  const old = intake('old', 2, [
    purchase('original', 'hotel', 99),
    purchase('transfer', 'transfer'),
  ]);
  const service = new ReservationsPublicService({
    client: {
      reservationIntake: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockResolvedValue([old]),
      },
    },
  } as never);
  expect(
    (await service.purchaseContext('new', ['branch'])).servicePurchases?.map(
      (p) => p.id,
    ),
  ).toEqual(['current', 'transfer']);
});
it('does not read history when the requested intake is outside authorized scope', async () => {
  const findFirst = vi.fn().mockResolvedValue(null),
    findMany = vi.fn();
  const service = new ReservationsPublicService({
    client: { reservationIntake: { findFirst, findMany } },
  } as never);
  await expect(
    service.purchaseContext('foreign', ['branch']),
  ).rejects.toThrow();
  expect(findMany).not.toHaveBeenCalled();
  expect(findFirst.mock.calls[0]![0].where).toEqual({
    id: 'foreign',
    branchId: { in: ['branch'] },
  });
});

it('keeps prior supplier payment evidence and legacy currency totals on their original records', async () => {
  const cost = {
    ...purchase('paid-original', 'hotel'),
    financeRevisions: [{ version: 1, status: 'PAID', createdAt: date }],
  };
  const old = {
    ...intake('old', 2),
    servicePurchases: [cost],
    hotelPurchases: [
      {
        id: 'legacy',
        version: 8,
        currencyCode: 'IRR',
        amount: { toString: () => '1000' },
        createdAt: date,
      },
    ],
  };
  const current = intake('new', 3);
  const service = new ReservationsPublicService({
    client: {
      reservationIntake: {
        findFirst: vi.fn().mockResolvedValue(current),
        findMany: vi.fn().mockResolvedValue([old]),
      },
    },
  } as never);
  const result = await service.purchaseContext('new', ['branch']);
  expect(result.servicePurchases?.[0]).toMatchObject({
    id: 'paid-original',
    finance: { status: 'PAID', paidAmount: '250', remainingAmount: '0' },
  });
  expect(result.hotelPurchases?.[0]).toMatchObject({
    id: 'legacy',
    amount: '1000',
    currencyCode: 'IRR',
  });
  expect(old.servicePurchases[0]).toBe(cost);
  expect(current.purchaseVersion).toBe(0);
});
