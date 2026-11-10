import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { recalculateSalesSettlement } from './sales-financial-settlement';

// Used by accounting queries whose event source alias is e.
export const voidedSalesReceiptEvent = Prisma.sql`e.source = 'SALES' AND e.kind = 'CUSTOMER_RECEIPT' AND EXISTS (
  SELECT 1 FROM sales_contract_payment_entries p
  WHERE p.id = e."recordId" AND p.status = 'FINANCE_VOIDED'
)`;

export async function voidedSalesReceiptIds(
  tx: Prisma.TransactionClient,
  branchId: string,
) {
  const rows = await tx.salesContractPaymentEntry.findMany({
    where: { status: 'FINANCE_VOIDED', contract: { branchId } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export function isSalesReceiptVoided(tx: Prisma.TransactionClient, id: string) {
  return tx.salesContractPaymentEntry.count({
    where: { id, status: 'FINANCE_VOIDED' },
  });
}

export async function readSalesReceiptForVoid(
  tx: Prisma.TransactionClient,
  contractId: string,
  paymentId: string,
  branchIds: string[],
  companyScope: Prisma.SalesContractWhereInput,
) {
  const payment = await tx.salesContractPaymentEntry.findFirst({
    where: {
      id: paymentId,
      contractId,
      contract: { AND: [{ branchId: { in: branchIds } }, companyScope] },
    },
    include: {
      contract: {
        select: { branchId: true, version: true, contractNumber: true },
      },
      allocations: { select: { amount: true, reversalOfId: true } },
      _count: {
        select: {
          refunds: true,
          financeRefundRequests: {
            where: { status: { notIn: ['REJECTED', 'CANCELLED'] } },
          },
        },
      },
    },
  });
  if (!payment)
    throw new NotFoundException('درخواست دریافت در شعب مجاز یافت نشد.');
  return payment;
}

export async function applySalesReceiptVoid(
  tx: Prisma.TransactionClient,
  payment: Awaited<ReturnType<typeof readSalesReceiptForVoid>>,
  actorId: string,
  reason: string,
) {
  const changed = await tx.salesContractPaymentEntry.updateMany({
    where: { id: payment.id, status: 'FINANCE_CONFIRMED' },
    data: { status: 'FINANCE_VOIDED' },
  });
  if (changed.count !== 1)
    throw new ConflictException('وضعیت پرداخت هم‌زمان تغییر کرده است.');
  await recalculateSalesSettlement(tx, payment.contractId, actorId);
  await tx.salesContractAuditEvent.create({
    data: {
      contractId: payment.contractId,
      actorUserId: actorId,
      actorBranchId: payment.contract.branchId,
      action: 'sales.payment.finance_voided',
      outcome: 'SUCCESS',
      reason,
      beforeSnapshot: {
        paymentId: payment.id,
        status: payment.status,
        reference: payment.financePaymentReference,
      },
      afterSnapshot: { paymentId: payment.id, status: 'FINANCE_VOIDED' },
    },
  });
}
