import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

/** Called only after Sales authorizes access to the specific contract. */
export async function salesReceiptAccounts(
  db: Pick<Prisma.TransactionClient, 'financeSettlementAccount'>,
  branchId: string,
) {
  return db.financeSettlementAccount.findMany({
    where: { branchId, isActive: true },
    select: {
      id: true,
      title: true,
      currencyCode: true,
      kind: true,
      maskedIdentifier: true,
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });
}

/** Validate in the Sales payment transaction; never confirms a receipt. */
export async function salesReceiptDestination(
  db: Pick<Prisma.TransactionClient, 'financeSettlementAccount'>,
  input: { destinationAccountId?: string | null; currencyCode: string },
  branchId: string,
) {
  if (!input.destinationAccountId) return {};
  const account = await db.financeSettlementAccount.findFirst({
    where: {
      id: input.destinationAccountId,
      branchId,
      currencyCode: input.currencyCode.toUpperCase(),
      isActive: true,
    },
    select: { id: true, title: true },
  });
  if (!account)
    throw new BadRequestException(
      'حساب مقصد برای شعبه و ارز پرداخت معتبر نیست.',
    );
  return {
    destinationAccountId: account.id,
    destinationAccountTitle: account.title,
  };
}
