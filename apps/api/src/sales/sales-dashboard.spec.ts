import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { SalesService } from './sales.service';
import type { SalesRepository, SalesContractRow } from './sales.repository';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';

function row(
  id: string,
  currencyCode: string,
  amount: string,
  paid: string,
): SalesContractRow {
  const now = new Date();
  return {
    id,
    contractNumber: id,
    customerId: 'customer',
    customerNameSnapshot: 'Synthetic',
    ownerUserId: 'owner',
    assignedUserId: null,
    branchId: 'branch',
    originId: 'origin',
    destinationId: 'destination',
    departureDate: now,
    returnNotBefore: null,
    services: [],
    passengers: [],
    status: 'ACTIVE',
    settlementStatus: 'OVERPAID',
    reservationStatus: 'NOT_REQUESTED',
    version: 1,
    createdAt: now,
    updatedAt: now,
    tripType: 'ONE_WAY',
    payerCustomerId: 'customer',
    ticketSelections: [],
    hotelSelection: null,
    priceComponents: [
      {
        type: 'BASE',
        title: 'Synthetic',
        amount: { toString: () => amount },
        currencyCode,
      },
    ],
    payments: [
      {
        id: 'payment',
        amount: { toString: () => paid },
        currencyCode,
        dueAt: now,
        method: 'CASH',
        status: 'FINANCE_CONFIRMED',
        createdByUserId: 'owner',
        createdAt: now,
        financeConfirmedAt: now,
      },
    ],
    fxRate: null,
    fxSource: null,
    fxObservedAt: null,
    pricingNotes: null,
    reservationRequests: [],
    buyerContact: null,
  } as unknown as SalesContractRow;
}

