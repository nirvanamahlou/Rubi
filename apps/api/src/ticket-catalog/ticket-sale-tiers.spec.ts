import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';
import { validatePriceTiers, priceTierCreate } from './ticket-sale-tiers';

describe('ticket sale price tiers', () => {
  it('requires a gap-free schedule covering the entire offer', () => {
    const tiers = [
      { seatCount: 20, amount: '100' },
      { seatCount: 15, amount: '150' },
    ];
    expect(() => validatePriceTiers(tiers, '100.0000', 35)).not.toThrow();
    expect(
      priceTierCreate(tiers, 'IRR').map((tier) => [
        tier.tierIndex,
        tier.seatCount,
        tier.amount.toString(),
      ]),
    ).toEqual([
      [1, 20, '100'],
      [2, 15, '150'],
    ]);
    expect(() => validatePriceTiers(tiers, '100', 34)).toThrow();
    expect(() => validatePriceTiers(tiers, '101', 35)).toThrow();
    expect(() =>
      validatePriceTiers([{ seatCount: 35, amount: '0' }], '0', 35),
    ).toThrow();
    expect(() => validatePriceTiers(undefined, '100', 35)).not.toThrow();
  });

  it('rejects a stale tier quote inside the seat reservation transaction', async () => {
    const offerId = '10000000-0000-4000-8000-000000000001';
    const branchId = '10000000-0000-4000-8000-000000000002';
    const contractId = '10000000-0000-4000-8000-000000000003';
    const originId = '10000000-0000-4000-8000-000000000004';
    const destinationId = '10000000-0000-4000-8000-000000000005';
    const departureAt = '2099-10-01T08:00:00.000Z';
    const arrivalAt = '2099-10-01T10:00:00.000Z';
    const allocationCreate = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: offerId,
            branchId,
            originId,
            destinationId,
            departureAt: new Date(departureAt),
            arrivalAt: new Date(arrivalAt),
            cabinClassCode: 'ECONOMY',
            carrierName: 'Carrier',
            serviceNumber: '123',
            totalCapacity: 35,
            capacityAllocations: [{ quantity: 20 }],
            capacityHolds: [],
          },
        ]),
      },
      ticketOfferCapacityAllocation: {
        findMany: vi.fn().mockResolvedValue([]),
        create: allocationCreate,
      },
      ticketOfferStandaloneSalePrice: {
        findFirst: vi.fn().mockResolvedValue({
          amount: new Prisma.Decimal('100'),
          currencyCode: 'IRR',
          tiers: [
            { seatCount: 20, amount: new Prisma.Decimal('100') },
            { seatCount: 15, amount: new Prisma.Decimal('150') },
          ],
        }),
      },
      ticketSaleCommissionRevision: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new TicketPublicService(
      {
        client: { $transaction: (fn: (value: typeof tx) => unknown) => fn(tx) },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(
      service.reserve(
        [
          {
            serviceClientKey: 'flight-outbound',
            direction: 'OUTBOUND',
            offerId,
            originId,
            destinationId,
            departureAt,
            arrivalAt,
            cabinClassCode: 'ECONOMY',
            carrierNameSnapshot: 'Carrier',
            serviceNumberSnapshot: '123',
          },
        ],
        branchId,
        contractId,
        2,
        { 'flight-outbound': { amount: '200', currencyCode: 'IRR' } },
      ),
    ).rejects.toThrow('قیمت صندلی‌ها تغییر کرده است');
    expect(allocationCreate).not.toHaveBeenCalled();
  });
});
