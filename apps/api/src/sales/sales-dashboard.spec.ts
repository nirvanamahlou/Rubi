import { describe, expect, it, vi } from 'vitest';
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
