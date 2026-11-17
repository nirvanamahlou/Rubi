import { assertFinancialProofVersion } from '../../documents/financial-proof.public';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  assertFinanceFiscalWrite,
  FinanceFiscalStorage,
} from '../fiscal-context/finance-fiscal-storage';
import { debitExchange } from '../exchange-offices/exchange-payment';
import * as v from '../accounting/accounting.validation';
import { validatePayee } from './bank-payee';
import { readBankObligation } from './obligation-read';
type Tx = Prisma.TransactionClient;
export type Source =
  { purchaseId: string } | { costId: string } | { invoiceId: string };
export function sourceKey(kind: unknown, id: unknown): Source {
  const value = v.uuid(id)!;
  if (kind === 'RESERVATIONS') return { purchaseId: value };
  if (kind === 'TICKET') return { costId: value };
  if (kind === 'INVOICE') return { invoiceId: value };
  return v.invalid('نوع خرید معتبر نیست.');
}
async function lock(tx: Tx, source: Source) {
  const key = 'bank-obligation:' + Object.values(source)[0];
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key},0))`;
}
export async function assertPurchaseReturnable(tx: Tx, purchaseId: string) {
  await lock(tx, { purchaseId });
  if (
    await tx.financeBrokerTransfer.count({
      where: { purchaseId, receiptId: null },
    })
  )
    v.rule('خرید دارای حواله در انتظار رسید قابل برگشت نیست.');
}
export async function bankScope(tx: Tx, actor: AuthenticatedActor) {
  const period = new FinanceFiscalStorage().require();
  if (!period) throw new BadRequestException('شرکت و سال مالی را انتخاب کنید.');
  const book = await tx.accountingBook.findFirst({
    where: {
      id: period.bookId,
      branchId: { in: [...actor.branchIds] },
      active: true,
    },
  });
  if (!book) throw new NotFoundException();
  return { period, book };
}
export async function fundBroker(
  tx: Tx,
  actor: AuthenticatedActor,
  p: Record<string, unknown>,
) {
  const { book, period } = await bankScope(tx, actor);
  const source = sourceKey(p.kind, p.sourceId),
    id = v.uuid(p.id)!,
    brokerId = v.uuid(p.brokerId)!,
    officeId = v.uuid(p.officeId)!;
  const amount = new Prisma.Decimal(v.decimalAtScale(p.amount, 4)),
    rate = new Prisma.Decimal(v.decimalAtScale(p.rate, 8));
  const sentAt = new Date(v.text(p.sentAt, 40, true));
  if (
    !Number.isFinite(sentAt.getTime()) ||
    sentAt.getTime() > Date.now() + 300000 ||
    amount.lte(0) ||
    rate.lte(0)
  )
    v.invalid('زمان، مبلغ یا نرخ حواله معتبر نیست.');
  await assertFinanceFiscalWrite(tx, sentAt);
  // Share the source producer's version lock before committing funds.
  if ('costId' in source || 'purchaseId' in source) {
    const parent =
      'costId' in source
        ? (
            await tx.financeTicketPurchaseCostRevision.findUnique({
              where: { id: source.costId },
              select: { requestId: true },
            })
          )?.requestId
        : (
            await tx.reservationServicePurchase.findUnique({
              where: { id: source.purchaseId },
              select: { intakeId: true },
            })
          )?.intakeId;
    if (!parent) throw new NotFoundException();
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${parent},0))`;
  }
  await lock(tx, source);
  const prior = await tx.financeBrokerTransfer.findUnique({ where: { id } });
  if (prior) {
    if (
      prior.bookId !== book.id ||
      prior.periodId !== period.id ||
      prior.makerId !== actor.userId ||
      prior.brokerId !== brokerId ||
      prior.officeId !== officeId ||
      !prior.amount.eq(amount) ||
      !prior.rate.eq(rate) ||
      prior.sentAt.getTime() !== sentAt.getTime() ||
      Object.entries(source).some(
        ([k, val]) => prior[k as keyof Source] !== val,
      )
    )
      throw new ConflictException('شناسه حواله قبلاً استفاده شده است.');
    return { id };
  }
  const bill = await readBankObligation(tx, source, book.branchId);
  const broker = await tx.masterBroker.findFirst({
    where: { id: brokerId, isActive: true, collaborationStatus: 'ACTIVE' },
    select: { id: true, organizationId: true },
  });
  if (
    !broker ||
    (bill.brokerId && bill.brokerId !== brokerId) ||
    (bill.organizationId && bill.organizationId !== broker.organizationId)
  )
    v.rule('کارگزار با خرید انتخاب‌شده منطبق نیست.');
  if (
    await tx.financeBrokerTransfer.count({
      where: { ...source, brokerId: { not: brokerId } },
    })
  )
    v.rule('این خرید به کارگزار دیگری تعلق دارد.');
  const open = await tx.financeBrokerTransfer.aggregate({
    where: { ...source, receiptId: null },
    _sum: { amount: true },
  });
  if (bill.remaining.sub(open._sum.amount ?? 0).lt(amount))
    v.rule('مبلغ حواله از مانده آزاد خرید بیشتر است.');
  await tx.financeBrokerTransfer.create({
    data: {
      id,
      bookId: book.id,
      periodId: period.id,
      brokerId,
      officeId,
      ...source,
      currency: bill.currency,
      amount,
      rate,
      sentAt,
      makerId: actor.userId,
    },
  });
  await debitExchange(tx, {
    officeId,
    currencyCode: bill.currency,
    amount: amount.toString(),
    actorUserId: actor.userId,
    brokerTransferId: id,
  });
  return { id };
}
type PaymentInput = {
  beneficiaryId?: string | null;
  brokerTransferId?: string | null;
  brokerReceiptId?: string | null;
  exchangeOfficeId?: string | null;
};
export async function verifyBankPayment(
  tx: Tx,
  input: PaymentInput,
  source: Source,
  ctx: {
    amount: string;
    rate: string;
    remaining: string;
    currency: string;
    payeeCurrency?: string | undefined;
    actorId: string;
    branchId: string;
    date: Date;
    channel?: string | undefined;
    party: {
      brokerId?: string | null;
      organizationId?: string | null;
      supplierId?: string | null;
      name?: string | null;
    };
  },
) {
  await lock(tx, source);
  const open = await tx.financeBrokerTransfer.aggregate({
    where: { ...source, receiptId: null },
    _sum: { amount: true },
  });
  const pending = open._sum.amount ?? new Prisma.Decimal(0);
  if (!input.exchangeOfficeId) {
    if (input.brokerReceiptId || input.brokerTransferId)
      v.rule('حواله کارگزار باید از صرافی پرداخت شده باشد.');
    if (new Prisma.Decimal(ctx.remaining).sub(pending).lt(ctx.amount))
      v.rule('برای این بخش از مانده قبلاً حواله صادر شده است.');
    let ownerId = null;
    if (
      (ctx.channel === 'BANK_TRANSFER' || input.beneficiaryId) &&
      !ctx.party.brokerId &&
      !ctx.party.supplierId &&
      !ctx.party.organizationId &&
      !('invoiceId' in source)
    ) {
      ownerId =
        (
          await tx.financePayeeDesignation.findFirst({
            where: {
              ...source,
              book: {
                branchId: ctx.branchId,
                id: new FinanceFiscalStorage().current()?.bookId ?? undefined,
              },
            },
          })
        )?.ownerId ?? null;
    }
    const beneficiaryId =
      ctx.channel === 'BANK_TRANSFER' || input.beneficiaryId
        ? await validatePayee(
            tx,
            ctx.branchId,
            new FinanceFiscalStorage().current()?.bookId ?? undefined,
            input.beneficiaryId,
            ctx.payeeCurrency ?? ctx.currency,
            { ...ctx.party, ownerId },
          )
        : null;
    return { beneficiaryId, brokerTransferId: null };
  }
  if (input.beneficiaryId)
    v.rule('حساب مقصد بانکی شرکت در این پرداخت کاربرد ندارد.');
  if (!input.brokerTransferId || !input.brokerReceiptId)
    v.rule('برای تسویه خرید صرافی، حواله و رسید کارگزار لازم است.');
  const id = v.uuid(input.brokerTransferId)!,
    receiptId = v.uuid(input.brokerReceiptId)!;
  const row = await tx.financeBrokerTransfer.findFirst({
    where: {
      id,
      ...source,
      officeId: input.exchangeOfficeId,
      book: { branchId: ctx.branchId },
      receiptId: null,
    },
  });
  if (
    !row ||
    !row.amount.eq(ctx.amount) ||
    !row.rate.eq(ctx.rate) ||
    row.currency !== ctx.currency ||
    ctx.date < row.sentAt
  )
    v.rule('مبلغ، ارز یا تاریخ رسید با حواله باز مطابقت ندارد.');
  new FinanceFiscalStorage().require(row.bookId);
  await assertFinanceFiscalWrite(tx, ctx.date);
  const receipt = await tx.document.findFirst({
    where: {
      id: receiptId,
      deletedAt: null,
      branchId: ctx.branchId,
      sourceModule: 'FINANCE',
      sourceEntityType: 'FinanceBrokerTransfer',
      sourceEntityId: row.id,
      documentType: { domain: 'FINANCE' },
      archiveStatus: 'ACTIVE',
      currentVersion: { scanStatus: 'CLEAN' },
    },
    include: { currentVersion: { select: { sha256: true } } },
  });
  if (!receipt?.currentVersionId)
    v.rule('رسید کارگزار باید فایل سالم و ثبت‌شده برای همین حواله باشد.');
  if (
    await tx.financeBrokerTransfer.count({
      where: {
        ...source,
        receiptVersion: { sha256: receipt.currentVersion!.sha256 },
      },
    })
  )
    v.rule('این فایل رسید قبلاً برای همین خرید ثبت شده است.');
  await assertFinancialProofVersion(tx, {
    branchId: ctx.branchId,
    documentId: receiptId,
    versionId: receipt.currentVersionId,
  });
  if (
    !(
      await tx.financeBrokerTransfer.updateMany({
        where: { id, receiptId: null },
        data: {
          receiptVersionId: receipt.currentVersionId,
          receiptId,
          confirmedBy: ctx.actorId,
          receivedAt: ctx.date,
        },
      })
    ).count
  )
    throw new ConflictException();
  return { beneficiaryId: null, brokerTransferId: id };
}