describe('Sales dashboard overpayments', () => {
  it('excludes cancelled contracts from every operational count and currency total while retaining completed sales', async () => {
    const unpaid = row('unpaid', 'IRR', '100', '0');
    unpaid.settlementStatus = 'UNPAID';
    const completed = row('completed', 'IRR', '25', '5');
    completed.status = 'COMPLETED';
    completed.settlementStatus = 'PARTIALLY_SETTLED';
    const settled = row('settled', 'IRR', '20', '20');
    settled.settlementStatus = 'SETTLED';
    const foreign = row('foreign', 'USD', '10.25', '15.2501');
    const cancelled = (
      ['UNPAID', 'PARTIALLY_SETTLED', 'SETTLED', 'OVERPAID'] as const
    ).map((settlementStatus) => {
      const contract = row(
        `cancelled-${settlementStatus}`,
        'EUR',
        '999999',
        '100',
      );
      contract.status = 'CANCELLED';
      contract.settlementStatus = settlementStatus;
      contract.ownerUserId = 'cancelled-owner';
      contract.reservationStatus = 'QUEUED';
      contract.payments[0]!.status = 'PENDING_FINANCE_CONFIRMATION';
      return contract;
    });
    const dashboardRows = vi
      .fn()
      .mockResolvedValue([unpaid, completed, settled, foreign, ...cancelled]);
    const service = new SalesService(
      { dashboardRows } as unknown as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    const actor = {
      userId: 'owner',
      branchIds: ['branch'],
      permissions: ['sales.contracts.read.own'],
    } as AuthenticatedActor;
    const { data } = await service.dashboard(actor);
    expect(data).toMatchObject({
      todayContracts: 4,
      activeContracts: 3,
      unpaidContracts: 1,
      partiallySettledContracts: 1,
      settledContracts: 1,
      rialSales: '145',
      foreignCommitments: [{ currencyCode: 'USD', amount: '10.25' }],
      outstanding: [
        { currencyCode: 'IRR', amount: '120' },
        { currencyCode: 'USD', amount: '-5.0001' },
      ],
      pendingFinancePayments: 0,
      pendingReservationActions: 0,
      salesByCounter: [
        { ownerUserId: 'owner', currencyCode: 'IRR', amount: '145' },
        { ownerUserId: 'owner', currencyCode: 'USD', amount: '10.25' },
      ],
    });
    expect(dashboardRows).toHaveBeenCalledWith({
      branchId: { in: ['branch'] },
      ownerUserId: 'owner',
    });
  });

  it('keeps signed outstanding totals per currency and retains authorization scope', async () => {
    const dashboardRows = vi
      .fn()
      .mockResolvedValue([
        row('a', 'IRR', '100', '150'),
        row('b', 'IRR', '25', '0'),
        row('c', 'USD', '10.25', '15.2501'),
      ]);
    const service = new SalesService(
      { dashboardRows } as unknown as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    const actor = {
      userId: 'owner',
      branchIds: ['branch'],
      permissions: ['sales.contracts.read.own'],
    } as AuthenticatedActor;
    const result = await service.dashboard(actor);
    expect(dashboardRows).toHaveBeenCalledWith({
      branchId: { in: ['branch'] },
      ownerUserId: 'owner',
    });
    expect(result.data.outstanding).toEqual([
      { currencyCode: 'IRR', amount: '-25' },
      { currencyCode: 'USD', amount: '-5.0001' },
    ]);
    expect(result.data.rialSales).toBe('125');
    expect(result.data.foreignCommitments).toEqual([
      { currencyCode: 'USD', amount: '10.25' },
    ]);
    expect(result.data.activeContracts).toBe(3);
  });
});

describe('filtered receivables', () => {
  const originId = '11111111-1111-4111-8111-111111111111';
  const destinationId = '22222222-2222-4222-8222-222222222222';
  const agencyId = '33333333-3333-4333-8333-333333333333';
  const actor = {
    userId: 'owner',
    branchIds: ['branch'],
    permissions: ['sales.contracts.read.own'],
  } as AuthenticatedActor;
  function setup() {
    const first = {
      ...row('one', 'IRR', '100.25', '20'),
      originId,
      destinationId,
      customerId: agencyId,
      createdAt: new Date('2026-10-01T23:59:59.999Z'),
      departureDate: new Date('2026-10-15'),
    };
    const second = {
      ...row('two', 'USD', '10', '12'),
      originId,
      destinationId,
      customerId: 'person',
      createdAt: new Date('2026-10-02'),
      departureDate: new Date('2026-10-16'),
    };
    const dashboardRows = vi.fn().mockResolvedValue([first, second]);
    const partyKinds = vi.fn().mockResolvedValue([
      { id: agencyId, kind: 'ORGANIZATION' },
      { id: 'person', kind: 'PERSON' },
    ]);
    const references = {
      detail: vi.fn(async (_resource: string, id: string) => ({
        data: { name: id === originId ? 'تهران' : 'استانبول' },
      })),
    };
    const service = new SalesService(
      { dashboardRows } as never,
      { partyKinds } as never,
      {} as never,
      undefined,
      undefined,
      undefined,
      references as never,
    );
    return { service, dashboardRows, partyKinds };
  }
  it('omits cancelled rows from filtered counts, balances and route/agency choices', async () => {
    const { service, dashboardRows, partyKinds } = setup();
    const source = await dashboardRows();
    const cancelled = row('cancelled', 'EUR', '999999', '0');
    cancelled.status = 'CANCELLED';
    cancelled.customerId = 'cancelled-agency';
    cancelled.originId = '55555555-5555-4555-8555-555555555555';
    cancelled.destinationId = '66666666-6666-4666-8666-666666666666';
    dashboardRows.mockResolvedValue([...source, cancelled]);
    partyKinds.mockResolvedValue([
      { id: agencyId, kind: 'ORGANIZATION' },
      { id: 'person', kind: 'PERSON' },
      { id: 'cancelled-agency', kind: 'ORGANIZATION' },
    ]);
    const { data } = await service.receivables({}, actor);
    expect(data.contractCount).toBe(2);
    expect(data.balances).toEqual([
      { currencyCode: 'IRR', amount: '80.25' },
      { currencyCode: 'USD', amount: '-2' },
    ]);
    expect(data.routes).toHaveLength(1);
    expect(data.agencies.map(({ id }) => id)).toEqual([agencyId]);
    expect(partyKinds).toHaveBeenCalledWith([agencyId, 'person'], actor);
    expect(
      (await service.receivables({ search: 'cancelled' }, actor)).data,
    ).toMatchObject({ contractCount: 0, balances: [] });
  });

  it('restricts agency contracts before repository pagination and preserves read scope', async () => {
    const list = vi
      .fn()
      .mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 });
    const service = new SalesService(
      {
        list,
        dashboardRows: vi
          .fn()
          .mockResolvedValue([
            { customerId: agencyId },
            { customerId: 'person' },
          ]),
      } as never,
      {
        partyKinds: vi.fn().mockResolvedValue([
          { id: agencyId, kind: 'ORGANIZATION' },
          { id: 'person', kind: 'PERSON' },
        ]),
      } as never,
      {} as never,
    );
    await service.list(
      { customerType: 'AGENCY', agencyCustomerId: agencyId },
      actor,
    );
    expect(list).toHaveBeenCalledWith(
      expect.anything(),
      {
        AND: [
          {
            branchId: { in: ['branch'] },
            ownerUserId: 'owner',
          },
          { customerId: { in: [agencyId] } },
          { customerId: agencyId },
        ],
      },
      false,
    );
  });
  it('combines text, settlement, agency and travel filters for exact balances', async () => {
    const { service } = setup();
    const result = await service.receivables(
      {
        search: 'ONE',
        settlementStatus: 'OVERPAID',
        customerType: 'AGENCY',
        agencyCustomerId: agencyId,
        dateBasis: 'TRAVEL',
        from: '2026-10-15',
        to: '2026-10-15',
      },
      actor,
    );
    expect(result.data.contractCount).toBe(1);
    expect(result.data.balances).toEqual([
      { currencyCode: 'IRR', amount: '80.25' },
    ]);
    expect(
      (
        await service.receivables(
          { search: 'one', settlementStatus: 'SETTLED' },
          actor,
        )
      ).data.contractCount,
    ).toBe(0);
  });
  it('uses inclusive contract date bounds, authorized scope and Decimal balances', async () => {
    const { service, dashboardRows } = setup();
    const result = await service.receivables(
      { from: '2026-10-01', to: '2026-10-01', originId, destinationId },
      actor,
    );
    expect(dashboardRows).toHaveBeenCalledWith({
      branchId: { in: ['branch'] },
      ownerUserId: 'owner',
    });
    expect(result.data.balances).toEqual([
      { currencyCode: 'IRR', amount: '80.25' },
    ]);
    expect(result.data.contractCount).toBe(1);
    expect(result.data.routes).toEqual([
      { originId, destinationId, label: 'تهران ← استانبول' },
    ]);
  });
  it('switches to travel dates and keeps agency/person and specific-agency filters distinct', async () => {
    const { service } = setup();
    expect(
      (
        await service.receivables(
          {
            dateBasis: 'TRAVEL',
            from: '2026-10-16',
            to: '2026-10-16',
            customerType: 'IN_PERSON',
          },
          actor,
        )
      ).data.balances,
    ).toEqual([{ currencyCode: 'USD', amount: '-2' }]);
    expect(
      (
        await service.receivables(
          { customerType: 'AGENCY', agencyCustomerId: agencyId },
          actor,
        )
      ).data.balances,
    ).toEqual([{ currencyCode: 'IRR', amount: '80.25' }]);
    expect(
      (
        await service.receivables(
          { destinationId: '44444444-4444-4444-8444-444444444444' },
          actor,
        )
      ).data,
    ).toMatchObject({ contractCount: 0, balances: [] });
  });
  it('rejects malformed filters and missing permission before reading data', async () => {
    const { service, dashboardRows, partyKinds } = setup();
    for (const query of [
      { from: '2026-02-30' },
      { from: '2026-10-02', to: '2026-10-01' },
      { agencyCustomerId: agencyId },
      { dateBasis: 'wrong' },
    ])
      await expect(
        service.receivables(query as never, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.receivables({}, { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dashboardRows).not.toHaveBeenCalled();
    expect(partyKinds).not.toHaveBeenCalled();
  });
  it('aggregates every authorized result rather than the first list page', async () => {
    const { service, dashboardRows } = setup();
    const source = await dashboardRows();
    dashboardRows.mockResolvedValue(
      Array.from({ length: 45 }, (_, index) => ({
        ...source[0],
        id: String(index),
      })),
    );
    const result = await service.receivables({}, actor);
    expect(result.data.contractCount).toBe(45);
    expect(result.data.balances).toEqual([
      { currencyCode: 'IRR', amount: '3611.25' },
    ]);
  });
});

it.each(['120123', 'ABC'])(
  'matches a substring of the public contract Notice in receivable counts and balances (%s)',
  async (search) => {
    const publicNote = row('other-number', 'IRR', '100', '10');
    publicNote.services = [
      {
        clientKey: 'public',
        kind: 'OTHER',
        titleSnapshot: 'Public',
        metadata: { contractNotice: 'prefix abc / 120123 / suffix' },
      },
    ] as never;
    const internal = row('internal', 'IRR', '999', '0');
    internal.pricingNotes = 'abc / 120123';
    internal.services = [
      {
        clientKey: 'internal',
        kind: 'OTHER',
        titleSnapshot: 'Internal',
        metadata: {
          reservationNote: 'abc / 120123',
          unrelated: 'abc / 120123',
        },
      },
    ] as never;
    const nonstring = row('numeric', 'IRR', '999', '0');
    nonstring.services = [
      {
        clientKey: 'numeric',
        kind: 'OTHER',
        titleSnapshot: 'Numeric',
        metadata: { contractNotice: 120123 },
      },
    ] as never;
    const dashboardRows = vi
      .fn()
      .mockResolvedValue([publicNote, internal, nonstring]);
    const service = new SalesService(
      { dashboardRows } as unknown as SalesRepository,
      {
        partyKinds: vi
          .fn()
          .mockResolvedValue([{ id: 'customer', kind: 'PERSON' }]),
      } as unknown as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    const actor = {
      userId: 'owner',
      branchIds: ['branch'],
      permissions: ['sales.contracts.read.own'],
    } as AuthenticatedActor;
    const result = await service.receivables({ search }, actor);
    expect(dashboardRows).toHaveBeenCalledWith({
      branchId: { in: ['branch'] },
      ownerUserId: 'owner',
    });
    expect(result.data.contractCount).toBe(1);
    expect(result.data.balances).toEqual([
      { currencyCode: 'IRR', amount: '90' },
    ]);
  },
);
