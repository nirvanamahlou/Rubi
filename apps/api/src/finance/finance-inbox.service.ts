import { randomUUID } from 'node:crypto';
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
  FinanceInboxItemV1,
  FinanceInboxSourceStateV1,
  FinanceInboxV1,
  FinanceRequestStatus,
  FinanceReceiptDecisionCommandV1,
  FinanceSettlementAccountCreateV1,
  FinanceSettlementAccountV1,
  FinanceSupplierPaymentCommandV1,
  HrConnectionStatus,
} from '@nora/contracts';

import { HrConnectionsService } from '../hr/hr-connections.service';
import { DatabaseService } from '../database/database.service';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import { SalesService } from '../sales/sales.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';
import { FinanceDeliveryService } from './document-delivery/finance-delivery.module';

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
  ) {}

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
    ] = await Promise.allSettled([
      this.sales.financeInbox(actor),
      this.hr.list({ target: 'finance', page: 1 }, actor),
      this.reservations.list(actor.branchIds),
      this.procurement.listFinanceTicketPurchases(actor.branchIds),
      this.procurement.listFinanceInvoiceSources(actor.branchIds),
    ]);
    const salesItems =
      salesResult.status === 'fulfilled' ? salesResult.value : [];
    const hrItems = hrResult.status === 'fulfilled' ? hrResult.value.items : [];
    const reservationItems =
      reservationsResult.status === 'fulfilled'
        ? reservationsResult.value.flatMap((intake) =>
            (intake.servicePurchases ?? [])
              .filter(({ finance }) => finance.status !== 'PAID')
              .map((purchase) => ({ intake, purchase })),
          )
        : [];
    const ticketItems =
      ticketResult.status === 'fulfilled' ? ticketResult.value : [];
    const invoiceItems =
      invoiceResult.status === 'fulfilled' ? invoiceResult.value : [];

    const items: FinanceInboxItemV1[] = [
      ...salesItems.map((item): FinanceInboxItemV1 => ({
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
        dueAt: item.dueAt,
        createdAt: item.createdAt,
        requesterDisplaySnapshot: null,
        branchReference: item.branchId,
        sourceVersion: item.version,
        origin: 'PERSISTED_SOURCE',
      })),
      ...reservationItems.map(({ intake, purchase }): FinanceInboxItemV1 => ({
        version: 1,
        id: `reservations:${purchase.id}`,
        source: 'RESERVATIONS',
        kind: 'PAYMENT_REQUEST',
        sourceReference: purchase.id,
        sourceContextReference: intake.id,
        contractReference: intake.snapshot.contractNumber,
        title: `پرداخت ${purchase.serviceTitle}`,
        partyDisplaySnapshot: purchase.supplierName,
        description: `خرید خدمت ${purchase.serviceTitle} برای قرارداد ${intake.snapshot.contractNumber}`,
        amount: {
          amount: purchase.amount,
          currencyCode: purchase.currencyCode,
        },
        settlement: {
          paidAmount: purchase.finance.paidAmount,
          remainingAmount: purchase.finance.remainingAmount,
        },
        status:
          purchase.finance.status === 'REJECTED'
            ? 'CORRECTION_REQUIRED'
            : purchase.finance.status === 'PARTIALLY_PAID'
              ? 'PAYING'
              : 'READY_FOR_PAYMENT',
        dueAt: null,
        createdAt: purchase.createdAt,
        requesterDisplaySnapshot: null,
        branchReference: intake.branchId,
        sourceVersion: purchase.finance.version,
        origin: 'PERSISTED_SOURCE',
      })),
      ...ticketItems.map((purchase): FinanceInboxItemV1 => ({
        version: 1,
        id: 'purchases:' + purchase.id,
        source: 'PURCHASES',
        kind: 'PAYMENT_REQUEST',
        sourceReference: purchase.id,
        sourceContextReference: purchase.catalogProductReference,
        contractReference: null,
        title: 'خرید بلیط ' + purchase.title,
        partyDisplaySnapshot: purchase.supplierDisplaySnapshot,
        description: 'قیمت خرید بلیط برای تاریخ ' + purchase.serviceDate,
        amount: {
          amount: purchase.amount,
          currencyCode: purchase.currencyCode,
        },
        settlement: null,
        status: 'READY_FOR_PAYMENT',
        dueAt: purchase.serviceDate + 'T00:00:00.000Z',
        createdAt: purchase.createdAt,
        requesterDisplaySnapshot: null,
        branchReference: purchase.branchId,
        sourceVersion: purchase.requestVersion,
        origin: 'PERSISTED_SOURCE',
      })),
      ...invoiceItems.map((invoice): FinanceInboxItemV1 => ({
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
        settlement: null,
        status: 'UNDER_REVIEW',
        dueAt: invoice.dueAt,
        createdAt: invoice.handoffCreatedAt,
        requesterDisplaySnapshot: null,
        branchReference: invoice.branchId,
        sourceVersion: invoice.sourceVersion,
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
        hrItems.length,
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
          invoiceResult.status === 'fulfilled'
            ? 'CONNECTED'
            : 'UNAVAILABLE',
        itemCount: ticketItems.length + invoiceItems.length,
        message:
          ticketResult.status === 'fulfilled' &&
          invoiceResult.status === 'fulfilled'
            ? 'قیمت خرید بلیط و فاکتورهای عمومی تطبیق‌شدهٔ منتظر بررسی مالی'
            : 'یکی از منابع خرید در این لحظه پاسخ نداد.',
      },
    ];
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      items,
      sources,
    };
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

  async listPaymentMethods(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.payment.create'))
      throw new ForbiddenException('مجوز ثبت پرداخت وجود ندارد.');
    return this.database.client.masterPaymentMethod.findMany({
      where: { isActive: true, direction: { in: ['PAYMENT', 'BOTH'] } },
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
      reason.length > 500 ||
      (input.action === 'CORRECTION_REQUIRED' && !reason)
    )
      throw new BadRequestException('تصمیم مالی معتبر نیست.');
    const pending = await this.sales.financeInbox(actor);
    const payment = pending.find(
      (item) =>
        item.paymentId === paymentId && item.contractId === input.contractId,
    );
    if (!payment)
      throw new NotFoundException('درخواست دریافت در صف مالی یافت نشد.');
    if (input.action === 'APPROVE') {
      const eventId = randomUUID();
      const result = await this.sales.applyFinancePaymentConfirmed({
        version: 1,
        eventId,
        contractId: input.contractId,
        paymentId,
        financePaymentReference: `FIN-RCPT-${eventId}`,
        confirmedAt: new Date().toISOString(),
        reviewedByUserId: actor.userId,
        reason,
      });
      if (result === 'not-found')
        throw new NotFoundException('پرداخت یافت نشد.');
      return { status: 'RECEIPT_CONFIRMED' as const };
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
