import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';
import type { DatabaseService } from '../database/database.service';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

function salesReceiptPages(findMany: ReturnType<typeof vi.fn>) {
  const tx = { salesContractPaymentEntry: { findMany } };
  const transaction = vi.fn(async (read: (client: typeof tx) => unknown) =>
    read(tx),
  );
  return {
    repository: new SalesRepository({
      client: { $transaction: transaction },
    } as unknown as DatabaseService),
    transaction,
  };
}

describe('Sales Finance inbox projection', () => {
  it('queries pending and due scheduled receipts only in the requested branches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { repository } = salesReceiptPages(findMany);

    await repository.pendingFinancePayments(['branch-b', 'branch-a']);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { status: 'PENDING_FINANCE_CONFIRMATION' },
          { status: 'SCHEDULED', dueAt: { lte: expect.any(Date) } },
        ],
        contract: { AND: [{ branchId: { in: ['branch-b', 'branch-a'] } }, {}] },
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currencyCode: true,
        method: true,
        description: true,
        paymentReference: true,
        destinationAccountId: true,
        destinationAccountTitle: true,
        dueAt: true,
        createdAt: true,
        createdByUserId: true,
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

  it('includes confirmed receipts only when explicitly requested, within the same branch scope', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { repository } = salesReceiptPages(findMany);
    await repository.pendingFinancePayments(['branch-a'], true);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([{ status: 'FINANCE_CONFIRMED' }]),
          contract: { AND: [{ branchId: { in: ['branch-a'] } }, {}] },
        },
      }),
    );
    expect(findMany.mock.calls[0]![0]).toHaveProperty('take', 200);
  });

  it.each([false, true])(
    'reads receipts beyond the first 200 in a consistent snapshot (%s)',
    async (includeConfirmed) => {
      const first = Array.from({ length: 200 }, (_, index) => ({
        id: String(index),
      }));
      const last = { id: '200' };
      const findMany = vi
        .fn()
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce([last]);
      const { repository, transaction } = salesReceiptPages(findMany);
      const scope = { contractNumber: { startsWith: 'SYN-' } };

      expect(
        await repository.pendingFinancePayments(
          ['branch-a'],
          includeConfirmed,
          scope,
        ),
      ).toEqual([...first, last]);
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'RepeatableRead',
      });
      expect(findMany).toHaveBeenCalledTimes(2);
      expect(findMany.mock.calls[1]![0]).toEqual({
        ...findMany.mock.calls[0]![0],
        cursor: { id: '199' },
        skip: 1,
      });
      expect(findMany.mock.calls[1]![0].where.contract.AND).toEqual([
        { branchId: { in: ['branch-a'] } },
        scope,
      ]);
    },
  );

  it.each([false, true])(
    'projects persisted confirmation state within actor branches (%s)',
    async (includeConfirmed) => {
      const repository = {
        pendingFinancePayments: vi.fn().mockResolvedValue([
          {
            id: 'payment-1',
            status: includeConfirmed
              ? 'FINANCE_CONFIRMED'
              : 'PENDING_FINANCE_CONFIRMATION',
            amount: { toString: () => '4200.50' },
            currencyCode: 'EUR',
            method: 'BANK_TRANSFER',
            description: 'تسویه قرارداد',
            paymentReference: 'TRACK-1',
            destinationAccountId: 'declared',
            destinationAccountTitle: 'Saved title',
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
          .mockResolvedValue([
            { id: 'sales-user', displayName: 'کارشناس فروش' },
          ]),
      };
      const service = new SalesService(
        repository as unknown as SalesRepository,
        {} as SalesCustomersPublicAdapter,
        {} as SalesTicketAvailabilityPort,
      );
      const result = await service.financeInbox(
        {
          userId: 'finance-user',
          branchIds: ['branch-a'],
          permissions: ['finance.read'],
        } as unknown as AuthenticatedActor,
        includeConfirmed,
      );
      expect(repository.pendingFinancePayments).toHaveBeenCalledWith(
        ['branch-a'],
        includeConfirmed,
        {},
      );
      expect(result).toMatchObject([
        {
          financeConfirmed: includeConfirmed,
          paymentId: 'payment-1',
          contractNumber: 'CNT-100',
          amount: '4200.50',
          destinationAccountId: 'declared',
          destinationAccountTitle: 'Saved title',
          createdByName: 'کارشناس فروش',
        },
      ]);
    },
  );

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

it('rejects a changed destination inside the locked Sales confirmation transaction', async () => {
  const update = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    salesContractPaymentEntry: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'payment', destinationAccountId: 'declared' }),
      update,
    },
  };
  const repository = new SalesRepository({
    client: { $transaction: (work: (tx: unknown) => unknown) => work(tx) },
  } as never);
  await expect(
    repository.applyFinanceConfirmation({
      contractId: 'contract',
      paymentId: 'payment',
      receiptAccountId: 'changed',
    } as never),
  ).rejects.toThrow('حساب مقصد ثبت‌شده در پرداخت قابل تغییر نیست.');
  expect(tx.$queryRaw).toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
