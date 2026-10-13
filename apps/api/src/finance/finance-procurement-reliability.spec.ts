import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { FinanceInboxService } from './finance-inbox.service';

const actor = {
  userId: 'finance-user',
  branchIds: ['branch-a'],
  permissions: [
    'finance.read',
    'finance.payment.create',
    'finance.receipt.approve',
  ],
} as unknown as AuthenticatedActor;
function fixture(status = 'CORRECTION_REQUIRED', paid = '0') {
  const create = vi.fn(async ({ data }) => ({
    ...data,
    id: 'finance-revision',
    remainingAmount: new Prisma.Decimal(data.remainingAmount),
    createdAt: new Date('2026-10-04T10:00:00Z'),
  }));
  const source = {
    sourceId: 'invoice-1',
    sourceVersion: 2,
    branchId: 'branch-a',
    amount: '150',
    currencyCode: 'IRR',
  };
  const tx = {
    financeProcurementInvoiceRevision: {
      findFirst: vi.fn().mockResolvedValue({
        version: 1,
        sourceVersion: 1,
        status,
        cumulativePaid: new Prisma.Decimal(paid),
      }),
      create,
    },
  };
  const procurement = {
    financeInvoiceSource: vi.fn().mockResolvedValue(source),
    applyFinanceResult: vi.fn().mockResolvedValue('applied'),
  };
  const service = new FinanceInboxService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      client: {
        $transaction: (work: (transaction: typeof tx) => unknown) => work(tx),
      },
    } as never,
    procurement as never,
    {} as never,
  );
  return { service, create, procurement };
}
describe('Procurement source version integrity', () => {
  it('rejects approval of a producer version newer than the amount the user reviewed', async () => {
    const f = fixture();
    await expect(
      f.service.decideProcurementInvoice(
        'invoice-1',
        {
          version: 1,
          expectedVersion: 1,
          expectedSourceVersion: 1,
          action: 'APPROVE',
        },
        actor,
      ),
    ).rejects.toThrow('نسخه فاکتور');
    expect(f.create).not.toHaveBeenCalled();
  });
  it('allows a corrected, unpaid new source version to be reviewed with the next Finance revision', async () => {
    const f = fixture();
    expect(
      await f.service.decideProcurementInvoice(
        'invoice-1',
        { version: 1, expectedVersion: 1, action: 'APPROVE' },
        actor,
      ),
    ).toMatchObject({ status: 'APPROVED', version: 2 });
    expect(f.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceVersion: 2,
        version: 2,
        remainingAmount: '150',
      }),
    });
  });
  it('does not reset a paid source or silently reuse approval from an older source', async () => {
    const f = fixture('APPROVED', '10');
    await expect(
      f.service.decideProcurementInvoice(
        'invoice-1',
        { version: 1, expectedVersion: 1, action: 'APPROVE' },
        actor,
      ),
    ).rejects.toThrow('قبلاً');
    await expect(
      f.service.payProcurementInvoice(
        'invoice-1',
        {
          version: 1,
          expectedVersion: 1,
          accountId: 'account',
          paymentMethodId: 'method',
          paidAmount: '10',
          transferAt: '2026-10-04T10:00:00Z',
        },
        actor,
      ),
    ).rejects.toThrow('هم‌زمان');
    expect(f.create).not.toHaveBeenCalled();
    expect(f.procurement.applyFinanceResult).not.toHaveBeenCalled();
  });
});
