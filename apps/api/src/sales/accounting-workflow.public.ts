import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { calculateSalesBalances } from './sales.domain';
import { netSalesPayments } from './sales-financial-settlement';

/** Finance receives the approved commercial totals, never passenger/private data. */
export async function revenueSource(
  tx: Prisma.TransactionClient,
  id: string,
  branchId: string,
) {
  const row = await tx.salesContract.findFirst({
    where: { id, branchId },
    select: {
      id: true,
      version: true,
      status: true,
      contractNumber: true,
      customerId: true,
      createdAt: true,
      priceComponents: {
        orderBy: { id: 'asc' },
        select: { type: true, title: true, amount: true, currencyCode: true },
      },
      payments: { include: { refunds: true, allocations: true } },
      receiptAllocations: true,
    },
  });
  if (!row) throw new NotFoundException('قرارداد این شعبه یافت نشد.');
  if (['DRAFT', 'CANCELLED'].includes(row.status))
    throw new ConflictException(
      'درآمد قرارداد پیش‌نویس یا ابطال‌شده شناسایی نمی‌شود.',
    );
  const components = row.priceComponents.map((p) => ({
    ...p,
    amount: p.amount.toString(),
  }));
  return {
    id: row.id,
    version: row.version,
    number: row.contractNumber,
    partyId: row.customerId,
    createdAt: row.createdAt.toISOString(),
    components,
    balances: calculateSalesBalances(
      components,
      netSalesPayments(row.payments, row.receiptAllocations),
    ),
  };
}
export async function revenueSources(
  tx: Prisma.TransactionClient,
  branchId: string,
  search: string,
) {
  return tx.salesContract.findMany({
    where: {
      branchId,
      status: { notIn: ['DRAFT', 'CANCELLED'] },
      ...(search
        ? { contractNumber: { contains: search, mode: 'insensitive' as const } }
        : {}),
    },
    select: { id: true, version: true, contractNumber: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 101,
  });
}

/** Accounting consumes current commercial facts through this Sales-owned transaction projection. */
export async function salesContractAccountingSource(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const row = await tx.salesContract.findUnique({
    where: { id },
    select: {
      id: true,
      branchId: true,
      payerCustomerId: true,
      contractNumber: true,
      status: true,
      version: true,
      payments: {
        where: {
          status: 'FINANCE_CONFIRMED',
          financeConfirmedAt: { not: null },
          financeConfirmedByRef: { not: null },
          financeReceiptAccountId: { not: null },
        },
        select: { id: true },
        take: 1,
      },
      priceComponents: {
        select: { type: true, title: true, amount: true, currencyCode: true },
      },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    branchId: row.branchId,
    payerCustomerId: row.payerCustomerId,
    contractNumber: row.contractNumber,
    hasFinanceApproval: row.payments.length > 0,
    status: row.status,
    version: row.version,
    balances: calculateSalesBalances(
      row.priceComponents.map((c) => ({ ...c, amount: c.amount.toString() })),
      [],
    ),
  };
}
