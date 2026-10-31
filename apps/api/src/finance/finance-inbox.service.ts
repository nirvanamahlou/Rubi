import { financialDate } from './accounting/accounting.financial-events';
import {
  recordFinancialEvent,
  isNewAccountingSource,
} from './accounting/financial-event.public';
import { PurchaseFxService } from './purchase-fx/purchase-fx.service';
import { isOptionalOperationReason } from '@nora/contracts';
import { randomUUID } from 'node:crypto';
import { paymentSource } from './payments/payment-source';
import { MasterProcurementDirectory } from '../master-data/master-procurement-directory';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceInboxItemV1,
  FinanceProcurementInvoiceDecisionCommandV1,
  FinanceProcurementInvoicePaymentCommandV1,
  FinanceProcurementCorrectionDecisionCommandV1,
  FinanceInboxSourceStateV1,
  FinanceInboxV1,
  FinanceRequestStatus,
  FinanceReceiptDecisionCommandV1,
  FinanceSettlementAccountCreateV1,
  FinanceSettlementAccountV1,
  FinanceSupplierPaymentCommandV1,
  FinanceCustomerDocumentDeliveryCandidateV1,
  FinanceCustomerDocumentDeliveryCommandV1,
  HrConnectionStatus,
} from '@nora/contracts';
import { moneyDecimal, moneyUnits } from '@nora/contracts';

import { HrConnectionsService } from '../hr/hr-connections.service';
import { DatabaseService } from '../database/database.service';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import { SalesService } from '../sales/sales.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';
import { FinanceDeliveryService } from './document-delivery/finance-delivery.module';
import { FinanceTicketCostService } from './ticket-cost/finance-ticket-cost.service';
import { readFinanceHistory } from './finance-history';
import type { FinanceHistoryQueryV1 } from '@nora/contracts';
import { DecimalValue } from './finance.money';

