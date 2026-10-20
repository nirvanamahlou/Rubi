import { Prisma, type SalesPaymentStatus } from '@nora/database';
import { calculateSalesBalances } from './sales.domain';
import { revokeObsoleteCustomerRelease } from '../finance/document-delivery/financial-release.public';

export function netSalesPayments(
  payments: readonly {
    amount: { toString(): string };
    currencyCode: string;
    status: SalesPaymentStatus;
    refunds?: readonly { amount: { toString(): string } }[];
  }[],
) {
  return payments.map((p) => ({
    currencyCode: p.currencyCode,
    status: p.status,
    amount: new Prisma.Decimal(p.amount.toString())
      .sub(
        (p.refunds ?? []).reduce(
          (sum, r) => sum.add(r.amount.toString()),
          new Prisma.Decimal(0),
        ),
      )
      .toString(),
  }));
}

/** Sales owns its balance and status. Finance receives only the release facts. */
export async function recalculateSalesSettlement(
  tx: Prisma.TransactionClient,
  contractId: string,
  actorId: string,
  incrementVersion = true,
) {
  const [components, payments] = await Promise.all([
    tx.salesContractPriceComponent.findMany({ where: { contractId } }),
    tx.salesContractPaymentEntry.findMany({
      where: { contractId },
      include: { refunds: true },
    }),
  ]);
  const balances = calculateSalesBalances(
    components.map((c) => ({
      type: c.type,
      title: c.title,
      amount: c.amount.toString(),
      currencyCode: c.currencyCode,
    })),
    netSalesPayments(payments),
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
