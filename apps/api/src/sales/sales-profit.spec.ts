import { describe, expect, it, vi } from 'vitest';
import type { SalesContractDetail, ReservationIntakeV1 } from '@nora/contracts';
import { contractProfit } from './sales-profit';
import { SalesProfitService } from './sales-profit.service';
const contract = {
  id: 'contract',
  branchId: 'branch',
  servicesDetail: [
    'flight',
    'hotel',
    'transfer-out',
    'transfer-back',
    'insurance',
  ].map((clientKey) => ({
    clientKey,
    kind:
      clientKey === 'flight'
        ? 'FLIGHT'
        : clientKey === 'hotel'
          ? 'HOTEL'
          : clientKey === 'insurance'
            ? 'INSURANCE'
            : 'TRANSFER',
  })),
  priceComponents: [
    { type: 'BASE', amount: '9007199254740993.1234', currencyCode: 'IRR' },
    { type: 'BASE', amount: '300', currencyCode: 'USD' },
  ],
  passengersDetail: [
    { ageCategory: 'ADT', serviceClientKeys: ['flight'] },
    { ageCategory: 'CHD', serviceClientKeys: ['flight'] },
    { ageCategory: 'INF', serviceClientKeys: ['flight'] },
  ],
  ticketSelections: [{ serviceClientKey: 'flight', offerId: 'offer' }],
  hotelSelection: { serviceClientKey: 'hotel' },
} as unknown as SalesContractDetail;
const purchase = (
  id: string,
  keys: string[],
  amount: string,
  currencyCode = 'IRR',
) => ({
  id,
  serviceClientKey: keys[0],
  coveredServiceClientKeys: keys,
  amount,
  currencyCode,
});
const intake = {
  servicePurchases: [
    purchase('hotel', ['hotel'], '100.0001'),
    purchase('transfer', ['transfer-out', 'transfer-back'], '30'),
    purchase('insurance', ['insurance'], '5'),
  ],
  hotelPurchases: [{ id: 'legacy', amount: '999', currencyCode: 'IRR' }],
} as unknown as ReservationIntakeV1;
const ticket = {
  id: 'finance-cost',
  offerId: 'offer',
  adultUnitCost: '40.0001',
  childUnitCost: '20.0002',
  unitCost: null,
  currencyCode: 'USD',
};
describe('actual contract package margin', () => {
  it('subtracts each actual purchase once and costs only the assigned adult/child seats, in exact separate currencies', () => {
    const result = contractProfit(contract, intake, [ticket]);
    expect(result.complete).toBe(true);
    expect(result.costs).toHaveLength(4);
    expect(result.totals).toEqual([
      {
        currencyCode: 'IRR',
        salesAmount: '9007199254740993.1234',
        purchaseAmount: '135.0001',
        profitAmount: '9007199254740858.1233',
      },
      {
        currencyCode: 'USD',
        salesAmount: '300',
        purchaseAmount: '60.0003',
        profitAmount: '239.9997',
      },
    ]);
  });
  it('withholds profit while insurance or Finance ticket cost is missing instead of counting missing costs as zero', () => {
    const result = contractProfit(
      contract,
      { ...intake, servicePurchases: intake.servicePurchases!.slice(0, 2) },
      [],
    );
    expect(result.missingServiceKeys).toEqual(['flight', 'insurance']);
    expect(result.totals.every((r) => r.profitAmount === null)).toBe(true);
  });
  it('does not double-count a partially replaced combined transfer purchase', () => {
    const result = contractProfit(
      contract,
      {
        ...intake,
        servicePurchases: [
          purchase('new', ['transfer-out'], '10'),
          ...intake.servicePurchases!,
        ],
      } as unknown as ReservationIntakeV1,
      [ticket],
    );
    expect(result.missingServiceKeys).toContain('transfer-back');
    expect(result.costs.some((c) => c.referenceId === 'transfer')).toBe(false);
  });
  it('requires financial permission and an authorized Sales contract before public cost queries', async () => {
    const sales = { detail: vi.fn(async () => ({ data: contract })) };
    const reservations = { contractPurchaseContext: vi.fn(async () => intake) };
    const finance = { recordedCostsForOffers: vi.fn(async () => [ticket]) };
    const service = new SalesProfitService(
      sales as never,
      reservations as never,
      finance as never,
    );
    await expect(
      service.detail('contract', {
        permissions: [],
        branchIds: ['branch'],
      } as never),
    ).rejects.toThrow();
    expect(sales.detail).not.toHaveBeenCalled();
    await expect(
      service.detail('contract', {
        permissions: ['finance.read'],
        branchIds: ['other'],
      } as never),
    ).rejects.toThrow();
    expect(finance.recordedCostsForOffers).not.toHaveBeenCalled();
    await expect(
      service.detail('contract', {
        permissions: ['finance.read'],
        branchIds: ['branch'],
      } as never),
    ).resolves.toMatchObject({ data: { complete: true } });
    expect(reservations.contractPurchaseContext).toHaveBeenCalledWith(
      'contract',
      'branch',
    );
    expect(finance.recordedCostsForOffers).toHaveBeenCalledWith(
      ['offer'],
      'branch',
    );
  });
});
