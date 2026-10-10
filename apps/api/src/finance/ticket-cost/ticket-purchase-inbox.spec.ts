import { describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
const actor = {
  userId: 'buyer',
  branchIds: ['branch'],
  permissions: ['procurement.quote.manage'],
} as unknown as AuthenticatedActor;
const input = {
  version: 1 as const,
  operationId: '11111111-1111-4111-8111-111111111111',
  expectedCostVersion: 0,
  seatCount: 20,
  unitCost: '125.5001',
  currencyCode: 'USD',
};
type Row = {
  id: string;
  requestId: string;
  version: number;
  branchId: string;
  offerId: string | null;
  offerVersion: number | null;
  reason: string;
  adultUnitCost: Prisma.Decimal;
  childUnitCost: Prisma.Decimal;
  seatCount: number | null;
  unitCost: Prisma.Decimal | null;
  invoiceAmount: Prisma.Decimal;
  currencyCode: string;
  payments: { id: string }[];
};
function fixture() {
  const rows: Row[] = [];
  const create = vi.fn(async ({ data }: { data: Omit<Row, 'payments'> }) => {
    const row = { ...data, payments: [] };
    rows.push(row);
    return row;
  });
  const findFirst = vi.fn(
    async ({ where }: { where: { reason?: { startsWith: string } } }) =>
      where.reason
        ? (rows.find((r) => r.reason.startsWith(where.reason!.startsWith)) ??
          null)
        : (rows.at(-1) ?? null),
  );
  const tx = {
    $queryRaw: vi.fn(),
    financeTicketPurchaseCostRevision: { create, findFirst },
  };
  const procurement = {
    forFinance: vi.fn(async (_id: string, branches: string[]) => {
      if (!branches.includes('branch')) throw new ForbiddenException();
      return {
        branchId: 'branch',
        offerId: 'offer',
        offerVersion: 1,
        seatCount: 20,
        supplierDisplaySnapshot: 'Airline',
      };
    }),
  };
  return {
    rows,
    create,
    procurement,
    service: new FinanceTicketCostService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as never,
      procurement as never,
    ),
  };
}
describe('Travel purchase cost handoff', () => {
  it('requires buyer permission and branches; Finance payment permission cannot price', async () => {
    const f = fixture();
    await expect(
      f.service.recordCost('request', input, {
        ...actor,
        permissions: ['finance.payment.create'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.procurement.forFinance).not.toHaveBeenCalled();
    await expect(
      f.service.recordCost('request', input, {
        ...actor,
        branchIds: ['other'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.create).not.toHaveBeenCalled();
  });
  it('computes exact charter total and retries only the same immutable operation', async () => {
    const f = fixture();
    const a = await f.service.recordCost('request', input, actor);
    const b = await f.service.recordCost('request', input, actor);
    expect(a).toEqual(b);
    expect(a.invoiceAmount).toBe('2510.002');
    expect(a.unitCost).toBe('125.5001');
    expect(f.create).toHaveBeenCalledTimes(1);
    await expect(
      f.service.recordCost('request', { ...input, unitCost: '126' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects oversize seats, stale price correction and edits after partial payment', async () => {
    const f = fixture();
    await expect(
      f.service.recordCost('request', { ...input, seatCount: 21 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await f.service.recordCost('request', input, actor);
    const next = {
      ...input,
      operationId: '22222222-2222-4222-8222-222222222222',
    };
    await expect(
      f.service.recordCost('request', next, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    f.rows[0]!.payments = [{ id: 'payment' }];
    await expect(
      f.service.recordCost(
        'request',
        { ...next, expectedCostVersion: 1 },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.create).toHaveBeenCalledTimes(1);
  });
});
