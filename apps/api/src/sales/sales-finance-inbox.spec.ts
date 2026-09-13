import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { DatabaseService } from '../database/database.service';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

describe('Sales Finance inbox projection', () => {
  it('queries only pending payment entries in the requested branches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new SalesRepository({
      client: { salesContractPaymentEntry: { findMany } },
    } as unknown as DatabaseService);

    await repository.pendingFinancePayments(['branch-b', 'branch-a']);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING_FINANCE_CONFIRMATION',
        contract: { branchId: { in: ['branch-b', 'branch-a'] } },
      },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            customerId: true,
            customerNameSnapshot: true,
            branchId: true,
            version: true,
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    });
  });

  it('returns pending persisted payments within actor branches', async () => {
    const repository = {
      pendingFinancePayments: vi.fn().mockResolvedValue([
        {
          id: 'payment-1',
          amount: { toString: () => '4200.50' },
          currencyCode: 'EUR',
          method: 'BANK_TRANSFER',
          description: 'تسویه قرارداد',
          paymentReference: 'TRACK-1',
          dueAt: new Date('2026-09-13T08:00:00.000Z'),
          createdAt: new Date('2026-09-12T08:00:00.000Z'),
          createdByUserId: 'sales-user',
          contract: {
            id: 'contract-1',
            contractNumber: 'CNT-100',
            customerId: 'customer-1',
            customerNameSnapshot: 'مشتری قرارداد',
            branchId: 'branch-a',
            version: 4,
          },
        },
      ]),
      findUserDisplayNames: vi
        .fn()
        .mockResolvedValue([{ id: 'sales-user', displayName: 'کارشناس فروش' }]),
    };
    const service = new SalesService(
      repository as unknown as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    const result = await service.financeInbox({
      userId: 'finance-user',
      branchIds: ['branch-a'],
      permissions: ['finance.read'],
    } as unknown as AuthenticatedActor);
    expect(repository.pendingFinancePayments).toHaveBeenCalledWith([
      'branch-a',
    ]);
    expect(result).toMatchObject([
      {
        paymentId: 'payment-1',
        contractNumber: 'CNT-100',
        amount: '4200.50',
        createdByName: 'کارشناس فروش',
      },
    ]);
  });

  it('rejects callers without Finance read permission', async () => {
    const repository = { pendingFinancePayments: vi.fn() };
    const service = new SalesService(
      repository as unknown as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    await expect(
      service.financeInbox({
        userId: 'user',
        branchIds: ['branch-a'],
        permissions: [],
      } as unknown as AuthenticatedActor),
    ).rejects.toThrow('مجوز مشاهده کارتابل مالی');
    expect(repository.pendingFinancePayments).not.toHaveBeenCalled();
  });
});
