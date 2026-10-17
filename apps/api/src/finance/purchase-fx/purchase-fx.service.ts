import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Module,
} from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  FinanceInboxItemV1,
  FinancePurchaseFxV1,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { MasterProcurementDirectory } from '../../master-data/master-procurement-directory';
import { MasterDataModule } from '../../master-data/master-data.module';
import { purchaseFxComparison } from './purchase-fx.math';

type Capture = {
  reservationPurchaseId?: string;
  ticketCostId?: string;
  invoiceRevisionId?: string;
  branchId: string;
  currencyCode: string;
  amount: string;
  baselineAt?: Date;
  rateToIrr?: string;
  actorUserId: string;
};
@Injectable()
export class PurchaseFxService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MasterProcurementDirectory)
    private readonly directory: MasterProcurementDirectory,
  ) {}
  quote(currency: string) {
    if (!/^[A-Z]{3}$/.test(currency) || currency === 'IRR')
      throw new BadRequestException('ارز خرید معتبر نیست.');
    return this.directory.purchaseRateToIrr(currency);
  }
  async capture(tx: Prisma.TransactionClient, input: Capture) {
    if (input.currencyCode === 'IRR') return null;
    if (input.rateToIrr !== undefined && typeof input.rateToIrr !== 'string')
      throw new BadRequestException('نرخ مبنای خرید باید مثبت باشد.');
    if (
      input.rateToIrr &&
      (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(input.rateToIrr) ||
        new Prisma.Decimal(input.rateToIrr).lte(0))
    )
      throw new BadRequestException('نرخ مبنای خرید باید مثبت باشد.');
    const where = {
      ...(input.reservationPurchaseId
        ? { reservationPurchaseId: input.reservationPurchaseId }
        : {}),
      ...(input.ticketCostId ? { ticketCostId: input.ticketCostId } : {}),
      ...(input.invoiceRevisionId
        ? { invoiceRevisionId: input.invoiceRevisionId }
        : {}),
    };
    if (Object.keys(where).length !== 1)
      throw new BadRequestException('مرجع خرید معتبر نیست.');
    await tx.$queryRaw(
      Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'finance-purchase-fx:' + Object.values(where)[0]},0))`,
    );
    const old = await tx.financePurchaseFxSnapshot.findFirst({ where });
    if (old) {
      if (input.rateToIrr && !old.rateToIrr.equals(input.rateToIrr))
        throw new ConflictException('نرخ مبنای خرید قبلاً ثبت شده و ثابت است.');
      return old;
    }
    const baselineAt = input.baselineAt ?? new Date();
    let quote = input.rateToIrr
      ? { rateToIrr: input.rateToIrr, source: 'MANUAL' }
      : await this.directory.purchaseRateToIrr(
          input.currencyCode,
          baselineAt,
          tx,
        );
    if (input.rateToIrr) {
      const reference = await this.directory.purchaseRateToIrr(
        input.currencyCode,
        baselineAt,
        tx,
      );
      if (
        reference &&
        new Prisma.Decimal(reference.rateToIrr).equals(input.rateToIrr)
      )
        quote = { rateToIrr: input.rateToIrr, source: reference.source };
    }
    if (!quote) return null;
    if (
      !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(quote.rateToIrr) ||
      new Prisma.Decimal(quote.rateToIrr).lte(0)
    )
      throw new BadRequestException('نرخ مبنای خرید باید مثبت باشد.');
    return tx.financePurchaseFxSnapshot.create({
      data: {
        ...where,
        branchId: input.branchId,
        actorUserId: input.actorUserId,
        currencyCode: input.currencyCode,
        foreignAmount: input.amount,
        rateToIrr: quote.rateToIrr,
        source: quote.source,
        baselineAt,
      },
    });
  }
  async enrich(items: FinanceInboxItemV1[], actor: AuthenticatedActor) {
    const reservationIds = items.flatMap(
      (i) => i.reservationPurchase?.lines.map((p) => p.purchaseId) ?? [],
    );
    const ticketIds = items
      .filter((i) => i.ticketPurchase)
      .map((i) => i.sourceContextReference);
    const invoiceIds = items
      .filter((i) => i.id.startsWith('purchases:invoice:'))
      .map((i) => i.sourceReference);
    const [snapshots, reservationPayments, ticketPayments, invoicePayments] =
      await Promise.all([
        this.db.client.financePurchaseFxSnapshot.findMany({
          where: {
            branchId: { in: [...actor.branchIds] },
            OR: [
              { reservationPurchaseId: { in: reservationIds } },
              { ticketCostId: { in: ticketIds } },
              { invoiceRevision: { sourceId: { in: invoiceIds } } },
            ],
          },
          include: {
            invoiceRevision: {
              select: { sourceId: true, sourceVersion: true },
            },
          },
        }),
        this.db.client.financeSupplierPaymentRevision.findMany({
          where: {
            purchaseId: { in: reservationIds },
            status: { in: ['PAID', 'PARTIALLY_PAID'] },
            purchase: { intake: { branchId: { in: [...actor.branchIds] } } },
          },
        }),
        this.db.client.financeTicketPurchasePaymentRevision.findMany({
          where: {
            costRevisionId: { in: ticketIds },
            status: { in: ['PAID', 'PARTIALLY_PAID'] },
            cost: { branchId: { in: [...actor.branchIds] } },
          },
        }),
        this.db.client.financeProcurementInvoiceRevision.findMany({
          where: {
            sourceId: { in: invoiceIds },
            branchId: { in: [...actor.branchIds] },
            paidAmount: { not: null },
            status: { in: ['PAID', 'PARTIALLY_PAID'] },
          },
        }),
      ]);
    for (const item of items) {
      const entries =
        item.reservationPurchase?.lines.map((p) => ({
          id: p.purchaseId,
          amount: p.amount,
          currency: p.currencyCode,
        })) ??
        (item.amount && item.kind === 'PAYMENT_REQUEST'
          ? [
              {
                id: item.ticketPurchase
                  ? item.sourceContextReference
                  : item.sourceReference,
                amount: item.amount.amount,
                currency: item.amount.currencyCode,
              },
            ]
          : []);
      const fx: FinancePurchaseFxV1[] = [];
      for (const entry of entries) {
        if (entry.currency === 'IRR') continue;
        const snap = snapshots.find((s) =>
          item.reservationPurchase
            ? s.reservationPurchaseId === entry.id
            : item.ticketPurchase
              ? s.ticketCostId === entry.id
              : s.invoiceRevision?.sourceId === entry.id &&
                s.invoiceRevision.sourceVersion === item.sourceVersion,
        );
        const payments = item.reservationPurchase
          ? reservationPayments.filter((p) => p.purchaseId === entry.id)
          : item.ticketPurchase
            ? ticketPayments.filter((p) => p.costRevisionId === entry.id)
            : invoicePayments.filter(
                (p) =>
                  p.sourceId === entry.id &&
                  p.sourceVersion === item.sourceVersion,
              );
        const paymentVersion =
          item.reservationPurchase?.lines.find(
            (line) => line.purchaseId === entry.id,
          )?.financeVersion ??
          item.ticketPurchase?.paymentCount ??
          item.financeVersion ??
          0;
        const evidence = payments
          .filter((p) => p.version <= paymentVersion)
          .filter((p) => p.paidAmount !== null && p.rialEquivalent !== null)
          .map((p) => ({
            paidAmount: p.paidAmount!.toString(),
            rialEquivalent: p.rialEquivalent!.toString(),
          }));
        fx.push({
          referenceId: entry.id,
          currencyCode: entry.currency,
          foreignAmount: entry.amount,
          rateToIrr: snap?.rateToIrr.toString() ?? null,
          source: snap?.source ?? null,
          baselineAt: snap?.baselineAt.toISOString() ?? item.createdAt,
          ...purchaseFxComparison(
            entry.amount,
            snap?.rateToIrr.toString() ?? null,
            evidence,
          ),
          ...(evidence.length !==
          payments.filter((p) => p.version <= paymentVersion).length
            ? {
                actualPaidEquivalent: null,
                realizedGainLoss: null,
                averagePaidRateToIrr: null,
                gainLossPerUnit: null,
              }
            : {}),
        });
      }
      if (fx.length) item.purchaseFx = fx;
    }
    return items;
  }
}
@Module({
  imports: [MasterDataModule],
  providers: [PurchaseFxService],
  exports: [PurchaseFxService],
})
export class PurchaseFxModule {}
