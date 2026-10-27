import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DatabaseClient, Prisma } from '@nora/database';
import type {
  SalesReportingActor,
  SalesReportingQuery,
} from './sales-reporting.public';

/** Confirmed receipt and completed refund events, each counted exactly once. */
export async function readSalesPaymentReportingProjection(
  client: DatabaseClient,
  actor: SalesReportingActor,
  query: SalesReportingQuery,
) {
  const all = actor.permissions.includes('sales.contracts.read.all');
  const branch = actor.permissions.includes('sales.contracts.read.branch');
  const own = actor.permissions.includes('sales.contracts.read.own');
  if (
    !actor.permissions.includes('sales.payments.read') ||
    (!all && ((!branch && !own) || !actor.branchIds.length))
  )
    throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
  const allowed = new Set([
    'fromUtc',
    'toUtc',
    'branchId',
    'branch',
    'currencyCode',
  ]);
  if (
    query.legalEntityId ||
    Object.entries(query.filters).some(
      ([key, value]) => Boolean(value) && !allowed.has(key),
    )
  )
    throw new BadRequestException(
      'فیلتر انتخاب‌شده در منبع این گزارش پشتیبانی نمی‌شود.',
    );
  const scalar = (key: string) => {
    const value = query.filters[key];
    if (value !== undefined && typeof value !== 'string')
      throw new BadRequestException('فیلتر نامعتبر است.');
    return typeof value === 'string' && value ? value : undefined;
  };
  if (
    scalar('branchId') &&
    scalar('branch') &&
    scalar('branchId') !== scalar('branch')
  )
    throw new BadRequestException('فیلتر نامعتبر است.');
  const branchId = scalar('branchId') ?? scalar('branch');
  const contract: Prisma.SalesContractWhereInput = {
    AND: [
      ...(!all
        ? [
            {
              branchId: { in: [...actor.branchIds] },
              ...(!branch ? { ownerUserId: actor.userId } : {}),
            },
          ]
        : []),
      ...(branchId ? [{ branchId }] : []),
    ],
  };
  const range = {
    ...(scalar('fromUtc') ? { gte: new Date(scalar('fromUtc')!) } : {}),
    ...(scalar('toUtc') ? { lt: new Date(scalar('toUtc')!) } : {}),
  };
  const paymentScope = {
    contract,
    ...(scalar('currencyCode')
      ? { currencyCode: scalar('currencyCode')! }
      : {}),
  };
  const [receipts, refunds] = await Promise.all([
    client.salesContractPaymentEntry.findMany({
      where: {
        ...paymentScope,
        status: 'FINANCE_CONFIRMED',
        financeConfirmedAt: { not: null, ...range },
      },
      select: {
        id: true,
        currencyCode: true,
        amount: true,
        method: true,
        financeConfirmedAt: true,
        updatedAt: true,
      },
      orderBy: [{ financeConfirmedAt: 'asc' }, { id: 'asc' }],
      take: 10001,
    }),
    client.salesPaymentRefund.findMany({
      where: { payment: paymentScope, createdAt: range },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        payment: { select: { currencyCode: true, method: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 10001,
    }),
  ]);
  if (receipts.length > 10000 || refunds.length > 10000)
    throw new BadRequestException(
      'بازه را کوچک‌تر کنید؛ گزارش بیش از ۱۰۰۰۰ تراکنش دارد.',
    );
  return [
    ...receipts.map((row) => ({
      id: row.id,
      kind: 'دریافت قطعی',
      currencyCode: row.currencyCode,
      method: row.method,
      received: row.amount.toString(),
      refunded: '0',
      at: row.financeConfirmedAt!,
      updatedAt: row.updatedAt,
    })),
    ...refunds.map((row) => ({
      id: row.id,
      kind: 'استرداد قطعی',
      currencyCode: row.payment.currencyCode,
      method: row.payment.method,
      received: '0',
      refunded: row.amount.toString(),
      at: row.createdAt,
      updatedAt: row.createdAt,
    })),
  ];
}
