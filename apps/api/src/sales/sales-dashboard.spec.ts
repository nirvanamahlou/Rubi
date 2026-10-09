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
      OR: [{ ownerUserId: 'owner' }, { assignedUserId: 'owner' }],
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
  it('uses inclusive contract date bounds, authorized scope and Decimal balances', async () => {
    const { service, dashboardRows } = setup();
    const result = await service.receivables(
      { from: '2026-10-01', to: '2026-10-01', originId, destinationId },
      actor,
    );
    expect(dashboardRows).toHaveBeenCalledWith({
      branchId: { in: ['branch'] },
      OR: [{ ownerUserId: 'owner' }, { assignedUserId: 'owner' }],
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
