import { expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type {
  AuthenticatedActor,
  ReservationServicePurchaseInputV1,
} from '@nora/contracts';
vi.mock('./floating-purchase-mode', () => ({
  assertFloatingPurchaseMode: vi.fn(),
}));
import { recordFloatingPassengerPurchase } from './record-floating-passenger-purchase';
const input = {
  version: 1,
  expectedVersion: 2,
  amount: '100',
  currencyCode: 'IRR',
} as ReservationServicePurchaseInputV1;
const actor = { userId: 'actor', branchIds: ['branch'] } as AuthenticatedActor;
const intake = { id: 'intake', contractId: 'contract', branchId: 'branch' };
const groups = [
  { currencyCode: 'IRR', amount: '100', passengerPrices: [] },
  { currencyCode: 'USD', amount: '20', passengerPrices: [] },
];
it('writes every currency in one transaction with distinct versions and a shared batch', async () => {
  const create = vi.fn(
    async ({
      data,
    }: {
      data: {
        currencyCode: string;
        amount: string;
        version: number;
        idempotencyKey: string;
        batchId: string;
      };
    }) => ({
      ...data,
      id: 'id-' + data.currencyCode,
      createdAt: new Date(),
    }),
  );
  const updateMany = vi.fn(
    async (arg: { data: { purchaseVersion: { increment: number } } }) => {
      void arg;
      return { count: 1 };
    },
  );
  const transaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
    cb({
      reservationIntake: { updateMany },
      reservationServicePurchase: { create },
    }),
  );
  const database = {
    client: {
      reservationServicePurchase: { findUnique: vi.fn(async () => null) },
      $transaction: transaction,
    },
  } as unknown as DatabaseService;
  await recordFloatingPassengerPurchase(
    database,
    undefined,
    intake,
    actor,
    input,
    'key',
    { id: 'agency', name: 'Agency' },
    groups,
    ['flight'],
  );
  expect(transaction).toHaveBeenCalledOnce();
  expect(updateMany.mock.calls[0]![0].data.purchaseVersion.increment).toBe(2);
  const saved = create.mock.calls.map(([call]) => call.data);
  expect(
    saved.map((r) => [r.currencyCode, r.amount, r.version, r.idempotencyKey]),
  ).toEqual([
    ['IRR', '100', 3, 'key'],
    ['USD', '20', 4, 'key:1'],
  ]);
  expect(saved[0]!.batchId).toBe(saved[1]!.batchId);
});
it('does not write costs when the purchase version changed', async () => {
  const create = vi.fn();
  const database = {
    client: {
      reservationServicePurchase: { findUnique: vi.fn(async () => null) },
      $transaction: async (cb: (tx: unknown) => unknown) =>
        cb({
          reservationIntake: { updateMany: async () => ({ count: 0 }) },
          reservationServicePurchase: { create },
        }),
    },
  } as unknown as DatabaseService;
  await expect(
    recordFloatingPassengerPurchase(
      database,
      undefined,
      intake,
      actor,
      input,
      'key',
      { id: 'agency', name: 'Agency' },
      groups,
      ['flight'],
    ),
  ).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});
