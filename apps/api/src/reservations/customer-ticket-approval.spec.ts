import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';

const intakeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const input = {
  version: 1 as const,
  expectedVersion: 0,
  serviceClientKey: 'service',
  supplierOrganizationId: '11111111-1111-4111-8111-111111111111',
  amount: '25',
  currencyCode: 'USD',
};
function fixture(paid = '100', kind = 'FLIGHT') {
  const contract = {
    id: 'contract',
    version: 7,
    branchId: 'branch',
    status: 'SENT_TO_RESERVATIONS',
    settlementStatus: 'SETTLED',
    priceComponents: [
      { type: 'BASE', title: 'Service', amount: '100', currencyCode: 'USD' },
    ],
    payments: [
      {
        id: 'receipt',
        amount: paid,
        currencyCode: 'USD',
        status: 'FINANCE_CONFIRMED',
        refunds: [] as { amount: string }[],
        allocations: [] as { amount: string; reversalOfId: string | null }[],
      },
    ],
    receiptAllocations: [] as {
      amount: string;
      currencyCode: string;
      reversalOfId: string | null;
    }[],
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'contract' }]),
    salesContract: { findFirst: vi.fn(async () => contract) },
    financeOperationalRequest: { findMany: vi.fn().mockResolvedValue([]) },
    reservationIntake: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    reservationServicePurchase: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'purchase', version: 1 }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const previous = vi.fn().mockResolvedValue(null);
  const database = {
    client: {
      reservationIntake: {
        findUnique: vi.fn().mockResolvedValue({
          contractId: 'contract',
          branchId: 'branch',
          snapshot: {
            serviceSelections: [
              {
                clientKey: 'service',
                kind,
                titleSnapshot: 'Synthetic service',
                metadata: { contractFlightVersion: 1 },
              },
            ],
            passengerIds: ['22222222-2222-4222-8222-222222222222'],
            passengerAssignments: [
              {
                customerId: '22222222-2222-4222-8222-222222222222',
                serviceClientKeys: ['service'],
              },
            ],
            hotelSelection: {
              serviceClientKey: 'service',
              checkInDate: '2026-10-01',
              checkOutDate: '2026-10-02',
            },
          },
        }),
      },
      reservationServicePurchase: { findUnique: previous },
      $transaction: vi.fn(async (run: (value: unknown) => Promise<unknown>) =>
        run(tx),
      ),
    },
  };
  const directory = {
    brokerReference: vi.fn().mockResolvedValue({
      id: input.supplierOrganizationId,
      source: 'BROKER',
      name: 'Synthetic broker',
    }),
    currencyReference: vi.fn(),
  };
  const service = new ReservationServicePurchaseService(
    database as never,
    directory as never,
    undefined,
    undefined,
    undefined,
    {
      agencyPurchaseReference: vi.fn().mockResolvedValue({
        id: input.supplierOrganizationId,
        source: 'ORGANIZATION',
        name: 'Synthetic agency',
      }),
    } as never,
  );
  const actor = {
    userId: 'operator',
    branchIds: ['branch'],
    permissions:
      kind === 'FLIGHT'
        ? ['sales.contracts.create']
        : ['reservations.read', 'reservations.hotel_purchase.write'],
  } as never;
  return {
    tx,
    contract,
    previous,
    database,
    run: (body = input) =>
      service.record(
        intakeId,
        body,
        actor,
        'purchase-key',
        kind === 'FLIGHT' ? 'contract' : undefined,
      ),
  };
}
describe('customer flight purchase authorization', () => {
  it('records a cost obligation before customer settlement without making a payment', async () => {
    const f = fixture('99.9999');
    await expect(f.run()).resolves.toMatchObject({ data: { id: 'purchase' } });
  });
  it('records obligations independently of scheduled receipts and refunded amounts', async () => {
    const scheduled = fixture('1000');
    scheduled.contract.payments[0]!.status = 'SCHEDULED';
    await expect(scheduled.run()).resolves.toMatchObject({
      data: { id: 'purchase' },
    });
    const refunded = fixture();
    refunded.contract.payments[0]!.refunds = [{ amount: '0.0001' }];
    await expect(refunded.run()).resolves.toMatchObject({
      data: { id: 'purchase' },
    });
  });
  it('retains pending refund audit facts without blocking cost recording', async () => {
    const blocked = fixture();
    const hold = {
      refundReceiptId: 'receipt',
      currencyCode: 'USD',
      amount: '25',
      revisions: [{ cumulativePaid: '0' }],
    };
    blocked.tx.financeOperationalRequest.findMany.mockResolvedValue([hold]);
    await expect(blocked.run()).resolves.toMatchObject({
      data: { id: 'purchase' },
    });
    const allowed = fixture('125');
    allowed.tx.financeOperationalRequest.findMany.mockResolvedValue([hold]);
    await expect(allowed.run()).resolves.toMatchObject({
      data: { id: 'purchase' },
    });
    expect(allowed.tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'reservations.ticket_purchase.authorized',
          metadata: expect.objectContaining({
            contractVersion: 7,
            reservedRefunds: [{ currencyCode: 'USD', amount: '25' }],
          }),
        }),
      }),
    );
  });
  it('accepts net incoming allocations and rejects a cancelled source contract', async () => {
    const f = fixture('80');
    f.contract.receiptAllocations = [
      { amount: '20', currencyCode: 'USD', reversalOfId: null },
    ];
    await expect(f.run()).resolves.toMatchObject({ data: { id: 'purchase' } });
    f.contract.status = 'CANCELLED';
    await expect(f.run()).rejects.toThrow('ابطال');
  });
  it('replays an already authorized operation after funds change without creating another approval', async () => {
    const f = fixture('0');
    f.previous.mockResolvedValue({
      id: 'original',
      version: 1,
      fingerprint: createHash('sha256')
        .update(JSON.stringify({ intakeId, ...input }))
        .digest('hex'),
    });
    await expect(f.run()).resolves.toMatchObject({ data: { id: 'original' } });
    expect(f.database.client.$transaction).not.toHaveBeenCalled();
    expect(f.tx.salesContract.findFirst).not.toHaveBeenCalled();
  });
  it('keeps hotel purchase independent of customer cash', async () => {
    const f = fixture('0', 'HOTEL');
    await expect(
      f.run({
        ...input,
        passengerPrices: [
          {
            customerId: '22222222-2222-4222-8222-222222222222',
            nightlyAmount: '25',
          },
        ],
      } as typeof input),
    ).resolves.toMatchObject({ data: { id: 'purchase' } });
    expect(f.tx.salesContract.findFirst).not.toHaveBeenCalled();
    expect(f.tx.financeOperationalRequest.findMany).not.toHaveBeenCalled();
    expect(f.tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
