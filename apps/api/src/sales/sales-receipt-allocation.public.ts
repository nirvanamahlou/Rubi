import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import { calculateSalesBalances } from './sales.domain';
import {
  netReceiptAmount,
  netSalesPayments,
  recalculateSalesSettlement,
} from './sales-financial-settlement';

const allocationMoney = {
  amount: true,
  currencyCode: true,
  reversalOfId: true,
} as const;
const paymentMoney = {
  amount: true,
  currencyCode: true,
  status: true,
  refunds: { select: { amount: true } },
  allocations: { select: allocationMoney },
} as const;
const receiptSelect = {
  ...paymentMoney,
  id: true,
  contractId: true,
  contract: {
    select: {
      id: true,
      branchId: true,
      customerId: true,
      version: true,
      status: true,
      contractNumber: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SalesContractPaymentEntrySelect;
const targetSelect = {
  id: true,
  branchId: true,
  customerId: true,
  version: true,
  status: true,
  contractNumber: true,
  createdAt: true,
  priceComponents: true,
  payments: { select: paymentMoney },
  receiptAllocations: { select: allocationMoney },
} satisfies Prisma.SalesContractSelect;
export async function receiptAllocationSource(
  tx: Prisma.TransactionClient,
  paymentId: string,
  branchIds: readonly string[],
) {
  const payment = await tx.salesContractPaymentEntry.findFirst({
    where: {
      id: paymentId,
      status: 'FINANCE_CONFIRMED',
      contract: { branchId: { in: [...branchIds] } },
    },
    select: receiptSelect,
  });
  if (!payment)
    throw new NotFoundException('دریافت تأییدشده در شعبه مجاز یافت نشد.');
  return payment;
}
export async function receiptAllocationReplay(
  tx: Prisma.TransactionClient,
  operationId: string,
  branchIds: readonly string[],
  actorId: string,
  fingerprint: string,
) {
  const row = await tx.salesReceiptAllocation.findUnique({
    where: { id: operationId },
  });
  if (!row) return null;
  if (!branchIds.includes(row.branchId)) throw new NotFoundException();
  if (row.actorId !== actorId || row.fingerprint !== fingerprint)
    throw new ConflictException(
      'شناسه تخصیص قبلاً با اطلاعات دیگری استفاده شده است.',
    );
  return row;
}
export async function receiptAllocationTargets(
  tx: Prisma.TransactionClient,
  paymentId: string,
  branchIds: readonly string[],
  search: string,
) {
  const source = await receiptAllocationSource(tx, paymentId, branchIds);
  const rows = await tx.salesContract.findMany({
    where: {
      id: { not: source.contractId },
      branchId: source.contract.branchId,
      customerId: source.contract.customerId,
      status: { not: 'CANCELLED' },
      ...(search
        ? { contractNumber: { contains: search, mode: 'insensitive' as const } }
        : {}),
    },
    select: targetSelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: 30,
  });
  return rows
    .map((row) => {
      const balance = calculateSalesBalances(
        row.priceComponents.map((c) => ({ ...c, amount: c.amount.toString() })),
        netSalesPayments(row.payments, row.receiptAllocations),
      ).find((b) => b.currencyCode === source.currencyCode);
      return {
        id: row.id,
        contractNumber: row.contractNumber,
        version: row.version,
        outstanding: balance?.outstanding ?? '0',
      };
    })
    .filter((row) => new Prisma.Decimal(row.outstanding).gt(0));
}
export async function receiptAllocationRows(
  tx: Prisma.TransactionClient,
  paymentId: string,
  branchIds: readonly string[],
  before?: string,
) {
  await receiptAllocationSource(tx, paymentId, branchIds);
  const cursor = before
    ? await tx.salesReceiptAllocation.findFirst({
        where: {
          id: before,
          sourcePaymentId: paymentId,
          branchId: { in: [...branchIds] },
          reversalOfId: null,
        },
      })
    : null;
  if (before && !cursor) throw new NotFoundException('نشانگر تخصیص یافت نشد.');
  const rows = await tx.salesReceiptAllocation.findMany({
    where: {
      sourcePaymentId: paymentId,
      reversalOfId: null,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    include: {
      targetContract: { select: { contractNumber: true, version: true } },
      reversal: { select: { id: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 51,
  });
  return {
    rows: rows.slice(0, 50),
    nextCursor: rows.length > 50 ? rows[49]!.id : null,
  };
}
export interface ReceiptAllocationPreparation {
  paymentId: string;
  targetContractId?: string | undefined;
  reversalOfId?: string | undefined;
  amount?: string | undefined;
  expectedSourceVersion: number;
  expectedTargetVersion: number;
}
/** Caller holds Finance receipt/book locks. Sales owns scoped records, contract locks and balance decisions. */
export async function prepareReceiptAllocation(
  tx: Prisma.TransactionClient,
  input: ReceiptAllocationPreparation,
  branchIds: readonly string[],
  basisPartyId: string | null,
  reservedRefunds: Prisma.Decimal,
) {
  const initial = await receiptAllocationSource(tx, input.paymentId, branchIds);
  const original = input.reversalOfId
    ? await tx.salesReceiptAllocation.findFirst({
        where: {
          id: input.reversalOfId,
          sourcePaymentId: input.paymentId,
          branchId: initial.contract.branchId,
          reversalOfId: null,
        },
        include: { reversal: true },
      })
    : null;
  if (input.reversalOfId && (!original || original.reversal))
    throw new ConflictException(
      'تخصیص اصلی یافت نشد یا قبلاً برگشت خورده است.',
    );
  const targetId = original?.targetContractId ?? input.targetContractId;
  if (!targetId || targetId === initial.contractId)
    throw new BadRequestException('قرارداد مقصد متفاوت انتخاب کنید.');
  const ids = [initial.contractId, targetId].sort();
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM sales_contracts WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  const source = await receiptAllocationSource(tx, input.paymentId, branchIds);
  const target = await tx.salesContract.findFirst({
    where: { id: targetId, branchId: source.contract.branchId },
    select: targetSelect,
  });
  if (!target)
    throw new NotFoundException('قرارداد مقصد در شعبه دریافت یافت نشد.');
  if (
    source.contract.version !== input.expectedSourceVersion ||
    target.version !== input.expectedTargetVersion
  )
    throw new ConflictException(
      'نسخه قرارداد یا مانده تغییر کرده است؛ اطلاعات را تازه کنید.',
    );
  if (
    !original &&
    (target.status === 'CANCELLED' ||
      source.contract.customerId !== target.customerId ||
      source.contract.customerId !== basisPartyId)
  )
    throw new ConflictException(
      'تخصیص فقط بین قراردادهای همان مشتری و شعبه ممکن است.',
    );
  const amount = original?.amount ?? new Prisma.Decimal(input.amount!);
  if (!amount.isFinite() || !amount.isPositive() || amount.decimalPlaces() > 4)
    throw new BadRequestException(
      'مبلغ مثبت با حداکثر چهار رقم اعشار لازم است.',
    );
  if (!original) {
    if (amount.gt(netReceiptAmount(source).sub(reservedRefunds)))
      throw new ConflictException(
        'وجه قابل تخصیص پس از استردادها و رزرو استرداد کافی نیست.',
      );
    const balance = calculateSalesBalances(
      target.priceComponents.map((c) => ({
        ...c,
        amount: c.amount.toString(),
      })),
      netSalesPayments(target.payments, target.receiptAllocations),
    ).find((b) => b.currencyCode === source.currencyCode);
    if (!balance || amount.gt(balance.outstanding))
      throw new ConflictException(
        'مبلغ تخصیص از مانده هم‌ارز قرارداد مقصد بیشتر است.',
      );
  }
  return { source, target, amount, reversalOfId: original?.id ?? null };
}
export async function persistReceiptAllocation(
  tx: Prisma.TransactionClient,
  prepared: Awaited<ReturnType<typeof prepareReceiptAllocation>>,
  id: string,
  actorId: string,
  fingerprint: string,
  reason: string,
) {
  const row = await tx.salesReceiptAllocation.create({
    data: {
      id,
      sourcePaymentId: prepared.source.id,
      targetContractId: prepared.target.id,
      branchId: prepared.source.contract.branchId,
      amount: prepared.amount,
      currencyCode: prepared.source.currencyCode,
      reversalOfId: prepared.reversalOfId,
      actorId,
      fingerprint,
      reason,
    },
  });
  for (const contractId of [
    prepared.source.contractId,
    prepared.target.id,
  ].sort())
    await recalculateSalesSettlement(tx, contractId, actorId);
  return row;
}

/** Scoped source returned above is the only input; no cross-module table reads are required. */
export const unallocatedReceiptAmount = netReceiptAmount;

export async function assertNoActiveReceiptAllocations(
  tx: Prisma.TransactionClient,
  contractId: string,
) {
  const active = await tx.salesReceiptAllocation.count({
    where: {
      reversalOfId: null,
      reversal: null,
      OR: [{ targetContractId: contractId }, { sourcePayment: { contractId } }],
    },
  });
  if (active)
    throw new ConflictException(
      'ابتدا تخصیص‌های فعال دریافت قرارداد را برگشت دهید و سپس طرف حساب را تغییر دهید.',
    );
}
