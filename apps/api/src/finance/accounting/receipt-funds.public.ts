import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';

export const RECEIPT_ALLOCATION_KINDS = [
  'RECEIPT_ALLOCATION',
  'RECEIPT_ALLOCATION_REVERSAL',
] as const;
export const isReceiptAllocation = (kind: string) =>
  RECEIPT_ALLOCATION_KINDS.some((value) => value === kind);

/** Same Finance-owned receipt lock for allocation, refund reservations and payments. */
export async function lockReceiptFunds(
  tx: Prisma.TransactionClient,
  paymentId: string,
) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`finance-create:${paymentId}`}, 0))::text`;
}

/** Outstanding requests reserve money; actual refunds are supplied by the Sales owner. */
export async function reservedReceiptRefunds(
  tx: Prisma.TransactionClient,
  paymentId: string,
) {
  const requests = await tx.financeOperationalRequest.findMany({
    where: {
      refundReceiptId: paymentId,
      status: { notIn: ['REJECTED', 'CANCELLED'] },
    },
    include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  return requests.reduce(
    (sum, request) =>
      sum.add(
        Prisma.Decimal.max(
          0,
          request.amount.sub(request.revisions[0]?.cumulativePaid ?? 0),
        ),
      ),
    new Prisma.Decimal(0),
  );
}

/** Shared book locks precede Sales row locks and coordinate source transfers with journal reversals. */
export async function postedReceiptBasis(
  tx: Prisma.TransactionClient,
  paymentId: string,
  branchId: string,
  lockBooks = true,
) {
  if (lockBooks)
    await tx.$queryRaw`SELECT id FROM accounting_books WHERE "branchId"=${branchId}::uuid AND active=true AND "allowsPosting"=true ORDER BY id FOR SHARE`;
  const basis = await tx.financeAccountingEvent.findFirst({
    where: {
      sourceKey: `SALES:${paymentId}`,
      branchId,
      source: 'SALES',
      kind: 'CUSTOMER_RECEIPT',
    },
    include: {
      journal: {
        include: { book: true, lines: { orderBy: { position: 'asc' } } },
      },
    },
  });
  if (
    !basis?.journal ||
    basis.journal.status !== 'POSTED' ||
    !basis.journal.book.active ||
    !basis.journal.book.allowsPosting
  )
    throw new ConflictException(
      'ابتدا سند دریافت اصلی را در دفتر فعال ثبت نهایی کنید.',
    );
  const reversal = await tx.accountingJournal.findFirst({
    where: { reversalOfId: basis.journal.id, status: 'POSTED' },
    select: { id: true },
  });
  if (reversal)
    throw new ConflictException(
      'سند دریافت اصلی برگشت خورده است؛ ابتدا تطبیق انجام شود.',
    );
  const credits = basis.journal.lines.filter((line) => line.credit.gt(0));
  if (
    credits.length !== 1 ||
    basis.journal.lines.length !== 2 ||
    basis.amount.lte(0)
  )
    throw new ConflictException(
      'ساختار سند دریافت برای تخصیص خودکار معتبر نیست.',
    );
  return { event: basis, journal: basis.journal, credit: credits[0]! };
}
export type PostedReceiptBasis = Awaited<ReturnType<typeof postedReceiptBasis>>;

/** Preserve original base carrying amount; last distribution absorbs only its own rounding remainder. */
export async function allocationCarryingAmount(
  tx: Prisma.TransactionClient,
  basis: PostedReceiptBasis,
  amount: Prisma.Decimal,
  reversalOfId?: string,
) {
  if (reversalOfId) {
    const original = await tx.financeAccountingEvent.findFirst({
      where: {
        sourceKey: `SALES:RECEIPT_ALLOCATION:${reversalOfId}`,
        basisEventId: basis.event.id,
        kind: 'RECEIPT_ALLOCATION',
      },
    });
    if (
      !original?.carryingAmount ||
      original.carryingCurrency !== basis.journal.book.baseCurrency
    )
      throw new ConflictException('مبنای دفتری تخصیص اصلی یافت نشد.');
    return original.carryingAmount;
  }
  const Exact = Prisma.Decimal.clone({ precision: 60 });
  const events = await tx.financeAccountingEvent.findMany({
    where: {
      basisEventId: basis.event.id,
      kind: { in: [...RECEIPT_ALLOCATION_KINDS] },
    },
  });
  const net = events.reduce(
    (sum, event) => ({
      foreign: sum.foreign.add(
        new Exact(event.amount.toString()).mul(
          event.kind === 'RECEIPT_ALLOCATION' ? 1 : -1,
        ),
      ),
      base: sum.base.add(
        new Exact(event.carryingAmount?.toString() ?? '0').mul(
          event.kind === 'RECEIPT_ALLOCATION' ? 1 : -1,
        ),
      ),
    }),
    { foreign: new Exact(0), base: new Exact(0) },
  );
  const remainingForeign = new Exact(basis.event.amount.toString()).sub(
      net.foreign,
    ),
    remainingBase = new Exact(basis.credit.credit.toString()).sub(net.base);
  if (amount.gt(remainingForeign))
    throw new ConflictException('مبلغ تخصیص از مانده دریافت بیشتر است.');
  const value = amount.eq(remainingForeign)
    ? remainingBase
    : basis.event.currency === basis.journal.book.baseCurrency
      ? amount
      : new Exact(amount.toString())
          .mul(basis.credit.credit.toString())
          .div(basis.event.amount.toString())
          .toDecimalPlaces(
            basis.journal.book.baseCurrency === 'IRR' ? 0 : 2,
            basis.journal.book.baseCurrency === 'IRR'
              ? Prisma.Decimal.ROUND_HALF_UP
              : Prisma.Decimal.ROUND_HALF_EVEN,
          );
  if (!value.isPositive() || value.gt(remainingBase))
    throw new ConflictException(
      'مبلغ دفتری تخصیص معتبر نیست؛ مبلغ یا تطبیق دریافت را بررسی کنید.',
    );
  return new Prisma.Decimal(value.toString());
}
