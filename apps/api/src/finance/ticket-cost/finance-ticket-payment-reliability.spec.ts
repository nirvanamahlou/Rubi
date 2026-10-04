import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { FinanceTicketCostService } from './finance-ticket-cost.service';

const actor = {
  userId: 'finance-user',
  branchIds: ['branch-a'],
  permissions: ['finance.payment.create'],
} as unknown as AuthenticatedActor;
const command = {
  version: 1 as const,
  operationId: '10000000-0000-4000-8000-000000000001',
  expectedPaymentVersion: 0,
  costRevisionId: '20000000-0000-4000-8000-000000000001',
  accountId: '30000000-0000-4000-8000-000000000001',
  paymentMethodId: '40000000-0000-4000-8000-000000000001',
  paidAmount: '40',
  exchangeRateToIrr: '1',
  transferAt: '2026-10-04T10:00:00.000Z',
};
function fixture() {
  const cost = {
    id: command.costRevisionId,
    requestId: 'request-1',
    branchId: 'branch-a',
    currencyCode: 'IRR',
    invoiceAmount: new Prisma.Decimal(100),
  };
  const rows: Record<string, unknown>[] = [];
  const create = vi.fn(async ({ data }) => {
    const row = { ...data, cost };
    rows.push(row);
    return row;
  });
  const lock = vi.fn();
  const tx = {
    $queryRaw: lock,
    financeTicketPurchasePaymentRevision: {
      findUnique: vi.fn(
        async ({ where }) => rows.find((row) => row.id === where.id) ?? null,
      ),
      findFirst: vi.fn(async () => rows.at(-1) ?? null),
      create,
    },
    financeTicketPurchaseCostRevision: { findFirst: vi.fn(async () => cost) },
    financeSettlementAccount: {
      findFirst: vi.fn(async () => ({ id: command.accountId })),
    },
    masterPaymentMethod: {
      findFirst: vi.fn(async () => ({ id: command.paymentMethodId })),
    },
  };
  // Serializes competing transactions like the service's PostgreSQL advisory lock.
  let tail: Promise<unknown> = Promise.resolve();
  const database = {
    client: {
      financeTicketPurchasePaymentRevision:
        tx.financeTicketPurchasePaymentRevision,
      $transaction: (work: (value: typeof tx) => unknown) => {
        const result = tail.then(() => work(tx));
        tail = result.catch(() => undefined);
        return result;
      },
    },
  };
  const procurement = {
    forFinance: vi.fn(async () => ({
      branchId: 'branch-a',
      requestVersion: 1,
    })),
    markFinancePaid: vi.fn(),
  };
  const service = new FinanceTicketCostService(
    database as never,
    procurement as never,
  );
  return { service, create, rows, procurement, lock };
}
describe('Ticket payment replay and concurrency', () => {
  it('replays a partial payment without a second revision', async () => {
    const f = fixture();
    const first = await f.service.recordPayment('request-1', command, actor);
    expect(await f.service.recordPayment('request-1', command, actor)).toEqual(
      first,
    );
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(first.remainingAmount).toBe('60');
  });
  it('replays full settlement even when the procurement request is no longer pending', async () => {
    const f = fixture();
    const full = { ...command, paidAmount: '100' };
    const first = await f.service.recordPayment('request-1', full, actor);
    f.procurement.forFinance.mockRejectedValueOnce(new Error('already paid'));
    expect(await f.service.recordPayment('request-1', full, actor)).toEqual(
      first,
    );
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.procurement.markFinancePaid).toHaveBeenCalledTimes(1);
  });
  it('rejects reused identifiers with a different amount, actor or branch', async () => {
    const f = fixture();
    await f.service.recordPayment('request-1', command, actor);
    await expect(
      f.service.recordPayment(
        'request-1',
        { ...command, paidAmount: '41' },
        actor,
      ),
    ).rejects.toThrow('شناسه عملیات');
    await expect(
      f.service.recordPayment('request-1', command, {
        ...actor,
        userId: 'other',
      }),
    ).rejects.toThrow('شناسه عملیات');
    await expect(
      f.service.recordPayment('request-1', command, {
        ...actor,
        branchIds: ['other'],
      }),
    ).rejects.toThrow('شناسه عملیات');
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it('accepts only one of two new payments using the same observed version', async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.service.recordPayment('request-1', command, actor),
      f.service.recordPayment(
        'request-1',
        { ...command, operationId: '10000000-0000-4000-8000-000000000002' },
        actor,
      ),
    ]);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.lock).toHaveBeenCalledTimes(4);
  });
  it('rejects excess payment, invalid identifiers and malformed FX before writes', async () => {
    const f = fixture();
    await expect(
      f.service.recordPayment(
        'request-1',
        { ...command, paidAmount: '101' },
        actor,
      ),
    ).rejects.toThrow('بیش از');
    await expect(
      f.service.recordPayment(
        'request-1',
        { ...command, operationId: 'invalid' },
        actor,
      ),
    ).rejects.toThrow('معتبر');
    await expect(
      f.service.recordPayment(
        'request-1',
        { ...command, exchangeRateToIrr: 'not-a-number' },
        actor,
      ),
    ).rejects.toThrow('نرخ');
    expect(f.create).not.toHaveBeenCalled();
  });
});
