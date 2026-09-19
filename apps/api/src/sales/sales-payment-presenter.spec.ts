import { describe, expect, it, vi } from 'vitest';

import { presentSalesContract } from './sales.service';
import { SalesRepository, type SalesContractRow } from './sales.repository';
import type { DatabaseService } from '../database/database.service';

describe('Sales payment read projection', () => {
  it('exposes the recorded creator and resolved display name', () => {
    const now = new Date('2026-09-12T09:00:00.000Z');
    const row = {
      id: 'contract',
      contractNumber: 'SYNTH-01',
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
      status: 'DRAFT',
      settlementStatus: 'UNPAID',
      reservationStatus: 'NOT_REQUESTED',
      version: 1,
      createdAt: now,
      updatedAt: now,
      tripType: 'ONE_WAY',
      payerCustomerId: 'customer',
      ticketSelections: [],
      hotelSelection: null,
      priceComponents: [],
      payments: [
        {
          id: 'payment',
          amount: { toString: () => '100' },
          currencyCode: 'USD',
          dueAt: now,
          method: 'CASH',
          status: 'PENDING_FINANCE_CONFIRMATION',
          description: null,
          paymentReference: null,
          bankId: null,
          checkSecureIdentifier: null,
          checkOwnerName: null,
          checkDueDate: null,
          createdByUserId: 'user-1',
          createdAt: now,
          financeConfirmedAt: null,
        },
      ],
      fxRate: null,
      fxSource: null,
      fxObservedAt: null,
      pricingNotes: null,
      reservationRequests: [],
    } as unknown as SalesContractRow;

    expect(
      presentSalesContract(row, new Map([['user-1', 'کارشناس نمونه']]))
        .payments[0],
    ).toMatchObject({
      createdByUserId: 'user-1',
      createdByName: 'کارشناس نمونه',
    });
  });

  it('resolves distinct payment creator display names from IAM users', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: 'user-1', displayName: 'کارشناس نمونه' }]);
    const repository = new SalesRepository({
      client: { user: { findMany } },
    } as unknown as DatabaseService);

    await expect(
      repository.findUserDisplayNames(['user-1', 'user-1']),
    ).resolves.toEqual([{ id: 'user-1', displayName: 'کارشناس نمونه' }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['user-1'] } },
      select: { id: true, displayName: true },
    });
  });
});
