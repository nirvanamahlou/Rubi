import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { calculateSalesBalances } from './sales.domain';
import { netSalesPayments } from './sales-financial-settlement';

/** Shared with refund reservation writers; callers retain the transaction. */
export async function lockCustomerSettlement(
  tx: Prisma.TransactionClient,
  contractId: string,
  branchIds: readonly string[],
) {
  if (!branchIds.length) throw new NotFoundException();
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM sales_contracts WHERE id=${contractId}::uuid
      AND branch_id IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))}) FOR UPDATE
  `);
  if (!rows.length)
    throw new NotFoundException('قرارداد خرید در شعبه مجاز یافت نشد.');
}

/** Only money facts and source IDs leave Sales, never customer identity fields. */
export async function customerPurchaseSettlement(
  tx: Prisma.TransactionClient,
  contractId: string,
  branchIds: readonly string[],
) {
  await lockCustomerSettlement(tx, contractId, branchIds);
  const allocation = {
    amount: true,
    currencyCode: true,
    reversalOfId: true,
  } as const;
  const row = await tx.salesContract.findFirst({
    where: { id: contractId, branchId: { in: [...branchIds] } },
    select: {
      id: true,
      version: true,
      branchId: true,
      status: true,
      priceComponents: {
        select: { type: true, title: true, amount: true, currencyCode: true },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          currencyCode: true,
          status: true,
          refunds: { select: { amount: true } },
          allocations: { select: allocation },
        },
      },
      receiptAllocations: { select: allocation },
    },
  });
  if (!row) throw new NotFoundException('قرارداد خرید در شعبه مجاز یافت نشد.');
  const balances = calculateSalesBalances(
    row.priceComponents.map((component) => ({
      ...component,
      amount: component.amount.toString(),
    })),
    netSalesPayments(row.payments, row.receiptAllocations),
  );
  return {
    contractId: row.id,
    version: row.version,
    branchId: row.branchId,
    cancelled: row.status === 'CANCELLED',
    hasPriceBasis: row.priceComponents.length > 0,
    balances: balances.map((balance) => ({
      currencyCode: balance.currencyCode,
      outstanding: balance.outstanding,
    })),
    receipts: row.payments
      .filter((payment) => payment.status === 'FINANCE_CONFIRMED')
      .map((payment) => ({
        id: payment.id,
        currencyCode: payment.currencyCode,
      })),
  };
}
export type CustomerPurchaseSettlement = Awaited<
  ReturnType<typeof customerPurchaseSettlement>
>;

export function assertCustomerPurchaseCoverage(
  facts: CustomerPurchaseSettlement,
  reservedRefunds: ReadonlyMap<string, string>,
) {
  if (facts.cancelled)
    throw new ConflictException('خرید بلیط برای قرارداد ابطال‌شده مجاز نیست.');
  if (!facts.hasPriceBasis || !facts.balances.length)
    throw new ConflictException(
      'مبنای مبلغ قرارداد برای تأیید خرید بلیط کامل نیست.',
    );
  const Exact = Prisma.Decimal.clone({ precision: 60 });
  if (
    facts.balances.some((balance) =>
      new Exact(balance.outstanding)
        .add(reservedRefunds.get(balance.currencyCode) ?? '0')
        .gt(0),
    )
  )
    throw new ConflictException(
      'برای خرید بلیط مشتری، تسویه کامل قرارداد پس از کسر وجه رزروشده استرداد لازم است.',
    );
}
