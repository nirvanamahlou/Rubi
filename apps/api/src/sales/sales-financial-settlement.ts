import { Prisma, type SalesPaymentStatus } from '@nora/database';
import { calculateSalesBalances } from './sales.domain';
import { revokeObsoleteCustomerRelease } from '../finance/document-delivery/financial-release.public';

export type ReceiptAllocationMoney = {
  amount: { toString(): string };
  reversalOfId: string | null;
  currencyCode?: string;
};
// Persisted receipt/refund/allocation columns have four decimal places. Integer
// summation preserves small units regardless of historical reversal row order.
function moneyUnits(amount: { toString(): string }) {
  return BigInt(
    new Prisma.Decimal(amount.toString()).toFixed(4).replace('.', ''),
  );
}
function unitsAmount(units: bigint) {
  const magnitude = units < 0n ? -units : units;
  return new Prisma.Decimal(
    `${units < 0n ? '-' : ''}${magnitude / 10000n}.${(magnitude % 10000n).toString().padStart(4, '0')}`,
  );
}
function allocationUnits(rows: readonly ReceiptAllocationMoney[] = []) {
  return rows.reduce(
    (sum, row) => sum + moneyUnits(row.amount) * (row.reversalOfId ? -1n : 1n),
    0n,
  );
}
export function netReceiptAllocations(
  rows: readonly ReceiptAllocationMoney[] = [],
) {
  return unitsAmount(allocationUnits(rows));
}
export function netReceiptAmount(payment: {
  amount: { toString(): string };
  refunds?: readonly { amount: { toString(): string } }[];
  allocations?: readonly ReceiptAllocationMoney[];
}) {
  return unitsAmount(
    moneyUnits(payment.amount) -
      (payment.refunds ?? []).reduce(
        (sum, refund) => sum + moneyUnits(refund.amount),
        0n,
      ) -
      allocationUnits(payment.allocations),
  );
}
export function incomingAllocationPayments(
  rows: readonly ReceiptAllocationMoney[] = [],
) {
  const grouped = new Map<string, bigint>();
  for (const row of rows) {
    if (!row.currencyCode) continue;
    grouped.set(
      row.currencyCode,
      (grouped.get(row.currencyCode) ?? 0n) +
        moneyUnits(row.amount) * (row.reversalOfId ? -1n : 1n),
    );
  }
  return [...grouped]
    .filter(([, amount]) => amount > 0n)
    .map(([currencyCode, amount]) => ({
      currencyCode,
      amount: unitsAmount(amount).toString(),
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