const hrStatus: Record<HrConnectionStatus, FinanceRequestStatus> = {
  SUBMITTED: 'NEW',
  IN_REVIEW: 'UNDER_REVIEW',
  ANSWERED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

@Injectable()
export class FinanceInboxService {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(HrConnectionsService) private readonly hr: HrConnectionsService,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ProcurementPublicService)
    private readonly procurement: ProcurementPublicService,
    @Inject(FinanceTicketCostService)
    private readonly ticketCosts: FinanceTicketCostService,
    @Optional()
    @Inject(IamFinanceDirectory)
    private readonly identity?: IamFinanceDirectory,
    @Optional()
    @Inject(MasterProcurementDirectory)
    private readonly supplierDirectory?: MasterProcurementDirectory,
    @Optional()
    @Inject(PurchaseFxService)
    private readonly purchaseFx?: PurchaseFxService,
  ) {}

  history(query: FinanceHistoryQueryV1, actor: AuthenticatedActor) {
    return readFinanceHistory(
      this.database,
      this.sales,
      this.reservations,
      query,
      actor,
    );
  }

  async payingSuppliers(search: string, page: number) {
    if (!this.supplierDirectory)
      throw new BadRequestException('فهرست تأمین‌کنندگان در دسترس نیست.');
    const result = await this.supplierDirectory.suppliers(search, page);
    return {
      ...result,
      items: result.items
        .filter((row) => row.isActive && row.collaborationStatus === 'ACTIVE')
        .map((row) => ({ id: row.id, name: row.name || row.code })),
    };
  }

  private async completeHrInbox(actor: AuthenticatedActor) {
    const first = await this.hr.list({ target: 'finance', page: 1 }, actor);
    const items = [...first.items];
    if (first.total === undefined) return first;
    const seen = new Set(items.map((item) => item.id));
    const pages = Math.ceil(first.total / first.pageSize);
    if (
      !Number.isSafeInteger(first.total) ||
      first.total < 0 ||
      !Number.isSafeInteger(first.pageSize) ||
      first.pageSize < 1 ||
      pages > 1000 ||
      seen.size !== items.length
    )
      throw new ConflictException(
        'فهرست ارجاع‌ها کامل نیست؛ دوباره به‌روز کنید.',
      );
    for (let page = 2; page <= pages; page++) {
      const next = await this.hr.list({ target: 'finance', page }, actor);
      if (
        next.total !== first.total ||
        next.page !== page ||
        next.pageSize !== first.pageSize ||
        !next.items.length ||
        new Set(next.items.map((item) => item.id)).size !== next.items.length ||
        next.items.some((item) => seen.has(item.id))
      )
        throw new ConflictException(
          'فهرست ارجاع‌ها هم‌زمان تغییر کرده است؛ دوباره به‌روز کنید.',
        );
      next.items.forEach((item) => seen.add(item.id));
      items.push(...next.items);
    }
    if (items.length !== first.total)
      throw new ConflictException(
        'فهرست ارجاع‌ها کامل نیست؛ دوباره به‌روز کنید.',
      );
    return { ...first, items };
  }

  async list(actor: AuthenticatedActor): Promise<FinanceInboxV1> {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException({
        code: 'FINANCE_INBOX_FORBIDDEN',
        message: 'مجوز مشاهده کارتابل مالی وجود ندارد.',
      });

    const [
      salesResult,
      hrResult,
      reservationsResult,
      ticketResult,
      invoiceResult,
      correctionResult,
    ] = await Promise.allSettled([
      this.sales.financeInbox(actor),
      this.completeHrInbox(actor),
      this.reservations.list(actor.branchIds),
      this.procurement
        .listFinanceTicketPurchases(actor.branchIds)
        .then(async (items) => ({
          items,
          states: await this.ticketCosts.queueStates(
            items.map((item) => item.id),
          ),
        })),
      this.procurement
        .listFinanceInvoiceSources(actor.branchIds)
        .then(async (items) => ({
          items,
          rows: items.length
            ? await this.database.client.financeProcurementInvoiceRevision.findMany(
                {
                  where: {
                    sourceId: { in: items.map((item) => item.sourceId) },
                  },
                  orderBy: [{ sourceId: 'asc' }, { version: 'desc' }],
                  distinct: ['sourceId'],
                },
              )
            : [],
        })),
      this.procurement.listFinanceCorrections(actor.branchIds),
    ]);
    const salesItems =
      salesResult.status === 'fulfilled' ? salesResult.value : [];
    const hrItems = hrResult.status === 'fulfilled' ? hrResult.value.items : [];
    const reservationItems =
      reservationsResult.status === 'fulfilled'
        ? reservationsResult.value.flatMap((intake) => {
            const groups = new Map<
              string,
              NonNullable<typeof intake.servicePurchases>[number][]
            >();
            for (const purchase of intake.servicePurchases ?? []) {
              const groupId = purchase.batchId ?? purchase.id;
              groups.set(groupId, [...(groups.get(groupId) ?? []), purchase]);
            }
            return [...groups]
              .filter(([, purchases]) =>
                purchases.some(
                  (purchase) => purchase.finance.status !== 'PAID',
                ),
              )
              .map(([groupId, purchases]) => ({ intake, groupId, purchases }));
          })
        : [];
    const ticketItems =
      ticketResult.status === 'fulfilled'
        ? ticketResult.value.items.filter((item) =>
            ticketResult.value.states.has(item.id),
          )
        : [];
    const ticketStates =
      ticketResult.status === 'fulfilled'
        ? ticketResult.value.states
        : new Map();
    const invoiceItems = [
      ...new Map(
        (invoiceResult.status === 'fulfilled'
          ? [...invoiceResult.value.items].sort(
              (a, b) => a.sourceVersion - b.sourceVersion,
            )
          : []
        ).map((item) => [item.sourceId, item] as const),
      ).values(),
    ];
    const correctionItems =
      correctionResult.status === 'fulfilled' ? correctionResult.value : [];
    const financeRows =
      invoiceResult.status === 'fulfilled' ? invoiceResult.value.rows : [];
    const financeBySource = new Map(
      financeRows.map((row) => [row.sourceId, row] as const),
    );
    const payrollRows =
      await this.database.client.financeOperationalRequest.findMany({
        where: { branchId: { in: actor.branchIds } },
        include: {
          revisions: { orderBy: { version: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
      });
    const names = new Map(
      (
        (await this.identity?.displayNames(
          payrollRows.map((row) => row.requesterId),
          actor.branchIds,
        )) ?? []
      ).map((user) => [user.id, user.displayName]),
    );

    const items: FinanceInboxItemV1[] = [
      ...payrollRows.map((row): FinanceInboxItemV1 => ({
        version: 1,
        id: `operational:${row.id}`,
        direction:
          row.kind === 'PETTY_CASH_RETURN'
            ? 'RECEIPT'
            : row.kind === 'PETTY_CASH_EXPENSE'
              ? 'NON_CASH'
              : 'PAYMENT',
        source: ['PAYROLL', 'PAYROLL_WORKSHEET'].includes(row.kind)
          ? 'HR'
          : 'FINANCE',
        kind: ['PAYROLL', 'PAYROLL_WORKSHEET'].includes(row.kind)
          ? 'PAYROLL_REQUEST'
          : 'OPERATIONAL_REQUEST',
        sourceReference: row.id,
        sourceContextReference: row.hrRecordId ?? row.id,
        contractReference: row.reference,
        title: row.title,
        partyDisplaySnapshot: row.party,
        description: row.description,
        amount: {
          amount: row.amount.toString(),
          currencyCode: row.currencyCode,
        },
        settlement: {
          paidAmount: row.revisions[0]?.cumulativePaid.toString() ?? '0',
          remainingAmount:
            row.revisions[0]?.remainingAmount.toString() ??
            row.amount.toString(),
        },
        status: row.status as FinanceRequestStatus,
        dueAt: row.dueAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        requesterDisplaySnapshot: names.get(row.requesterId) ?? null,
        branchReference: row.branchId,
        sourceVersion: row.sourceVersion!,
        financeVersion: row.version,
        origin: 'PERSISTED_SOURCE',
      })),
      ...salesItems.map((item): FinanceInboxItemV1 => ({
        destinationAccountId: item.destinationAccountId ?? null,
        destinationAccountTitle: item.destinationAccountTitle ?? null,
        version: 1,
        id: `sales:${item.paymentId}`,
        source: 'SALES',
        kind: 'RECEIPT_VERIFICATION',
        sourceReference: item.paymentId,
        sourceContextReference: item.contractId,
        contractReference: item.contractNumber,
        title: `تأیید دریافت قرارداد ${item.contractNumber}`,
        partyDisplaySnapshot: item.customerNameSnapshot,
        description:
          item.description?.trim() || 'پرداخت ثبت‌شده در قرارداد فروش',
        amount: {
          amount: item.amount,
          currencyCode: item.currencyCode,
        },
        settlement: null,
        status: 'NEW',
        dueAt: item.dueAt,
        createdAt: item.createdAt,
        requesterDisplaySnapshot: item.createdByName,
        branchReference: item.branchId,
        sourceVersion: item.contractVersion,
        origin: 'PERSISTED_SOURCE',
      })),
      ...hrItems.map((item): FinanceInboxItemV1 => ({
        version: 1,
        id: `hr:${item.id}`,
        source: 'HR',
        kind: 'HR_REFERRAL',
        sourceReference: item.code,
        sourceContextReference: item.id,
        contractReference: null,
        title: item.title,
        partyDisplaySnapshot: item.employeeLabel,
        description: item.message,
        amount: null,
        settlement: null,
        status: hrStatus[item.status],
        hrReferral: { canRespond: item.canRespond, response: item.response },
        dueAt: item.dueAt,
        createdAt: item.createdAt,
        requesterDisplaySnapshot: null,
        branchReference: item.branchId,
        sourceVersion: item.version,
        origin: 'PERSISTED_SOURCE',
      })),
      ...reservationItems.map(
        ({ intake, groupId, purchases }): FinanceInboxItemV1 => {
          const totals = new Map<string, bigint>();
          for (const purchase of purchases)
            totals.set(
              purchase.currencyCode,
              (totals.get(purchase.currencyCode) ?? 0n) +
                moneyUnits(purchase.amount),
            );
          const amounts = [...totals].map(([currencyCode, amount]) => ({
            currencyCode,
            amount: moneyDecimal(amount),
          }));
          const first = purchases[0]!;
          return {
            version: 1,
            id: `reservations:${groupId}`,
            source: 'RESERVATIONS',
            kind: 'PAYMENT_REQUEST',
            sourceReference: groupId,
            sourceContextReference: intake.id,
            contractReference: intake.snapshot.contractNumber,
            title: `درخواست خرید قرارداد ${intake.snapshot.contractNumber}`,
            partyDisplaySnapshot: purchases
              .map((purchase) => purchase.supplierName)
              .filter((value, index, all) => all.indexOf(value) === index)
              .join('، '),
            description: `${purchases.length} خرید برای قرارداد ${intake.snapshot.contractNumber}: ${purchases.map((purchase) => purchase.serviceTitle).join('، ')}`,
            amount: amounts.length === 1 ? amounts[0]! : null,
            settlement: {
              paidAmount:
                amounts.length === 1
                  ? moneyDecimal(
                      purchases.reduce(
                        (sum, purchase) =>
                          sum + moneyUnits(purchase.finance.paidAmount),
                        0n,
                      ),
                    )
                  : '0',
              remainingAmount:
                amounts.length === 1
                  ? moneyDecimal(
                      purchases.reduce(
                        (sum, purchase) =>
                          sum + moneyUnits(purchase.finance.remainingAmount),
                        0n,
                      ),
                    )
                  : '0',
            },
            status: purchases.some(
              (purchase) => purchase.finance.status === 'REJECTED',
            )
              ? 'CORRECTION_REQUIRED'
              : purchases.some(
                    (purchase) =>
                      purchase.finance.status === 'PARTIALLY_PAID' ||
                      purchase.finance.status === 'PAID',
                  )
                ? 'PAYING'
                : 'READY_FOR_PAYMENT',
            dueAt: null,
            createdAt: first.createdAt,
            requesterDisplaySnapshot: null,
            branchReference: intake.branchId,
            sourceVersion: first.finance.version,
            origin: 'PERSISTED_SOURCE',
            reservationPurchase: {
              lines: purchases.map((purchase) => ({
                ...(purchase.hotelSavings
                  ? { hotelSavings: purchase.hotelSavings }
                  : {}),
                purchaseId: purchase.id,
                serviceTitle: purchase.serviceTitle,
                supplierName: purchase.supplierName,
                amount: purchase.amount,
                currencyCode: purchase.currencyCode,
                paidAmount: purchase.finance.paidAmount,
                remainingAmount: purchase.finance.remainingAmount,
                financeVersion: purchase.finance.version,
                status: purchase.finance.status,
              })),
              totals: amounts,
            },
          };
        },
      ),
      ...ticketItems
        .filter((purchase) => ticketStates.has(purchase.id))
        .map((purchase): FinanceInboxItemV1 => ({
          version: 1,
          id: 'purchases:' + purchase.id,
          source: 'PURCHASES',
          kind: 'PAYMENT_REQUEST',
          sourceReference: purchase.id,
          sourceContextReference:
            ticketStates.get(purchase.id)?.costRevisionId ??
            purchase.catalogProductReference,
          contractReference: null,
          title: 'خرید بلیط ' + purchase.title,
          partyDisplaySnapshot: purchase.supplierDisplaySnapshot,
          description: purchase.serviceDate
            ? 'قیمت خرید بلیط برای تاریخ ' + purchase.serviceDate
            : 'پرداخت خرید بلیط قیمت‌گذاری‌شده در خرید و تأمین',
          amount: ticketStates.has(purchase.id)
            ? {
                amount: ticketStates.get(purchase.id)!.invoiceAmount,
                currencyCode: ticketStates.get(purchase.id)!.currencyCode,
              }
            : null,
          settlement: ticketStates.has(purchase.id)
            ? {
                paidAmount: ticketStates.get(purchase.id)!.paidAmount,
                remainingAmount: ticketStates.get(purchase.id)!.remainingAmount,
              }
            : null,
          status: ticketStates.get(purchase.id)?.status ?? 'NEW',
          dueAt: purchase.serviceDate
            ? purchase.serviceDate + 'T00:00:00.000Z'
            : null,
          createdAt: purchase.createdAt,
          requesterDisplaySnapshot: null,
          branchReference: purchase.branchId,
          sourceVersion: purchase.requestVersion,
          origin: 'PERSISTED_SOURCE',
          ticketPurchase: {
            seatCount:
              ticketStates.get(purchase.id)?.seatCount ?? purchase.seatCount,
            unitCost: ticketStates.get(purchase.id)?.unitCost ?? null,
            paymentCount: ticketStates.get(purchase.id)?.paymentCount ?? 0,
          },
        })),
      ...invoiceItems.map((invoice): FinanceInboxItemV1 => {
        const finance = financeBySource.get(invoice.sourceId);
        const status: FinanceRequestStatus =
          finance && finance.sourceVersion === invoice.sourceVersion
            ? finance.status === 'APPROVED'
              ? 'READY_FOR_PAYMENT'
              : finance.status === 'CORRECTION_REQUIRED'
                ? 'CORRECTION_REQUIRED'
                : finance.status === 'PAID'
                  ? 'PAID'
                  : 'PAYING'
            : 'UNDER_REVIEW';
        return {
          version: 1,
          id: `purchases:invoice:${invoice.sourceId}:${invoice.sourceVersion}`,
          source: 'PURCHASES',
          kind: 'PAYMENT_REQUEST',
          sourceReference: invoice.sourceId,
          sourceContextReference: invoice.orderId,
          contractReference: null,
          title: `فاکتور خرید ${invoice.sourceId}`,
          partyDisplaySnapshot: invoice.supplier.label,
          description: `فاکتور تطبیق‌شدهٔ سفارش خرید نسخه ${invoice.orderVersion}`,
          amount: {
            amount: invoice.amount,
            currencyCode: invoice.currencyCode,
          },
          settlement:
            finance && finance.sourceVersion === invoice.sourceVersion
              ? {
                  paidAmount: finance.cumulativePaid.toString(),
                  remainingAmount: finance.remainingAmount.toString(),
                }
              : null,
          status,
          dueAt: invoice.dueAt,
          createdAt: invoice.handoffCreatedAt,
          requesterDisplaySnapshot: null,
          branchReference: invoice.branchId,
          sourceVersion: invoice.sourceVersion,
          financeVersion: finance?.version ?? 0,
          origin: 'PERSISTED_SOURCE',
        };
      }),
      ...correctionItems.map((correction): FinanceInboxItemV1 => ({
        version: 1,
        id: `purchases:return:${correction.eventId}`,
        source: 'PURCHASES',
        kind: 'RETURN_CORRECTION',
        sourceReference: correction.eventId,
        sourceContextReference: correction.returnId,
        contractReference: null,
        title: 'اصلاح مالی مرجوعی خرید',
        partyDisplaySnapshot: null,
        description: correction.reason,
        amount: null,
        settlement: null,
        status: 'UNDER_REVIEW',
        dueAt: null,
        createdAt: correction.returnedAt,
        requesterDisplaySnapshot: null,
        branchReference: correction.branchId,
        sourceVersion: correction.sourceVersion,
        origin: 'PERSISTED_SOURCE',
      })),
    ].sort((left, right) => {
      const due = (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999');
      return due || right.createdAt.localeCompare(left.createdAt);
    });

    const sources: FinanceInboxSourceStateV1[] = [
      this.sourceState(
        'SALES',
        salesResult.status === 'fulfilled',
        salesItems.length,
        'پرداخت‌های ثبت‌شده و منتظر تأیید مالی قراردادهای فروش',
      ),
      this.sourceState(
        'HR',
        hrResult.status === 'fulfilled',
        hrItems.length +
          payrollRows.filter((row) =>
            ['PAYROLL', 'PAYROLL_WORKSHEET'].includes(row.kind),
          ).length,
        'ارجاع‌های ثبت‌شده منابع انسانی به واحد مالی',
      ),
      this.sourceState(
        'RESERVATIONS',
        reservationsResult.status === 'fulfilled',
        reservationItems.length,
        'خرید خدمات رزرواسیون که نیازمند رسیدگی مالی هستند',
      ),
      {
        source: 'PURCHASES',
        connection:
          ticketResult.status === 'fulfilled' &&
          invoiceResult.status === 'fulfilled' &&
          correctionResult.status === 'fulfilled'
            ? 'CONNECTED'
            : 'UNAVAILABLE',
        itemCount:
          ticketItems.length + invoiceItems.length + correctionItems.length,
        message:
          ticketResult.status === 'fulfilled' &&
          invoiceResult.status === 'fulfilled' &&
          correctionResult.status === 'fulfilled'
            ? 'قیمت خرید بلیط، فاکتورهای تطبیق‌شده و اصلاحات مالی مرجوعی خرید'
            : 'یکی از منابع خرید در این لحظه پاسخ نداد.',
      },
    ];
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      items: this.purchaseFx
        ? await this.purchaseFx.enrich(items, actor)
        : items,
      sources: [
        ...sources,
        {
          source: 'FINANCE',
          connection: 'CONNECTED',
          itemCount: payrollRows.filter(
            (row) => !['PAYROLL', 'PAYROLL_WORKSHEET'].includes(row.kind),
          ).length,
          message:
            'درخواست‌های استرداد، کمیسیون، چک، اصلاح مالی و تنخواه با رویداد حسابداری قابل پیگیری',
        },
      ],
    };
  }

  purchaseFxQuote(currency: string, actor: AuthenticatedActor) {
    if (
      !actor.branchIds.length ||
      !actor.permissions.some((p) =>
        [
          'finance.read',
          'procurement.quote.manage',
          'reservations.hotel_purchase.write',
        ].includes(p),
      )
    )
      throw new ForbiddenException();
    return this.purchaseFx?.quote(currency) ?? null;
  }
  async capturePurchaseFx(
    referenceId: string,
    rateToIrr: string,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('finance.payment.create'))
      throw new ForbiddenException();
    const inbox = await this.list(actor);
    const item = inbox.items.find(
      (i) =>
        i.reservationPurchase?.lines.some(
          (p) => p.purchaseId === referenceId,
        ) ||
        (i.ticketPurchase && i.sourceContextReference === referenceId) ||
        (i.id.startsWith('purchases:invoice:') &&
          i.sourceReference === referenceId),
    );
    if (!item || !this.purchaseFx)
      throw new NotFoundException('خرید ارزی مجاز یافت نشد.');
    if (!actor.branchIds.includes(item.branchReference))
      throw new ForbiddenException();
    const line = item.reservationPurchase?.lines.find(
      (p) => p.purchaseId === referenceId,
    );
    const amount = line?.amount ?? item.amount?.amount;
    const currencyCode = line?.currencyCode ?? item.amount?.currencyCode;
    if (!amount || !currencyCode || currencyCode === 'IRR')
      throw new BadRequestException('ارز خرید معتبر نیست.');
    return this.database.client.$transaction(async (tx) => {
      let invoiceRevisionId: string | undefined;
      if (item.id.startsWith('purchases:invoice:')) {
        const revision = await tx.financeProcurementInvoiceRevision.findFirst({
          where: {
            sourceId: referenceId,
            sourceVersion: item.sourceVersion,
            branchId: item.branchReference,
          },
          orderBy: { version: 'asc' },
        });
        if (!revision)
          throw new BadRequestException('ابتدا خرید را تأیید کنید.');
        invoiceRevisionId = revision.id;
      }
      return this.purchaseFx!.capture(tx, {
        ...(line
          ? { reservationPurchaseId: referenceId }
          : item.ticketPurchase
            ? { ticketCostId: referenceId }
            : { invoiceRevisionId: invoiceRevisionId! }),
        branchId: item.branchReference,
        actorUserId: actor.userId,
        currencyCode,
        amount,
        rateToIrr,
        baselineAt: new Date(item.createdAt),
      });
    });
  }

  async listSettlementAccounts(
    actor: AuthenticatedActor,
  ): Promise<readonly FinanceSettlementAccountV1[]> {
    const rows = await this.database.client.financeSettlementAccount.findMany({
      where: { branchId: { in: [...actor.branchIds] }, isActive: true },
      include: { bank: { select: { name: true } } },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ({
      version: row.version,
      id: row.id,
      branchId: row.branchId,
      title: row.title,
      kind: row.kind as FinanceSettlementAccountV1['kind'],
      currencyCode: row.currencyCode,
      bankId: row.bankId,
      bankName: row.bank?.name ?? null,
      maskedIdentifier: row.maskedIdentifier,
      isActive: row.isActive,
    }));
  }

  async listPaymentMethods(
    actor: AuthenticatedActor,
    direction: 'PAYMENT' | 'RECEIPT' = 'PAYMENT',
  ) {
    if (!actor.permissions.includes('finance.payment.create'))
      throw new ForbiddenException('مجوز ثبت پرداخت وجود ندارد.');
    return this.database.client.masterPaymentMethod.findMany({
      where: { isActive: true, direction: { in: [direction, 'BOTH'] } },
      select: { id: true, name: true, channel: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listBanks(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.account.manage'))
      throw new ForbiddenException('مجوز مدیریت حساب مالی وجود ندارد.');
    return this.database.client.masterBank.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createSettlementAccount(
    input: FinanceSettlementAccountCreateV1,
    actor: AuthenticatedActor,
  ): Promise<FinanceSettlementAccountV1> {
    const kind = input?.kind;
    const currencyCode = input?.currencyCode?.trim().toUpperCase();
    if (
      input?.version !== 1 ||
      !actor.branchIds.includes(input.branchId) ||
      !input.title?.trim() ||
      input.title.trim().length > 160 ||
      !['BANK', 'CASH', 'POS', 'GATEWAY'].includes(kind) ||
      !/^[A-Z]{3}$/.test(currencyCode) ||
      (input.maskedIdentifier?.trim().length ?? 0) > 80 ||
      (kind === 'BANK' && !input.bankId)
    )
      throw new BadRequestException('اطلاعات حساب مالی معتبر نیست.');
    if (input.bankId) {
      const bank = await this.database.client.masterBank.findFirst({
        where: { id: input.bankId, isActive: true },
      });
      if (!bank) throw new BadRequestException('بانک انتخاب‌شده معتبر نیست.');
    }
    const row = await this.database.client.financeSettlementAccount.create({
      data: {
        branchId: input.branchId,
        title: input.title.trim(),
        kind,
        currencyCode,
        bankId: input.bankId || null,
        maskedIdentifier: input.maskedIdentifier?.trim() || null,
        createdByUserId: actor.userId,
      },
      include: { bank: { select: { name: true } } },
    });
    return {
      version: row.version,
      id: row.id,
      branchId: row.branchId,
      title: row.title,
      kind: row.kind as FinanceSettlementAccountV1['kind'],
      currencyCode: row.currencyCode,
      bankId: row.bankId,
      bankName: row.bank?.name ?? null,
      maskedIdentifier: row.maskedIdentifier,
      isActive: row.isActive,
    };
  }

  async customerDocumentDeliveryQueue(
    contractNumber: string | undefined,
    actor: AuthenticatedActor,
  ): Promise<readonly FinanceCustomerDocumentDeliveryCandidateV1[]> {
    if (!actor.permissions.includes('finance.financial_release.read'))
      throw new ForbiddenException('مجوز مشاهده مجوز تحویل مدارک وجود ندارد.');
    const candidates =
      await this.sales.financeCustomerDocumentDeliveryCandidates(
        actor,
        contractNumber,
      );
    return Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        canApproveReservationDelivery: actor.permissions.includes(
          'reservations.documents.manage',
        ),
        delivery: await this.delivery.readCustomerContract(
          candidate.contractId,
        ),
      })),
    );
  }

  async reservationDocumentDelivery(
    contractId: string,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException('مجوز صدور رزرواسیون لازم است.');
    await this.sales.financeCustomerDocumentDeliveryFacts(
      contractId,
      actor.branchIds,
    );
    return this.delivery.readCustomerContract(contractId);
  }
  async decideReservationDocumentDelivery(
    contractId: string,
    input: FinanceCustomerDocumentDeliveryCommandV1,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('reservations.documents.manage'))
      throw new ForbiddenException('مجوز صدور رزرواسیون لازم است.');
    if (input?.basis !== 'RESERVATION_PERMISSION')
      throw new BadRequestException('مبنای مجوز رزرواسیون معتبر نیست.');
    const facts = await this.sales.financeCustomerDocumentDeliveryFacts(
      contractId,
      actor.branchIds,
    );
    return this.delivery.updateCustomerContract(input, facts, actor, (tx) =>
      this.sales.financeCustomerDocumentDeliveryFacts(
        contractId,
        actor.branchIds,
        tx,
      ),
    );
  }
  async decideCustomerDocumentDelivery(
    contractId: string,
    input: FinanceCustomerDocumentDeliveryCommandV1,
    actor: AuthenticatedActor,
  ) {
    if (!actor.permissions.includes('finance.financial_release.approve'))
      throw new ForbiddenException('مجوز صدور تحویل مدارک وجود ندارد.');
    const facts = await this.sales.financeCustomerDocumentDeliveryFacts(
      contractId,
      actor.branchIds,
    );
    return this.delivery.updateCustomerContract(input, facts, actor, (tx) =>
      this.sales.financeCustomerDocumentDeliveryFacts(
        contractId,
        actor.branchIds,
        tx,
      ),
    );
  }
  async decideReceipt(
    paymentId: string,
    input: FinanceReceiptDecisionCommandV1,
    actor: AuthenticatedActor,
  ) {
    const reason = input?.reason?.trim() ?? '';
    if (
      input?.version !== 1 ||
      !input.contractId ||
      !['APPROVE', 'CORRECTION_REQUIRED'].includes(input.action) ||
      (reason ?? '').length > 500 ||
      (input.action === 'CORRECTION_REQUIRED' &&
        !isOptionalOperationReason(reason))
    )
      throw new BadRequestException('تصمیم مالی معتبر نیست.');
    if (!actor.permissions.includes('finance.receipt.approve'))
      throw new ForbiddenException('مجوز تأیید دریافت لازم است.');
    const receipt = await this.sales.financeReceipt(
      paymentId,
      input.contractId,
      actor,
    );
    if (!receipt)
      throw new NotFoundException('درخواست دریافت در شعب مجاز یافت نشد.');
    if (
      input.action === 'APPROVE' &&
      receipt.destinationAccountId &&
      input.accountId &&
      input.accountId !== receipt.destinationAccountId
    )
      throw new BadRequestException(
        'حساب مقصد ثبت‌شده در پرداخت قابل تغییر نیست.',
      );
    const receiptAccountId = receipt.destinationAccountId ?? input.accountId;
    if (receipt.status === 'FINANCE_CONFIRMED') {
      if (
        input.action !== 'APPROVE' ||
        receipt.financeReceiptAccountId !== receiptAccountId
      )
        throw new ConflictException(
          'دریافت قبلاً تأیید شده است؛ اصلاح از مسیر استرداد انجام می‌شود.',
        );
      if (!input.documentDelivery?.approved)
        return { status: 'RECEIPT_CONFIRMED' as const };
      const facts = await this.sales.financeCustomerDocumentDeliveryFacts(
        input.contractId,
        actor.branchIds,
      );
      const current = await this.delivery.readCustomerContract(
        input.contractId,
      );
      const documentDelivery = await this.delivery.updateCustomerContract(
        {
          ...input.documentDelivery,
          expectedVersion:
            input.documentDelivery.expectedVersion ?? current.version,
        },
        facts,
        actor,
        (tx) =>
          this.sales.financeCustomerDocumentDeliveryFacts(
            input.contractId,
            actor.branchIds,
            tx,
          ),
      );
      return { status: 'RECEIPT_CONFIRMED' as const, documentDelivery };
    }
    if (
      receipt.status !== 'PENDING_FINANCE_CONFIRMATION' &&
      !(receipt.status === 'SCHEDULED' && receipt.dueAt <= new Date())
    )
      throw new ConflictException('دریافت در وضعیت بررسی مالی نیست.');
    const payment = { ...receipt, branchId: receipt.contract.branchId };
    if (input.action === 'APPROVE') {
      if (!receiptAccountId)
        throw new BadRequestException('حساب مقصد دریافت را انتخاب کنید.');
      const account =
        await this.database.client.financeSettlementAccount.findFirst({
          where: {
            id: receiptAccountId,
            branchId: payment.branchId,
            currencyCode: payment.currencyCode,
            isActive: true,
          },
          select: { id: true },
        });
      if (!account)
        throw new BadRequestException(
          'حساب مقصد فعال و هم‌ارز با پرداخت نیست.',
        );
      const eventId = randomUUID();
      const result = await this.sales.applyFinancePaymentConfirmed({
        version: 1,
        eventId,
        contractId: input.contractId,
        paymentId,
        financePaymentReference: `FIN-RCPT-${eventId}`,
        receiptAccountId: account.id,
        confirmedAt: new Date().toISOString(),
        reviewedByUserId: actor.userId,
        reason,
      });
      if (result === 'not-found')
        throw new NotFoundException('پرداخت یافت نشد.');
      let documentDelivery = null;
      if (input.documentDelivery?.approved) {
        const current = await this.delivery.readCustomerContract(
          input.contractId,
        );
        const facts = await this.sales.financeCustomerDocumentDeliveryFacts(
          input.contractId,
          actor.branchIds,
        );
        documentDelivery = await this.delivery.updateCustomerContract(
          {
            ...input.documentDelivery,
            expectedVersion:
              input.documentDelivery.expectedVersion ?? current.version,
          },
          facts,
          actor,
          (tx) =>
            this.sales.financeCustomerDocumentDeliveryFacts(
              input.contractId,
              actor.branchIds,
              tx,
            ),
        );
      }
      return {
        status: 'RECEIPT_CONFIRMED' as const,
        ...(documentDelivery ? { documentDelivery } : {}),
      };
    }
    const result = await this.sales.applyFinancePaymentCorrection({
      contractId: input.contractId,
      paymentId,
      reason,
      reviewedByUserId: actor.userId,
      branchId: payment.branchId,
    });
    if (result === 'not-found') throw new NotFoundException('پرداخت یافت نشد.');
    if (result === 'conflict')
      throw new ConflictException('وضعیت پرداخت هم‌زمان تغییر کرده است.');
    return { status: 'CORRECTION_REQUIRED' as const };
  }

  supplierPayment(
    intakeId: string,
    purchaseId: string,
    input: FinanceSupplierPaymentCommandV1,
    actor: AuthenticatedActor,
  ) {
    return this.delivery.updateSupplierPayment(
      intakeId,
      purchaseId,
      input,
      actor.userId,
      actor.branchIds,
    );
  }

  async decideProcurementInvoice(
    sourceId: string,
    input: FinanceProcurementInvoiceDecisionCommandV1,
    actor: AuthenticatedActor,
  ) {
    const reason = input?.reason?.trim() ?? '';
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      !['APPROVE', 'CORRECTION_REQUIRED'].includes(input.action) ||
      (reason ?? '').length > 500 ||
      (input.action === 'CORRECTION_REQUIRED' &&
        !isOptionalOperationReason(reason))
    )
      throw new BadRequestException('تصمیم فاکتور خرید معتبر نیست.');
    const source = await this.procurement.financeInvoiceSource(
      sourceId,
      actor.branchIds,
    );
    if (!source)
      throw new NotFoundException('فاکتور خرید در کارتابل مالی یافت نشد.');
    if (
      input.expectedSourceVersion !== undefined &&
      input.expectedSourceVersion !== source.sourceVersion
    )
      throw new ConflictException(
        'نسخه فاکتور خرید تغییر کرده است؛ کارتابل را به‌روز کنید.',
      );
    try {
      return await this.database.client.$transaction(async (tx) => {
        const current = await tx.financeProcurementInvoiceRevision.findFirst({
          where: { sourceId },
          orderBy: { version: 'desc' },
        });
        if ((current?.version ?? 0) !== input.expectedVersion)
          throw new ConflictException('وضعیت مالی هم‌زمان تغییر کرده است.');
        if (
          current &&
          (current.sourceVersion === source.sourceVersion ||
            current.status !== 'CORRECTION_REQUIRED' ||
            !current.cumulativePaid.isZero())
        )
          throw new ConflictException('فاکتور خرید قبلاً بررسی شده است.');
        const status =
          input.action === 'APPROVE' ? 'APPROVED' : 'CORRECTION_REQUIRED';
        const row = await tx.financeProcurementInvoiceRevision.create({
          data: {
            sourceId,
            sourceVersion: source.sourceVersion,
            branchId: source.branchId,
            version: (current?.version ?? 0) + 1,
            status,
            cumulativePaid: 0,
            remainingAmount: source.amount,
            reason,
            actorUserId: actor.userId,
          },
        });
        if (input.action === 'APPROVE')
          await this.purchaseFx?.capture(tx, {
            invoiceRevisionId: row.id,
            branchId: source.branchId,
            actorUserId: actor.userId,
            currencyCode: source.currencyCode,
            amount: source.amount,
            baselineAt: new Date(source.handoffCreatedAt),
          });
        if (
          input.action === 'APPROVE' &&
          (await isNewAccountingSource(tx, new Date(source.handoffCreatedAt)))
        )
          await recordFinancialEvent(tx, {
            source: 'INVOICE',
            recordId: row.id,
            requestId: sourceId,
            kind: 'SUPPLIER_INVOICE_APPROVED',
            trackingDate: financialDate(new Date(source.handoffCreatedAt)),
            branchId: source.branchId,
            actorId: actor.userId,
            occurredAt: row.createdAt,
            amount: source.amount,
            currency: source.currencyCode,
            partyId: source.supplier.id,
          });
        const applied = await this.procurement.applyFinanceResult(
          {
            contract: 'finance.procurement-result.v1',
            sourceId,
            sourceVersion: source.sourceVersion,
            financeReference: row.id,
            status,
            financeVersion: row.version,
            cumulativePaid: '0',
            remainingAmount: row.remainingAmount.toString(),
            reason,
            occurredAt: row.createdAt.toISOString(),
          },
          tx,
        );
        if (applied !== 'applied')
          throw new ConflictException('وضعیت منبع خرید قابل تغییر نیست.');
        return {
          status,
          version: row.version,
          remainingAmount: row.remainingAmount.toString(),
        };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        ['P2002', 'P2034'].includes(String((error as { code?: string }).code))
      )
        throw new ConflictException('وضعیت مالی هم‌زمان تغییر کرده است.');
      throw error;
    }
  }

  async payProcurementInvoice(
    sourceId: string,
    input: FinanceProcurementInvoicePaymentCommandV1,
    actor: AuthenticatedActor,
  ) {
    const transferAt = new Date(input?.transferAt ?? '');
    const reason = input?.reason?.trim() ?? '';
    let paidAmount: DecimalValue;
    let exchangeRate: DecimalValue;
    try {
      paidAmount = DecimalValue.parse(input?.paidAmount ?? '');
      exchangeRate = DecimalValue.parse(input?.exchangeRateToIrr || '1');
    } catch {
      throw new BadRequestException('مبلغ یا نرخ ارز معتبر نیست.');
    }
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      (!input.accountId && !input.payingSupplierId) ||
      !input.paymentMethodId ||
      paidAmount.compare(DecimalValue.zero()) <= 0 ||
      exchangeRate.compare(DecimalValue.zero()) <= 0 ||
      Number.isNaN(transferAt.getTime()) ||
      (reason ?? '').length > 500 ||
      (input.paymentReference?.trim().length ?? 0) > 160
    )
      throw new BadRequestException('اطلاعات پرداخت فاکتور خرید معتبر نیست.');
    const source = await this.procurement.financeInvoiceSource(
      sourceId,
      actor.branchIds,
    );
    if (!source)
      throw new NotFoundException('فاکتور خرید در کارتابل مالی یافت نشد.');
    if (
      input.expectedSourceVersion !== undefined &&
      input.expectedSourceVersion !== source.sourceVersion
    )
      throw new ConflictException(
        'نسخه فاکتور خرید تغییر کرده است؛ کارتابل را به‌روز کنید.',
      );
    if (source.currencyCode !== 'IRR' && !input.exchangeRateToIrr)
      throw new BadRequestException('نرخ روز ارز برای پرداخت ارزی الزامی است.');
    try {
      return await this.database.client.$transaction(async (tx) => {
        const current = await tx.financeProcurementInvoiceRevision.findFirst({
          where: { sourceId },
          orderBy: { version: 'desc' },
        });
        if (
          !current ||
          !['APPROVED', 'PARTIALLY_PAID'].includes(current.status)
        )
          throw new ConflictException(
            'فاکتور خرید هنوز برای پرداخت تأیید نشده است.',
          );
        if (
          current.version !== input.expectedVersion ||
          current.sourceVersion !== source.sourceVersion
        )
          throw new ConflictException('وضعیت پرداخت هم‌زمان تغییر کرده است.');
        const { account, payingSupplierId, payingSupplierName } =
          await paymentSource(
            tx,
            this.supplierDirectory,
            input,
            source.currencyCode,
            source.branchId,
          );
        const method = await tx.masterPaymentMethod.findFirst({
          where: {
            id: input.paymentMethodId,
            isActive: true,
            direction: { in: ['PAYMENT', 'BOTH'] },
          },
        });
        if (!method)
          throw new BadRequestException('روش پرداخت انتخاب‌شده معتبر نیست.');
        const currentRemaining = DecimalValue.parse(
          current.remainingAmount.toString(),
        );
        if (paidAmount.compare(currentRemaining) > 0)
          throw new BadRequestException(
            'مبلغ پرداخت از مانده فاکتور بیشتر است.',
          );
        const cumulativePaid = DecimalValue.parse(
          current.cumulativePaid.toString(),
        ).add(paidAmount);
        const remainingAmount = currentRemaining.subtract(paidAmount);
        const status = remainingAmount.isZero ? 'PAID' : 'PARTIALLY_PAID';
        const row = await tx.financeProcurementInvoiceRevision.create({
          data: {
            sourceId,
            sourceVersion: source.sourceVersion,
            branchId: source.branchId,
            version: current.version + 1,
            status,
            accountId: account?.id ?? null,
            payingSupplierId,
            payingSupplierName,
            paymentCurrencyCode: source.currencyCode,
            paymentMethodId: method.id,
            paidAmount: paidAmount.toString(),
            exchangeRateToIrr: exchangeRate.toString(),
            rialEquivalent: paidAmount.multiply(exchangeRate).toString(),
            cumulativePaid: cumulativePaid.toString(),
            remainingAmount: remainingAmount.toString(),
            transferAt,
            paymentReference: input.paymentReference?.trim() || null,
            reason,
            actorUserId: actor.userId,
          },
        });
        await recordFinancialEvent(tx, {
          source: 'INVOICE',
          recordId: row.id,
          requestId: sourceId,
          kind: 'SUPPLIER_PAYMENT',
          trackingDate: financialDate(new Date(source.handoffCreatedAt)),
          branchId: source.branchId,
          actorId: actor.userId,
          occurredAt: transferAt,
          amount: paidAmount.toString(),
          currency: source.currencyCode,
          settlementAccountId: account?.id ?? null,
          partyId: `${source.supplier.id}:${payingSupplierId ?? ''}`,
          reference: row.paymentReference,
        });
        const applied = await this.procurement.applyFinanceResult(
          {
            contract: 'finance.procurement-result.v1',
            sourceId,
            sourceVersion: source.sourceVersion,
            financeReference: row.id,
            status,
            financeVersion: row.version,
            cumulativePaid: cumulativePaid.toString(),
            remainingAmount: remainingAmount.toString(),
            reason,
            occurredAt: row.createdAt.toISOString(),
          },
          tx,
        );
        if (applied !== 'applied')
          throw new ConflictException('وضعیت منبع خرید قابل تغییر نیست.');
        return {
          status,
          version: row.version,
          paidAmount: cumulativePaid.toString(),
          remainingAmount: remainingAmount.toString(),
        };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        ['P2002', 'P2034'].includes(String((error as { code?: string }).code))
      )
        throw new ConflictException('وضعیت پرداخت هم‌زمان تغییر کرده است.');
      throw error;
    }
  }

  async decideProcurementCorrection(
    eventId: string,
    input: FinanceProcurementCorrectionDecisionCommandV1,
    actor: AuthenticatedActor,
  ) {
    const reason = input?.reason?.trim() ?? '';
    if (
      input?.version !== 1 ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      !['APPROVE', 'CORRECTION_REQUIRED'].includes(input.action) ||
      (reason ?? '').length > 500 ||
      (input.action === 'CORRECTION_REQUIRED' &&
        !isOptionalOperationReason(reason))
    )
      throw new BadRequestException('تصمیم اصلاح مالی مرجوعی معتبر نیست.');
    const status =
      input.action === 'APPROVE' ? 'APPROVED' : 'CORRECTION_REQUIRED';
    const result = await this.procurement.applyFinanceCorrectionResult(
      {
        contract: 'finance.procurement-correction-result.v1',
        eventId,
        sourceVersion: input.expectedVersion,
        financeReference: randomUUID(),
        status,
        reason,
        actorUserId: actor.userId,
        occurredAt: new Date().toISOString(),
      },
      actor.branchIds,
    );
    if (result === 'not-found')
      throw new NotFoundException('اصلاح مالی مرجوعی در کارتابل یافت نشد.');
    if (result === 'conflict')
      throw new ConflictException('اصلاح مالی مرجوعی قبلاً بررسی شده است.');
    return { status };
  }

  private sourceState(
    source: 'SALES' | 'HR' | 'RESERVATIONS',
    connected: boolean,
    itemCount: number,
    message: string,
  ): FinanceInboxSourceStateV1 {
    return {
      source,
      connection: connected ? 'CONNECTED' : 'UNAVAILABLE',
      itemCount,
      message: connected
        ? message
        : 'منبع در این لحظه پاسخ نداد یا مجوز آن موجود نیست.',
    };
  }
}
