import { SalesService } from './sales.service';
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
  it('allocates pooled company cost to historical aggregate adults and children without infant seats', () => {
    const historical = {
      ...contract,
      passengersDetail: [],
      servicesDetail: [
        {
          ...contract.servicesDetail[0]!,
          metadata: {
            legacyServicePartiesV2: JSON.stringify({
              flight: { adults: 3, children: 1, infants: 1 },
            }),
          },
        },
      ],
      hotelSelection: null,
    };
    const result = contractProfit(historical, null, [
      {
        ...ticket,
        supplyType: 'COMPANY',
        poolCost: { seatCount: 150, totalCost: '3000' },
      },
    ]);
    expect(result.costs[0]?.amount).toBe('80');
    expect(result.complete).toBe(true);
  });

  it('includes both legs sharing one service and keeps profit unknown until both costs exist', () => {
    const shared = {
      ...contract,
      servicesDetail: [contract.servicesDetail[0]!],
      hotelSelection: null,
      priceComponents: [
        {
          type: 'BASE' as const,
          title: 'Sale',
          amount: '100',
          currencyCode: 'USD',
        },
      ],
      ticketSelections: [
        ...contract.ticketSelections,
        { ...contract.ticketSelections[0]!, offerId: 'return-offer' },
      ],
    };
    const costs = [
      { ...ticket, unitCost: '10' },
      { ...ticket, id: 'return-cost', offerId: 'return-offer', unitCost: '20' },
    ];
    const complete = contractProfit(shared, null, costs);
    expect(complete.costs).toHaveLength(2);
    expect(complete.totals[0]).toMatchObject({
      salesAmount: '100',
      purchaseAmount: '60',
      profitAmount: '40',
    });
    const incomplete = contractProfit(shared, null, [costs[0]!]);
    expect(incomplete.complete).toBe(false);
    expect(incomplete.totals[0]?.profitAmount).toBeNull();
  });
  it('allocates each flight total to the sold adult/child seats, rounds once and keeps infant and other contracts out', () => {
    const priced = {
      ...ticket,
      unitCost: '33.3333',
      seatCount: 3,
      invoiceAmount: '100',
    };
    const result = contractProfit(contract, intake, [priced]);
    expect(
      result.costs.find((c) => c.source === 'FINANCE_TICKET')?.amount,
    ).toBe('66.6667');
    const full = {
      ...contract,
      passengersDetail: [
        ...contract.passengersDetail,
        contract.passengersDetail[0]!,
      ],
    };
    expect(
      contractProfit(full, intake, [priced]).costs.find(
        (c) => c.source === 'FINANCE_TICKET',
      )?.amount,
    ).toBe('100');
    const returnTrip = {
      ...contract,
      servicesDetail: [
        ...contract.servicesDetail,
        { ...contract.servicesDetail[0]!, clientKey: 'return' },
      ],
      ticketSelections: [
        ...contract.ticketSelections,
        {
          ...contract.ticketSelections[0]!,
          serviceClientKey: 'return',
          offerId: 'return-offer',
        },
      ],
      passengersDetail: contract.passengersDetail.map((p) => ({
        ...p,
        serviceClientKeys: [...p.serviceClientKeys, 'return'],
      })),
    };
    const both = contractProfit(returnTrip, intake, [
      priced,
      {
        ...priced,
        id: 'return-cost',
        offerId: 'return-offer',
        invoiceAmount: '150',
      },
    ]);
    expect(
      both.costs
        .filter((c) => c.source === 'FINANCE_TICKET')
        .map((c) => c.amount),
    ).toEqual(['66.6667', '100']);
  });
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
    const sales = { detailForProfit: vi.fn(async () => ({ data: contract })) };
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
    expect(sales.detailForProfit).not.toHaveBeenCalled();
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

it('keeps the Finance-only Sales projection branch-scoped before presentation', async () => {
  const service = Object.create(SalesService.prototype) as SalesService;
  const findById = vi.fn(async () => ({ branchId: 'foreign' }));
  Object.assign(service, { repository: { findById } });
  await expect(
    service.detailForProfit('contract', {
      permissions: [],
      branchIds: ['foreign'],
    } as never),
  ).rejects.toThrow();
  expect(findById).not.toHaveBeenCalled();
  await expect(
    service.detailForProfit('contract', {
      permissions: ['finance.read'],
      branchIds: ['allowed'],
    } as never),
  ).rejects.toThrow();
  expect(findById).toHaveBeenCalledOnce();
});

it('charges four seats out of sixty only once from the capacity purchase', () => {
  const four = {
    ...contract,
    passengersDetail: Array.from({ length: 4 }, () => ({
      ageCategory: 'ADT',
      serviceClientKeys: ['flight'],
    })),
  } as unknown as SalesContractDetail;
  const cost = {
    ...ticket,
    supplyType: 'COMPANY',
    seatCount: 60,
    invoiceAmount: '600',
    unitCost: '10',
  };
  const duplicate = {
    ...intake,
    servicePurchases: [
      ...intake.servicePurchases!,
      purchase('old-contract-flight', ['flight'], '999', 'USD'),
    ],
  } as ReservationIntakeV1;
  const result = contractProfit(four, duplicate, [cost]);
  expect(
    result.costs.find((row) => row.source === 'FINANCE_TICKET')?.amount,
  ).toBe('40');
  expect(
    result.costs.some((row) => row.referenceId === 'old-contract-flight'),
  ).toBe(false);
});

it('does not accept a legacy per-contract company cost when the capacity invoice is missing', () => {
  const legacy = {
    ...intake,
    servicePurchases: [
      ...intake.servicePurchases!,
      purchase('legacy-company', ['flight'], '999', 'USD'),
    ],
  } as ReservationIntakeV1;
  const result = contractProfit(contract, legacy, [], ['offer']);
  expect(result.costs.some((row) => row.referenceId === 'legacy-company')).toBe(
    false,
  );
  expect(result.complete).toBe(false);
});

it('uses four consumed seats from a 150-seat recurring pool and ignores per-departure rounding', () => {
  const four = {
    ...contract,
    passengersDetail: Array.from({ length: 4 }, () => ({
      ageCategory: 'ADT',
      serviceClientKeys: ['flight'],
    })),
  } as unknown as SalesContractDetail;
  const cost = {
    ...ticket,
    supplyType: 'COMPANY',
    seatCount: 50,
    invoiceAmount: '33.3333',
    unitCost: '0.6667',
    poolCost: { seatCount: 150, totalCost: '100' },
  };
  const result = contractProfit(four, intake, [cost]);
  expect(result.costs.find((r) => r.source === 'FINANCE_TICKET')?.amount).toBe(
    '2.6667',
  );
});

it('avoids a rounded departure share when a single seat consumes part of the pool', () => {
  const one = {
    ...contract,
    passengersDetail: [{ ageCategory: 'ADT', serviceClientKeys: ['flight'] }],
  } as unknown as SalesContractDetail;
  const cost = {
    ...ticket,
    supplyType: 'COMPANY',
    seatCount: 2,
    invoiceAmount: '0.6667',
    unitCost: '0.3333',
    poolCost: { seatCount: 3, totalCost: '1' },
  };
  expect(
    contractProfit(one, intake, [cost]).costs.find(
      (r) => r.source === 'FINANCE_TICKET',
    )?.amount,
  ).toBe('0.3333');
});
