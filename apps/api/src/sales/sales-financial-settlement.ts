import { Prisma, type SalesPaymentStatus } from '@nora/database';
import { calculateSalesBalances } from './sales.domain';
import { revokeObsoleteCustomerRelease } from '../finance/document-delivery/financial-release.public';

export type ReceiptAllocationMoney = {
  amount: { toString(): string };
  reversalOfId: string | null;
  currencyCode?: string;
};
export function netReceiptAllocations(
  rows: readonly ReceiptAllocationMoney[] = [],
) {
  return rows.reduce(
    (sum, row) =>
      sum.add(
        new Prisma.Decimal(row.amount.toString()).mul(
          row.reversalOfId ? -1 : 1,
        ),
      ),
    new Prisma.Decimal(0),
  );
}
export function netReceiptAmount(payment: {
  amount: { toString(): string };
  refunds?: readonly { amount: { toString(): string } }[];
  allocations?: readonly ReceiptAllocationMoney[];
}) {
  return new Prisma.Decimal(payment.amount.toString())
    .sub(
      (payment.refunds ?? []).reduce(
        (sum, r) => sum.add(r.amount.toString()),
        new Prisma.Decimal(0),
      ),
    )
    .sub(netReceiptAllocations(payment.allocations));
}
export function incomingAllocationPayments(
  rows: readonly ReceiptAllocationMoney[] = [],
) {
  const grouped = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (!row.currencyCode) continue;
    grouped.set(
      row.currencyCode,
      (grouped.get(row.currencyCode) ?? new Prisma.Decimal(0)).add(
        new Prisma.Decimal(row.amount.toString()).mul(
          row.reversalOfId ? -1 : 1,
        ),
      ),
    );
  }
  return [...grouped]
    .filter(([, amount]) => amount.gt(0))
    .map(([currencyCode, amount]) => ({
      currencyCode,
      amount: amount.toString(),
      status: 'FINANCE_CONFIRMED' as const,
    }));
}
export function hasConfirmedReceiptFunds(
  payments: Parameters<typeof netReceiptAmount>[0][],
  incoming: readonly ReceiptAllocationMoney[] = [],
) {
  return (
    payments.some((payment) => netReceiptAmount(payment).gt(0)) ||
    incomingAllocationPayments(incoming).length > 0
  );
}
export function netSalesPayments(
  payments: readonly {
    amount: { toString(): string };
    currencyCode: string;
    status: SalesPaymentStatus;
    refunds?: readonly { amount: { toString(): string } }[];
    allocations?: readonly ReceiptAllocationMoney[];
  }[],
  incoming: readonly ReceiptAllocationMoney[] = [],
) {
  return [
    ...payments.map((payment) => ({
      currencyCode: payment.currencyCode,
      status: payment.status,
      amount: netReceiptAmount(payment).toString(),
    })),
    ...incomingAllocationPayments(incoming),
  ];
}

/** Sales owns its balance and status. Finance receives only the release facts. */
export async function recalculateSalesSettlement(
  tx: Prisma.TransactionClient,
  contractId: string,
  actorId: string,
  incrementVersion = true,
) {
  const [components, payments, incoming] = await Promise.all([
    tx.salesContractPriceComponent.findMany({ where: { contractId } }),
    tx.salesContractPaymentEntry.findMany({
      where: { contractId },
      include: { refunds: true, allocations: true },
    }),
    tx.salesReceiptAllocation.findMany({
      where: { targetContractId: contractId },
    }),
  ]);
  const balances = calculateSalesBalances(
    components.map((c) => ({
      type: c.type,
      title: c.title,
      amount: c.amount.toString(),
      currencyCode: c.currencyCode,
    })),
    netSalesPayments(payments, incoming),
  );
  const paid = balances.some((b) => new Prisma.Decimal(b.confirmedPaid).gt(0));
  const outstanding = balances.some((b) =>
    new Prisma.Decimal(b.outstanding).gt(0),
  );
  const overpaid = balances.some((b) =>
    new Prisma.Decimal(b.outstanding).lt(0),
  );
  const contract = await tx.salesContract.update({
    where: { id: contractId },
    data: {
      settlementStatus: outstanding
        ? paid
          ? 'PARTIALLY_SETTLED'
          : 'UNPAID'
        : overpaid
          ? 'OVERPAID'
          : 'SETTLED',
      ...(incrementVersion ? { version: { increment: 1 } } : {}),
    },
    select: { id: true, branchId: true, ownerUserId: true, status: true },
  });
  const facts = {
    contractId,
    branchId: contract.branchId,
    salesOwnerUserId: contract.ownerUserId,
    cancelled: contract.status === 'CANCELLED',
    hasConfirmedPayment: paid && contract.status !== 'CANCELLED',
    fullySettled: !outstanding && contract.status !== 'CANCELLED',
  };
  await revokeObsoleteCustomerRelease(tx, facts, actorId);
  return facts;
}
