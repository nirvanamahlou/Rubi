vi.mock('../../finance/accounting/sales-contract-accounting.public', () => ({
  captureSalesContractAccounting: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../finance/accounting/accounting-workflows.public', () => ({
  assertRevenueEditable: vi.fn().mockResolvedValue(undefined),
}));
import { it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import {
  ContractPriceCorrectionService,
  contractCurrencyTotals,
} from './contract-price-correction.service';
const actor = { userId: 'u', branchIds: ['b'], permissions: [] } as never;
it('keeps currencies and discounts exact', () => {
  expect(
    contractCurrencyTotals([
      {
        type: 'BASE',
        amount: new Prisma.Decimal('9007199254740993.0001'),
        currencyCode: 'IRR',
      },
      {
        type: 'DISCOUNT',
        amount: new Prisma.Decimal('1'),
        currencyCode: 'IRR',
      },
      { type: 'BASE', amount: new Prisma.Decimal('20'), currencyCode: 'USD' },
    ]),
  ).toEqual([
    { currencyCode: 'IRR', amount: '9007199254740992.0001' },
    { currencyCode: 'USD', amount: '20' },
  ]);
});
it('denies both direct read and write before querying when role is not authorized', async () => {
  const db = {
    client: { salesContract: { findFirst: vi.fn() }, $transaction: vi.fn() },
  };
  const service = new ContractPriceCorrectionService(
    db as never,
    { canCorrectContractPrice: vi.fn().mockResolvedValue(false) } as never,
  );
  await expect(service.form('c', actor)).rejects.toThrow();
  await expect(service.save('c', {}, actor)).rejects.toThrow();
  expect(db.client.$transaction).not.toHaveBeenCalled();
  expect(db.client.salesContract.findFirst).not.toHaveBeenCalled();
});
it('atomically records adjustment and audit without modifying receipts, and rejects stale versions', async () => {
  const tx = {
    salesContract: {
      findFirst: vi.fn().mockResolvedValue({
        version: 2,
        branchId: 'b',
        status: 'IN_PROGRESS',
        priceComponents: [
          {
            type: 'BASE',
            currencyCode: 'IRR',
            amount: new Prisma.Decimal('100'),
          },
        ],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    salesContractPriceComponent: { createMany: vi.fn() },
    salesContractAuditEvent: { create: vi.fn() },
  };
  const service = new ContractPriceCorrectionService(
    {
      client: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
    } as never,
    { canCorrectContractPrice: vi.fn().mockResolvedValue(true) } as never,
  );
  await expect(
    service.save(
      'c',
      {
        expectedVersion: 1,
        totals: [{ currencyCode: 'IRR', amount: '80' }],
        reason: 'test',
      },
      actor,
    ),
  ).rejects.toThrow();
  expect(tx.salesContractPriceComponent.createMany).not.toHaveBeenCalled();
  await service.save(
    'c',
    {
      expectedVersion: 2,
      totals: [{ currencyCode: 'IRR', amount: '80' }],
      reason: 'test',
    },
    actor,
  );
  expect(tx.salesContract.findFirst.mock.calls[0]![0].where).toMatchObject({
    id: 'c',
    branchId: { in: ['b'] },
  });
  expect(tx.salesContractPriceComponent.createMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        type: 'DISCOUNT',
        amount: '20',
        currencyCode: 'IRR',
      }),
    ],
  });
  expect(tx.salesContractAuditEvent.create).toHaveBeenCalled();
});

it('reuses one correction row and consolidates previous corrections without adding rows', async () => {
  const tx = {
    salesContract: {
      findFirst: vi.fn().mockResolvedValue({
        version: 3,
        branchId: 'b',
        status: 'IN_PROGRESS',
        priceComponents: [
          {
            id: 'base',
            title: 'original',
            type: 'BASE',
            currencyCode: 'IRR',
            amount: new Prisma.Decimal('100'),
          },
          {
            id: 'a',
            title: 'اصلاح مبلغ کل قرارداد',
            type: 'DISCOUNT',
            currencyCode: 'IRR',
            amount: new Prisma.Decimal('20'),
          },
          {
            id: 'b',
            title: 'اصلاح مبلغ کل قرارداد',
            type: 'BASE',
            currencyCode: 'IRR',
            amount: new Prisma.Decimal('10'),
          },
        ],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    salesContractPriceComponent: {
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    salesContractAuditEvent: { create: vi.fn() },
  };
  const service = new ContractPriceCorrectionService(
    {
      client: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
    } as never,
    { canCorrectContractPrice: async () => true } as never,
  );
  await service.save(
    'c',
    {
      expectedVersion: 3,
      totals: [{ currencyCode: 'IRR', amount: '80' }],
      reason: 'test',
    },
    actor,
  );
  expect(tx.salesContractPriceComponent.createMany).not.toHaveBeenCalled();
  expect(tx.salesContractPriceComponent.update).toHaveBeenCalledWith({
    where: { id: 'a' },
    data: { type: 'DISCOUNT', amount: '20' },
  });
  expect(tx.salesContractPriceComponent.deleteMany).toHaveBeenCalledWith({
    where: { contractId: 'c', id: { in: ['b'] } },
  });
  expect(tx.salesContractAuditEvent.create).toHaveBeenCalled();
});

vi.mock('../sales-financial-settlement', () => ({
  recalculateSalesSettlement: vi.fn().mockResolvedValue(undefined),
}));

it('allows own-contract price amendment while rechecking ownership in the write transaction', async () => {
  const row = {
    id: 'c',
    ownerUserId: 'u',
    branchId: 'b',
    version: 2,
    status: 'CONFIRMED',
    priceComponents: [
      { type: 'BASE', currencyCode: 'IRR', amount: new Prisma.Decimal('100') },
    ],
  };
  const tx = {
    salesContract: {
      findFirst: vi.fn().mockResolvedValue(row),
      updateMany: vi.fn(),
    },
  };
  const db = {
    client: {
      salesContract: tx.salesContract,
      $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    },
  };
  const service = new ContractPriceCorrectionService(
    db as never,
    { canCorrectContractPrice: async () => false } as never,
  );
  const creator = {
    userId: 'u',
    branchIds: ['b'],
    permissions: ['sales.contracts.create'],
  } as never;
  await expect(service.form('c', creator)).resolves.toMatchObject({
    version: 2,
  });
  await expect(
    service.save(
      'c',
      {
        expectedVersion: 2,
        totals: [{ currencyCode: 'IRR', amount: '100' }],
        reason: 'Synthetic review',
      },
      creator,
    ),
  ).resolves.toMatchObject({ version: 2 });
  tx.salesContract.findFirst.mockResolvedValue({
    ...row,
    ownerUserId: 'other',
  });
  await expect(service.form('c', creator)).rejects.toThrow('مجوز');
  await expect(
    service.save(
      'c',
      {
        expectedVersion: 2,
        totals: [{ currencyCode: 'IRR', amount: '90' }],
        reason: 'Synthetic review',
      },
      creator,
    ),
  ).rejects.toThrow('مجوز');
  tx.salesContract.findFirst.mockResolvedValue({ ...row, branchId: 'other' });
  await expect(
    service.save(
      'c',
      {
        expectedVersion: 2,
        totals: [{ currencyCode: 'IRR', amount: '90' }],
        reason: 'Synthetic review',
      },
      creator,
    ),
  ).rejects.toThrow('مجوز');
  expect(tx.salesContract.updateMany).not.toHaveBeenCalled();
});
