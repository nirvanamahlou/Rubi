import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

/** Minimal frozen HR payment source for Finance. Never exposes private worksheet cells. */
export async function payrollWorksheetPaymentSource(
  tx: Pick<Prisma.TransactionClient, 'hrRecord'>,
  id: string,
  branches: readonly string[],
) {
  const row = await tx.hrRecord.findFirst({
    where: {
      id,
      branchId: { in: [...branches] },
      section: 'payrollWorksheets',
      tab: 'sheet',
      deletedAt: null,
    },
    include: { amounts: { where: { field: 'remaining' } } },
  });
  if (!row) throw new NotFoundException('جدول حقوق مجاز یافت نشد.');
  const amount = row.amounts[0];
  if (
    row.status !== 'PENDING_FINANCE' ||
    !amount?.amount.isPositive() ||
    amount.currency !== 'IRR'
  )
    throw new ConflictException('نسخه مبنای جدول حقوق تغییر کرده است.');
  return {
    id: row.id,
    version: row.version,
    amount: amount.amount.toString(),
    currencyCode: amount.currency,
  };
}
