import { randomUUID } from 'node:crypto';
import {
  BadRequestException, ConflictException, ForbiddenException, Inject,
  Injectable, NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor, FinancePaidTicketCostV1,
  FinanceTicketCostCommandV1, FinanceTicketPaymentCommandV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';
import { ProcurementPublicService } from '../../procurement/procurement-public.service';

const money = (value: string, allowZero = false) => {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value))
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
    @Inject(ProcurementPublicService) private readonly procurement: ProcurementPublicService,
  ) {}

  async recordCost(requestId: string, input: FinanceTicketCostCommandV1, actor: AuthenticatedActor) {
    this.assertPaymentPermission(actor);
    if (input?.version !== 1 || !/^[A-Z]{3}$/.test(input.currencyCode ?? '') ||
      !input.reason?.trim() || input.reason.trim().length > 500)
      throw new BadRequestException('جزئیات قیمت خرید معتبر نیست.');
    const request = await this.procurement.forFinance(requestId, actor.branchIds);
    const adult = money(input.adultUnitCost, true);
    const child = money(input.childUnitCost, true);
    const invoice = money(input.invoiceAmount);
    if (adult.isZero() && child.isZero())
      throw new BadRequestException('حداقل یکی از نرخ‌های بزرگسال یا کودک لازم است.');
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`);
      const previous = await tx.financeTicketPurchaseCostRevision.findFirst({
        where: { requestId }, orderBy: { version: 'desc' }, include: { payments: { take: 1 } },
      });
      if (previous?.payments.length)
        throw new ConflictException('پس از آغاز پرداخت، اصلاح قیمت خرید مجاز نیست.');
      const row = await tx.financeTicketPurchaseCostRevision.create({ data: {
        id: randomUUID(), requestId, branchId: request.branchId,
        offerId: request.offerId, offerVersion: request.offerVersion,
        version: (previous?.version ?? 0) + 1, adultUnitCost: adult,
        childUnitCost: child, invoiceAmount: invoice,
        currencyCode: input.currencyCode, reason: input.reason.trim(), actorUserId: actor.userId,
      } });
      return { id: row.id, requestId, version: row.version,
        adultUnitCost: row.adultUnitCost.toString(), childUnitCost: row.childUnitCost.toString(),
        invoiceAmount: row.invoiceAmount.toString(), currencyCode: row.currencyCode };
    });
  }

  async recordPayment(requestId: string, input: FinanceTicketPaymentCommandV1, actor: AuthenticatedActor) {
    this.assertPaymentPermission(actor);
    if (input?.version !== 1 || !/^[0-9a-f-]{36}$/i.test(input.costRevisionId ?? '') ||
      !/^[0-9a-f-]{36}$/i.test(input.accountId ?? '') ||
      !/^[0-9a-f-]{36}$/i.test(input.paymentMethodId ?? '') ||
      !input.reason?.trim() || input.reason.trim().length > 500 ||
      (input.paymentReference?.length ?? 0) > 160)
      throw new BadRequestException('اطلاعات پرداخت معتبر نیست.');
    const transferAt = new Date(input.transferAt);
    if (Number.isNaN(transferAt.getTime()) || !/Z$/.test(input.transferAt))
      throw new BadRequestException('زمان انتقال باید UTC باشد.');
    const amount = money(input.paidAmount);
    const rate = new Prisma.Decimal(input.exchangeRateToIrr);
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(input.exchangeRateToIrr) || rate.lte(0))
      throw new BadRequestException('نرخ تسعیر معتبر نیست.');
    const request = await this.procurement.forFinance(requestId, actor.branchIds);
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`);
      const cost = await tx.financeTicketPurchaseCostRevision.findFirst({
        where: { id: input.costRevisionId, requestId, branchId: request.branchId },
      });
      if (!cost) throw new NotFoundException('قیمت خرید قطعی یافت نشد.');
      const latest = await tx.financeTicketPurchaseCostRevision.findFirst({
        where: { requestId }, orderBy: { version: 'desc' }, select: { id: true },
      });
      if (latest?.id !== cost.id) throw new ConflictException('نسخه قیمت خرید تغییر کرده است.');
      const account = await tx.financeSettlementAccount.findFirst({
        where: { id: input.accountId, branchId: request.branchId, isActive: true,
          currencyCode: cost.currencyCode },
      });
      if (!account) throw new BadRequestException('حساب فعال هم‌ارز خرید یافت نشد.');
      const method = await tx.masterPaymentMethod.findFirst({
        where: { id: input.paymentMethodId, isActive: true,
          direction: { in: ['PAYMENT', 'BOTH'] } },
      });
      if (!method) throw new BadRequestException('روش پرداخت خروجی فعال نیست.');
      const previous = await tx.financeTicketPurchasePaymentRevision.findFirst({
        where: { costRevisionId: cost.id }, orderBy: { version: 'desc' },
      });
      const cumulative = (previous?.cumulativePaid ?? new Prisma.Decimal(0)).add(amount);
      const remaining = cost.invoiceAmount.sub(cumulative);
      if (remaining.lt(0)) throw new BadRequestException('پرداخت بیش از مبلغ فاکتور است.');
      const rialEquivalent = amount.mul(rate).toDecimalPlaces(4);
      const row = await tx.financeTicketPurchasePaymentRevision.create({ data: {
        id: randomUUID(), costRevisionId: cost.id, version: (previous?.version ?? 0) + 1,
        status: remaining.isZero() ? 'PAID' : 'PARTIALLY_PAID',
        accountId: account.id, paymentMethodId: method.id,
        paidAmount: amount, cumulativePaid: cumulative, remainingAmount: remaining,
        exchangeRateToIrr: rate, rialEquivalent, transferAt,
        paymentReference: input.paymentReference?.trim() || null,
        reason: input.reason.trim(), actorUserId: actor.userId,
      } });
      if (remaining.isZero())
        await this.procurement.markFinancePaid(tx, requestId, request.branchId, request.requestVersion);
      return { id: row.id, costRevisionId: cost.id, version: row.version,
        status: row.status, cumulativePaid: cumulative.toString(),
        remainingAmount: remaining.toString() };
    });
  }

  /** Only a fully paid, offer-linked, immutable cost is visible to package pricing. */
  async paidCostsForOffers(offerIds: readonly string[], branchId: string): Promise<readonly FinancePaidTicketCostV1[]> {
    if (!offerIds.length) return [];
    const costs = await this.database.client.financeTicketPurchaseCostRevision.findMany({
      where: { offerId: { in: [...offerIds] }, branchId },
      include: { payments: { where: { status: 'PAID' }, orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { version: 'desc' },
    });
    const seen = new Set<string>();
    return costs.flatMap((cost): FinancePaidTicketCostV1[] => {
      if (!cost.offerId || !cost.offerVersion || !cost.payments[0] || seen.has(cost.offerId)) return [];
      seen.add(cost.offerId);
      return [{ version: 1, requestId: cost.requestId, offerId: cost.offerId,
        offerVersion: cost.offerVersion, costRevisionId: cost.id,
        adultUnitCost: cost.adultUnitCost.toString(), childUnitCost: cost.childUnitCost.toString(),
        invoiceAmount: cost.invoiceAmount.toString(), currencyCode: cost.currencyCode,
        paidAt: cost.payments[0].transferAt.toISOString() }];
    });
  }

  async queueStates(requestIds: readonly string[]) {
    if (!requestIds.length) return new Map<string, {
      costRevisionId: string; invoiceAmount: string; currencyCode: string;
      paidAmount: string; remainingAmount: string; status: 'READY_FOR_PAYMENT' | 'PAYING';
    }>();
    const rows = await this.database.client.financeTicketPurchaseCostRevision.findMany({
      where: { requestId: { in: [...requestIds] } }, orderBy: { version: 'desc' },
      include: { payments: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const states = new Map<string, {
      costRevisionId: string; invoiceAmount: string; currencyCode: string;
      paidAmount: string; remainingAmount: string; status: 'READY_FOR_PAYMENT' | 'PAYING';
    }>();
    for (const row of rows) {
      if (states.has(row.requestId)) continue;
      const latest = row.payments[0];
      states.set(row.requestId, {
        costRevisionId: row.id, invoiceAmount: row.invoiceAmount.toString(),
        currencyCode: row.currencyCode,
        paidAmount: latest?.cumulativePaid.toString() ?? '0',
        remainingAmount: latest?.remainingAmount.toString() ?? row.invoiceAmount.toString(),
        status: latest ? 'PAYING' : 'READY_FOR_PAYMENT',
      });
    }
    return states;
  }

  private assertPaymentPermission(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.payment.create'))
      throw new ForbiddenException('دسترسی ثبت قیمت خرید و پرداخت مالی وجود ندارد.');
  }
}
