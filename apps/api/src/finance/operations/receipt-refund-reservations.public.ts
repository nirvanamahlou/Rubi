import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';

/** Read after the Sales contract lock; refund reservation writers share it. */
export async function reservedCustomerRefunds(
  tx: Prisma.TransactionClient,
  receipts: readonly { id: string; currencyCode: string }[],
  branchId: string,
): Promise<ReadonlyMap<string, string>> {
  if (!receipts.length) return new Map();
  const currencies = new Map(
    receipts.map((receipt) => [receipt.id, receipt.currencyCode]),
  );
  const requests = await tx.financeOperationalRequest.findMany({
    where: {
      branchId,
      refundReceiptId: { in: [...currencies.keys()] },
      status: { notIn: ['REJECTED', 'CANCELLED'] },
    },
    select: {
      refundReceiptId: true,
      currencyCode: true,
      amount: true,
      revisions: {
        orderBy: { version: 'desc' },
        take: 1,
        select: { cumulativePaid: true },
      },
    },
  });
  const Exact = Prisma.Decimal.clone({ precision: 60 });
  const totals = new Map<string, Prisma.Decimal>();
  for (const request of requests) {
    const currency = currencies.get(request.refundReceiptId ?? '');
    if (!currency || currency !== request.currencyCode)
      throw new ConflictException(
        'ارز استرداد با دریافت اصلی یکسان نیست؛ ابتدا تطبیق انجام شود.',
      );
    const remaining = Exact.max(
      0,
      new Exact(request.amount.toString()).sub(
        request.revisions[0]?.cumulativePaid?.toString() ?? '0',
      ),
    );
    totals.set(currency, (totals.get(currency) ?? new Exact(0)).add(remaining));
  }
  return new Map(
    [...totals].map(([currency, amount]) => [currency, amount.toString()]),
  );
}
