import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';

export const PETTY_KINDS = [
  'PETTY_CASH_ADVANCE',
  'PETTY_CASH_TOPUP',
  'PETTY_CASH_EXPENSE',
  'PETTY_CASH_RETURN',
];

/** Call while holding the parent fund lock. Only confirmed movements affect balance. */
export async function pettyBalance(
  tx: Prisma.TransactionClient,
  fundId: string,
) {
  const paid = await tx.financeOperationalRevision.aggregate({
    where: {
      action: 'PAY',
      request: {
        OR: [{ id: fundId }, { pettyFundId: fundId, kind: 'PETTY_CASH_TOPUP' }],
      },
    },
    _sum: { paidAmount: true },
  });
  const spent = await tx.financeOperationalRequest.aggregate({
    where: { pettyFundId: fundId, kind: 'PETTY_CASH_EXPENSE', status: 'PAID' },
    _sum: { amount: true },
  });
  const returned = await tx.financeOperationalRevision.aggregate({
    where: {
      action: 'PAY',
      request: { pettyFundId: fundId, kind: 'PETTY_CASH_RETURN' },
    },
    _sum: { paidAmount: true },
  });
  const zero = new Prisma.Decimal(0);
  const funded = paid._sum.paidAmount ?? zero,
    expenses = spent._sum.amount ?? zero,
    receipts = returned._sum.paidAmount ?? zero;
  return {
    funded,
    expenses,
    returned: receipts,
    available: funded.sub(expenses).sub(receipts),
  };
}

export async function lockPettyFund(
  tx: Prisma.TransactionClient,
  fundId: string,
  branchId: string,
  currency: string,
) {
  await tx.$queryRaw`SELECT id FROM finance_operational_requests WHERE id=${fundId}::uuid FOR UPDATE`;
  const fund = await tx.financeOperationalRequest.findFirst({
    where: {
      id: fundId,
      branchId,
      currencyCode: currency,
      kind: 'PETTY_CASH_ADVANCE',
    },
  });
  if (!fund || !['APPROVED', 'PAYING', 'PAID'].includes(fund.status))
    throw new ConflictException(
      'تنخواه تأییدشده و باز با شعبه و ارز یکسان لازم است.',
    );
  return fund;
}
