import { describe, it, expect, vi } from 'vitest';
import { CONTRACT_TOTAL_PURCHASE_KEY } from '@nora/contracts';
import { assertFloatingPurchaseMode } from './floating-purchase-mode';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
describe('floating purchase total', () => {
  it.each([true, false])(
    'rejects mixing total and service costs after taking the same contract lock (%s)',
    async (total) => {
      const tx = {
        $queryRaw: vi.fn(),
        reservationServicePurchase: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
        },
        reservationHotelPurchase: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      await expect(
        assertFloatingPurchaseMode(tx as never, 'contract', 'branch', total),
      ).rejects.toThrow('هم‌زمان');
      expect(tx.$queryRaw).toHaveBeenCalledOnce();
      expect(tx.reservationServicePurchase.findFirst).toHaveBeenCalledWith({
        where: {
          intake: { contractId: 'contract', branchId: 'branch' },
          serviceClientKey: total
            ? { not: CONTRACT_TOTAL_PURCHASE_KEY }
            : CONTRACT_TOTAL_PURCHASE_KEY,
        },
        select: { id: true },
      });
    },
  );
  it('records one positive final cost through the existing purchase/FX path and covers every selected service', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const contract = '22222222-2222-4222-8222-222222222222';
    const snapshot = {
      serviceSelections: [
        {
          clientKey: 'flight',
          kind: 'FLIGHT',
          metadata: { contractFlightVersion: 1 },
        },
        { clientKey: 'hotel', kind: 'HOTEL' },
      ],
      ticketSelections: [],
    };
    const created = {
      id: 'purchase',
      version: 1,
      amount: '125.50',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const tx = {
      $queryRaw: vi.fn(),
      reservationIntake: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      reservationServicePurchase: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      reservationHotelPurchase: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const db = {
      client: {
        reservationIntake: {
          findUnique: vi.fn().mockResolvedValue({
            id,
            contractId: contract,
            branchId: 'branch',
            snapshot,
          }),
        },
        reservationServicePurchase: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
      },
    };
    const fx = { capture: vi.fn() };
    const service = new ReservationServicePurchaseService(
      db as never,
      { currencyReference: vi.fn() } as never,
      undefined,
      undefined,
      fx as never,
      {
        agencyPurchaseReference: vi.fn().mockResolvedValue({
          id,
          name: 'Synthetic agency',
          source: 'ORGANIZATION',
        }),
      } as never,
    );
    await expect(
      service.record(
        id,
        {
          version: 1,
          expectedVersion: 0,
          serviceClientKey: CONTRACT_TOTAL_PURCHASE_KEY,
          supplierOrganizationId: id,
          amount: '125.50',
          currencyCode: 'EUR',
        },
        { userId: id, branchIds: ['branch'], permissions: [] } as never,
        'one-total',
        contract,
      ),
    ).resolves.toMatchObject({ data: { id: 'purchase' } });
    expect(tx.reservationServicePurchase.create).toHaveBeenCalledOnce();
    expect(
      tx.reservationServicePurchase.create.mock.calls[0]?.[0].data,
    ).toMatchObject({
      serviceClientKey: CONTRACT_TOTAL_PURCHASE_KEY,
      serviceKind: 'OTHER',
      amount: '125.50',
      coveredServiceClientKeys: [
        CONTRACT_TOTAL_PURCHASE_KEY,
        'flight',
        'hotel',
      ],
    });
    expect(fx.capture).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        reservationPurchaseId: 'purchase',
        amount: '125.50',
        currencyCode: 'EUR',
      }),
    );
  });
});
