import { isReceiptAllocation } from './receipt-funds.public';
import { financialDate } from './accounting.financial-events';
export { financialDate };
import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';

/** Owner modules call this public sink inside their own business transaction.
 * A failed event insert must roll back the source confirmation as well. */
export interface FinancialEventV1 {
  basisEventId?: string;
  carryingAmount?: string;
  carryingCurrency?: string;
  source: 'SALES' | 'TICKET' | 'RESERVATIONS' | 'INVOICE' | 'OPERATIONAL';
  recordId: string;
  requestId: string;
  kind: string;
  branchId: string;
  actorId: string;
  occurredAt: Date;
  amount: string;
  currency: string;
  trackingNumber?: string | null;
  trackingDate?: string | null;
  settlementAccountId?: string | null;
  partyId?: string | null;
  reference?: string | null;
}

/** The applied migration is the explicit cutover. Historical obligations need reconciliation. */
export async function isNewAccountingSource(
  tx: Prisma.TransactionClient,
  createdAt: Date | undefined,
) {
  if (!createdAt) return false;
  const [activation] = await tx.$queryRaw<{ at: Date }[]>`
    SELECT finished_at AS at FROM _prisma_migrations
    WHERE migration_name='20261018120000_financial_accounting_events' AND rolled_back_at IS NULL
    ORDER BY finished_at DESC LIMIT 1`;
  if (!activation?.at)
    throw new ConflictException('زمان شروع اتصال حسابداری ثبت نشده است.');
  return createdAt >= activation.at;
}

export async function recordFinancialEvent(
  tx: Prisma.TransactionClient,
  input: FinancialEventV1,
): Promise<string> {
  if (
    !Number.isFinite(input.occurredAt.getTime()) ||
    ((input.kind === 'CUSTOMER_RECEIPT' || input.kind.endsWith('_PAYMENT')) &&
      input.occurredAt.getTime() > Date.now() + 300_000)
  )
    throw new ConflictException(
      'زمان رویداد مالی معتبر نیست؛ دریافت یا پرداخت آینده تأیید نمی‌شود.',
    );
  const allocation = isReceiptAllocation(input.kind);
  if (allocation) {
    if (
      input.source !== 'SALES' ||
      !input.basisEventId ||
      !input.carryingAmount ||
      !input.carryingCurrency ||
      input.settlementAccountId
    )
      throw new ConflictException('مبنای ثبت تخصیص دریافت معتبر نیست.');
    const carrying = new Prisma.Decimal(input.carryingAmount);
    if (
      !carrying.isFinite() ||
      !carrying.isPositive() ||
      carrying.decimalPlaces() > 4 ||
      !/^[A-Z]{3}$/.test(input.carryingCurrency)
    )
      throw new ConflictException('مبلغ دفتری تخصیص معتبر نیست.');
  } else if (
    input.basisEventId ||
    input.carryingAmount ||
    input.carryingCurrency
  )
    throw new ConflictException(
      'اطلاعات تخصیص فقط برای رویداد تخصیص دریافت مجاز است.',
    );
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isFinite() || !amount.isPositive() || amount.decimalPlaces() > 4)
    throw new ConflictException('مبلغ رویداد مالی معتبر نیست.');
  if (
    input.settlementAccountId &&
    !(await tx.financeSettlementAccount.findFirst({
      where: {
        id: input.settlementAccountId,
        branchId: input.branchId,
        currencyCode: input.currency,
        isActive: true,
      },
      select: { id: true },
    }))
  )
    throw new ConflictException(
      'حساب واقعی فعال با شعبه و ارز رویداد لازم است.',
    );
  // Coordinate source capture with period closure without taking a journal-writing lock.
  await tx.$queryRaw`SELECT id FROM accounting_books WHERE "branchId"=${input.branchId}::uuid AND active=true AND "allowsPosting"=true ORDER BY id FOR SHARE`;
  const cash =
    input.kind === 'CUSTOMER_RECEIPT' || input.kind.endsWith('_PAYMENT');
  const sourceKey = cash
    ? `${input.source}:${input.recordId}`
    : `${input.source}:${input.kind}:${input.recordId}`;
  const body = {
    ...input,
    amount: amount.toFixed(4),
    ...(allocation
      ? { carryingAmount: new Prisma.Decimal(input.carryingAmount!).toFixed(4) }
      : {}),
    occurredAt: input.occurredAt.toISOString(),
    trackingNumber: input.trackingNumber ?? input.requestId,
    trackingDate: input.trackingDate ?? financialDate(input.occurredAt),
    settlementAccountId: input.settlementAccountId ?? null,
    partyId: input.partyId ?? null,
    reference: input.reference ?? null,
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(Object.entries(body).sort())))
    .digest('hex');
  await tx.financeAccountingEvent.createMany({
    data: [{ ...body, sourceKey, fingerprint }],
    skipDuplicates: true,
  });
  const saved = await tx.financeAccountingEvent.findUniqueOrThrow({
    where: { sourceKey },
  });
  if (saved.fingerprint !== fingerprint)
    throw new ConflictException(
      'رویداد مالی قبلاً با اطلاعات دیگری ثبت شده است.',
    );
  return saved.id;
}
