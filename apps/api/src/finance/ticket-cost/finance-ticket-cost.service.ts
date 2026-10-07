import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinancePaidTicketCostV1,
  FinanceTicketCostCommandV1,
  FinanceTicketPaymentCommandV1,
  TicketPurchaseInboxItemV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { ProcurementPublicService } from '../../procurement/procurement-public.service';

const money = (value: string, allowZero = false) => {
  if (!/^(?:0|[1-9]\d{0,19})(?:\.\d{1,4})?$/.test(value))
    throw new BadRequestException('مبلغ با حداکثر چهار رقم اعشار لازم است.');
  const decimal = new Prisma.Decimal(value);
  if (allowZero ? decimal.lt(0) : decimal.lte(0))
    throw new BadRequestException('مبلغ نامعتبر است.');
  return decimal;
};

@Injectable()
export class FinanceTicketCostService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ProcurementPublicService)
    private readonly procurement: ProcurementPublicService,
  ) {}

  async recordCost(
    requestId: string,
    input: FinanceTicketCostCommandV1,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('procurement.quote.manage'))
      throw new ForbiddenException(
        'مجوز ثبت قیمت خرید در خرید و تأمین لازم است.',
      );
    if (input?.version !== 1 || !/^[A-Z]{3}$/.test(input.currencyCode ?? ''))
      throw new BadRequestException('جزئیات قیمت خرید معتبر نیست.');
    const request = await this.procurement.forFinance(
      requestId,
      actor.branchIds,
    );
    if (
      input.operationId !== undefined &&
      (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.operationId,
      ) ||
        !Number.isSafeInteger(input.expectedCostVersion) ||
        input.expectedCostVersion! < 0)
    )
      throw new BadRequestException(
        'شناسه عملیات و نسخه قیمت خرید معتبر لازم است.',
      );
    if (input.operationId && !request.supplierDisplaySnapshot?.trim())
      throw new BadRequestException(
        'تأمین‌کننده پرواز باید در درخواست خرید مشخص باشد.',
      );
    const isSeatPricing =
      input.seatCount !== undefined || input.unitCost !== undefined;
    const seatCount = isSeatPricing
      ? (input.seatCount ?? request.seatCount)
      : null;
    let adult: Prisma.Decimal;
    let child: Prisma.Decimal;
    let invoice: Prisma.Decimal;
    let unitCost: Prisma.Decimal | null = null;
    if (isSeatPricing) {
      if (
        seatCount === null ||
        !Number.isSafeInteger(seatCount) ||
        seatCount < 1 ||
        seatCount > 100000 ||
        (request.seatCount !== null &&
          request.seatCount !== undefined &&
          seatCount > request.seatCount)
      )
        throw new BadRequestException(
          'تعداد صندلی خریداری‌شده معتبر لازم است.',
        );
      if (!input.unitCost)
        throw new BadRequestException('قیمت خرید هر صندلی لازم است.');
      unitCost = money(input.unitCost);
      adult = unitCost;
      child = new Prisma.Decimal(0);
      invoice = unitCost.mul(seatCount).toDecimalPlaces(4);
      money(invoice.toString());
    } else {
      if (!input.adultUnitCost || !input.childUnitCost || !input.invoiceAmount)
        throw new BadRequestException('جزئیات قیمت خرید معتبر نیست.');
      adult = money(input.adultUnitCost, true);
      child = money(input.childUnitCost, true);
      invoice = money(input.invoiceAmount);
      if (adult.isZero() && child.isZero())
        throw new BadRequestException(
          'حداقل یکی از نرخ‌های بزرگسال یا کودک لازم است.',
        );
    }
    const reason = input.operationId
      ? 'purchase-operation:' +
        input.operationId +
        ':' +
        createHash('sha256')
          .update(
            JSON.stringify({
              requestId,
              seatCount,
              unitCost: unitCost?.toString() ?? null,
              adult: adult.toString(),
              child: child.toString(),
              invoice: invoice.toString(),
              currencyCode: input.currencyCode,
              expectedCostVersion: input.expectedCostVersion,
            }),
          )
          .digest('hex')
      : '';
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`,
      );
      if (input.operationId) {
        const replay = await tx.financeTicketPurchaseCostRevision.findFirst({
          where: {
            requestId,
            reason: {
              startsWith: 'purchase-operation:' + input.operationId + ':',
            },
          },
        });
        if (replay) {
          if (replay.reason !== reason)
            throw new ConflictException(
              'شناسه عملیات قبلاً با قیمت دیگری استفاده شده است.',
            );
          return this.costSnapshot(replay);
        }
      }
      const previous = await tx.financeTicketPurchaseCostRevision.findFirst({
        where: { requestId },
        orderBy: { version: 'desc' },
        include: { payments: { take: 1 } },
      });
      if (
        input.expectedCostVersion !== undefined &&
        input.expectedCostVersion !== (previous?.version ?? 0)
      )
        throw new ConflictException(
          'قیمت خرید هم‌زمان تغییر کرده؛ کارتابل را به‌روز کنید.',
        );
      if (previous?.payments.length)
        throw new ConflictException(
          'پس از آغاز پرداخت، اصلاح قیمت خرید مجاز نیست.',
        );
      const row = await tx.financeTicketPurchaseCostRevision.create({
        data: {
          id: randomUUID(),
          requestId,
          branchId: request.branchId,
          offerId: request.offerId,
          offerVersion: request.offerVersion,
          version: (previous?.version ?? 0) + 1,
          adultUnitCost: adult,
          childUnitCost: child,
          invoiceAmount: invoice,
          seatCount,
          unitCost,
          currencyCode: input.currencyCode,
          reason,
          actorUserId: actor.userId,
        },
      });
      return this.costSnapshot(row);
    });
  }

  private costSnapshot(row: {
    id: string;
    requestId: string;
    version: number;
    adultUnitCost: Prisma.Decimal;
    childUnitCost: Prisma.Decimal;
    seatCount: number | null;
    unitCost: Prisma.Decimal | null;
    invoiceAmount: Prisma.Decimal;
    currencyCode: string;
  }) {
    return {
      id: row.id,
      requestId: row.requestId,
      version: row.version,
      adultUnitCost: row.adultUnitCost.toString(),
      childUnitCost: row.childUnitCost.toString(),
      seatCount: row.seatCount,
      unitCost: row.unitCost?.toString() ?? null,
      invoiceAmount: row.invoiceAmount.toString(),
      currencyCode: row.currencyCode,
    };
  }

  async purchaseInbox(actor: AuthenticatedActor): Promise<{
    data: TicketPurchaseInboxItemV1[];
    meta: { canPrice: boolean };
  }> {
    const requests = await this.procurement.listTicketPurchaseInbox(actor);
    const states = await this.queueStates(requests.map((r) => r.id));
    return {
      meta: {
        canPrice: actor.permissions.includes('procurement.quote.manage'),
      },
      data: requests.map((request) => {
        const state = states.get(request.id);
        return {
          request,
          cost: state
            ? {
                id: state.costRevisionId,
                version: state.costVersion,
                seatCount: state.seatCount,
                unitCost: state.unitCost,
                invoiceAmount: state.invoiceAmount,
                currencyCode: state.currencyCode,
                paidAmount: state.paidAmount,
                remainingAmount: state.remainingAmount,
                paymentCount: state.paymentCount,
              }
            : null,
          stage:
            request.status === 'PAID' ? 'PAID' : (state?.status ?? 'UNPRICED'),
        };
      }),
    };
  }

  async recordPayment(
    requestId: string,
    input: FinanceTicketPaymentCommandV1,
    actor: AuthenticatedActor,
  ) {
    this.assertPaymentPermission(actor);
    if (
      input?.version !== 1 ||
      !/^[0-9a-f-]{36}$/i.test(input.costRevisionId ?? '') ||
      (input.operationId !== undefined &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          input.operationId,
        )) ||
      (input.expectedPaymentVersion !== undefined &&
        (!Number.isSafeInteger(input.expectedPaymentVersion) ||
          input.expectedPaymentVersion < 0)) ||
      !/^[0-9a-f-]{36}$/i.test(input.accountId ?? '') ||
      !/^[0-9a-f-]{36}$/i.test(input.paymentMethodId ?? '') ||
      (input.paymentReference?.length ?? 0) > 160
    )
      throw new BadRequestException('اطلاعات پرداخت معتبر نیست.');
    const transferAt = new Date(input.transferAt);
    if (Number.isNaN(transferAt.getTime()) || !/Z$/.test(input.transferAt))
      throw new BadRequestException('زمان انتقال باید UTC باشد.');
    const amount = money(input.paidAmount);
    if (
      !/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(input.exchangeRateToIrr) ||
      new Prisma.Decimal(input.exchangeRateToIrr).lte(0)
    )
      throw new BadRequestException('نرخ تسعیر معتبر نیست.');
    const rate = new Prisma.Decimal(input.exchangeRateToIrr);
    // Public Procurement reads use its own connection. Never request another
    // connection while holding the Finance transaction/advisory lock.
    const replayExists = () =>
      input.operationId
        ? this.database.client.financeTicketPurchasePaymentRevision.findUnique({
            where: { id: input.operationId },
            select: { id: true },
          })
        : Promise.resolve(null);
    let request: Awaited<
      ReturnType<ProcurementPublicService['forFinance']>
    > | null = null;
    if (!(await replayExists())) {
      try {
        request = await this.procurement.forFinance(requestId, actor.branchIds);
      } catch (error) {
        // A concurrent full settlement may have closed the producer after our
        // first lookup. Its immutable payment can still be replayed below.
        if (!(await replayExists())) throw error;
      }
    }
    return this.database.client.$transaction(async (tx) => {
      if (input.operationId)
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`finance-payment:${input.operationId.toLowerCase()}`}, 0))`,
        );
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`,
      );
      if (input.operationId) {
        const replay = await tx.financeTicketPurchasePaymentRevision.findUnique(
          { where: { id: input.operationId }, include: { cost: true } },
        );
        if (replay) {
          if (
            replay.cost.requestId !== requestId ||
            !actor.branchIds.includes(replay.cost.branchId) ||
            replay.costRevisionId !== input.costRevisionId ||
            replay.actorUserId !== actor.userId ||
            replay.accountId !== input.accountId ||
            replay.paymentMethodId !== input.paymentMethodId ||
            !replay.paidAmount.equals(amount) ||
            !replay.exchangeRateToIrr.equals(rate) ||
            replay.transferAt.getTime() !== transferAt.getTime() ||
            replay.paymentReference !== (input.paymentReference?.trim() || null)
          )
            throw new ConflictException(
              'شناسه عملیات قبلاً برای پرداخت دیگری استفاده شده است.',
            );
          return {
            id: replay.id,
            costRevisionId: replay.costRevisionId,
            version: replay.version,
            status: replay.status,
            cumulativePaid: replay.cumulativePaid.toString(),
            remainingAmount: replay.remainingAmount.toString(),
          };
        }
      }
      if (!request)
        throw new ConflictException(
          'نتیجه پرداخت تغییر کرده است؛ دوباره تلاش کنید.',
        );
      const cost = await tx.financeTicketPurchaseCostRevision.findFirst({
        where: {
          id: input.costRevisionId,
          requestId,
          branchId: request.branchId,
        },
      });
      if (!cost) throw new NotFoundException('قیمت خرید قطعی یافت نشد.');
      const latest = await tx.financeTicketPurchaseCostRevision.findFirst({
        where: { requestId },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      if (latest?.id !== cost.id)
        throw new ConflictException('نسخه قیمت خرید تغییر کرده است.');
      const account = await tx.financeSettlementAccount.findFirst({
        where: {
          id: input.accountId,
          branchId: request.branchId,
          isActive: true,
          currencyCode: cost.currencyCode,
        },
      });
      if (!account)
        throw new BadRequestException('حساب فعال هم‌ارز خرید یافت نشد.');
      const method = await tx.masterPaymentMethod.findFirst({
        where: {
          id: input.paymentMethodId,
          isActive: true,
          direction: { in: ['PAYMENT', 'BOTH'] },
        },
      });
      if (!method) throw new BadRequestException('روش پرداخت خروجی فعال نیست.');
      const previous = await tx.financeTicketPurchasePaymentRevision.findFirst({
        where: { costRevisionId: cost.id },
        orderBy: { version: 'desc' },
      });
      if (
        input.expectedPaymentVersion !== undefined &&
        input.expectedPaymentVersion !== (previous?.version ?? 0)
      )
        throw new ConflictException(
          'پرداخت هم‌زمان تغییر کرده است؛ کارتابل را به‌روز کنید.',
        );
      const cumulative = (
        previous?.cumulativePaid ?? new Prisma.Decimal(0)
      ).add(amount);
      const remaining = cost.invoiceAmount.sub(cumulative);
      if (remaining.lt(0))
        throw new BadRequestException('پرداخت بیش از مبلغ فاکتور است.');
      const rialEquivalent = amount.mul(rate).toDecimalPlaces(4);
      const row = await tx.financeTicketPurchasePaymentRevision.create({
        data: {
          id: input.operationId ?? randomUUID(),
          costRevisionId: cost.id,
          version: (previous?.version ?? 0) + 1,
          status: remaining.isZero() ? 'PAID' : 'PARTIALLY_PAID',
          accountId: account.id,
          paymentMethodId: method.id,
          paidAmount: amount,
          cumulativePaid: cumulative,
          remainingAmount: remaining,
          exchangeRateToIrr: rate,
          rialEquivalent,
          transferAt,
          paymentReference: input.paymentReference?.trim() || null,
          reason: '',
          actorUserId: actor.userId,
        },
      });
      if (remaining.isZero())
        await this.procurement.markFinancePaid(
          tx,
          requestId,
          request.branchId,
          request.requestVersion,
        );
      return {
        id: row.id,
        costRevisionId: cost.id,
        version: row.version,
        status: row.status,
        cumulativePaid: cumulative.toString(),
        remainingAmount: remaining.toString(),
      };
    });
  }

  /** Recorded actual cost, independent of settlement; never a catalog sale quote. */
  async recordedCostsForOffers(offerIds: readonly string[], branchId: string) {
    if (!offerIds.length) return [];
    const rows =
      await this.database.client.financeTicketPurchaseCostRevision.findMany({
        where: { branchId, offerId: { in: [...new Set(offerIds)] } },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          offerId: true,
          currencyCode: true,
          adultUnitCost: true,
          childUnitCost: true,
          unitCost: true,
        },
      });
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (!row.offerId || seen.has(row.offerId)) return [];
      seen.add(row.offerId);
      return [
        {
          id: row.id,
          offerId: row.offerId,
          currencyCode: row.currencyCode,
          adultUnitCost: row.adultUnitCost.toString(),
          childUnitCost: row.childUnitCost.toString(),
          unitCost: row.unitCost?.toString() ?? null,
        },
      ];
    });
  }

  /** Only a fully paid, offer-linked, immutable cost is visible to package pricing. */
  async paidCostsForOffers(
    offerIds: readonly string[],
    branchId: string,
  ): Promise<readonly FinancePaidTicketCostV1[]> {
    if (!offerIds.length) return [];
    const costs =
      await this.database.client.financeTicketPurchaseCostRevision.findMany({
        where: { offerId: { in: [...offerIds] }, branchId },
        include: {
          payments: {
            where: { status: 'PAID' },
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
        orderBy: { version: 'desc' },
      });
    const seen = new Set<string>();
    return costs.flatMap((cost): FinancePaidTicketCostV1[] => {
      if (
        !cost.offerId ||
        !cost.offerVersion ||
        !cost.payments[0] ||
        seen.has(cost.offerId)
      )
        return [];
      seen.add(cost.offerId);
      return [
        {
          version: 1,
          requestId: cost.requestId,
          offerId: cost.offerId,
          offerVersion: cost.offerVersion,
          costRevisionId: cost.id,
          adultUnitCost: cost.adultUnitCost.toString(),
          childUnitCost: cost.childUnitCost.toString(),
          seatCount: cost.seatCount,
          unitCost: cost.unitCost?.toString() ?? null,
          invoiceAmount: cost.invoiceAmount.toString(),
          currencyCode: cost.currencyCode,
          paidAt: cost.payments[0].transferAt.toISOString(),
        },
      ];
    });
  }

  async queueStates(requestIds: readonly string[]) {
    if (!requestIds.length)
      return new Map<
        string,
        {
          costVersion: number;
          costRevisionId: string;
          invoiceAmount: string;
          currencyCode: string;
          seatCount: number | null;
          unitCost: string | null;
          paymentCount: number;
          paidAmount: string;
          remainingAmount: string;
          status: 'READY_FOR_PAYMENT' | 'PAYING';
        }
      >();
    const rows =
      await this.database.client.financeTicketPurchaseCostRevision.findMany({
        where: { requestId: { in: [...requestIds] } },
        orderBy: { version: 'desc' },
        include: {
          payments: { orderBy: { version: 'desc' }, take: 1 },
          _count: { select: { payments: true } },
        },
      });
    const states = new Map<
      string,
      {
        costVersion: number;
        costRevisionId: string;
        invoiceAmount: string;
        currencyCode: string;
        seatCount: number | null;
        unitCost: string | null;
        paymentCount: number;
        paidAmount: string;
        remainingAmount: string;
        status: 'READY_FOR_PAYMENT' | 'PAYING';
      }
    >();
    for (const row of rows) {
      if (states.has(row.requestId)) continue;
      const latest = row.payments[0];
      states.set(row.requestId, {
        costVersion: row.version,
        costRevisionId: row.id,
        invoiceAmount: row.invoiceAmount.toString(),
        currencyCode: row.currencyCode,
        seatCount: row.seatCount,
        unitCost: row.unitCost?.toString() ?? null,
        paymentCount: row._count.payments,
        paidAmount: latest?.cumulativePaid.toString() ?? '0',
        remainingAmount:
          latest?.remainingAmount.toString() ?? row.invoiceAmount.toString(),
        status: latest ? 'PAYING' : 'READY_FOR_PAYMENT',
      });
    }
    return states;
  }

  private assertPaymentPermission(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.payment.create'))
      throw new ForbiddenException(
        'دسترسی ثبت قیمت خرید و پرداخت مالی وجود ندارد.',
      );
  }
}
