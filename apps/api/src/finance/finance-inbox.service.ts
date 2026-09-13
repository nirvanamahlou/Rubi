import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceInboxItemV1,
  FinanceInboxSourceStateV1,
  FinanceInboxV1,
  FinanceRequestStatus,
  HrConnectionStatus,
} from '@rubi/contracts';

import { HrConnectionsService } from '../hr/hr-connections.service';
import { SalesService } from '../sales/sales.service';

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
  ) {}

  async list(actor: AuthenticatedActor): Promise<FinanceInboxV1> {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException({
        code: 'FINANCE_INBOX_FORBIDDEN',
        message: 'مجوز مشاهده کارتابل مالی وجود ندارد.',
      });

    const [salesResult, hrResult] = await Promise.allSettled([
      this.sales.financeInbox(actor),
      this.hr.list({ target: 'finance', page: 1 }, actor),
    ]);
    const salesItems =
      salesResult.status === 'fulfilled' ? salesResult.value : [];
    const hrItems = hrResult.status === 'fulfilled' ? hrResult.value.items : [];

    const items: FinanceInboxItemV1[] = [
      ...salesItems.map((item): FinanceInboxItemV1 => ({
        version: 1,
        id: `sales:${item.paymentId}`,
        source: 'SALES',
        kind: 'RECEIPT_VERIFICATION',
        sourceReference: item.paymentId,
        contractReference: item.contractNumber,
        title: `تأیید دریافت قرارداد ${item.contractNumber}`,
        partyDisplaySnapshot: item.customerNameSnapshot,
        description:
          item.description?.trim() || 'پرداخت ثبت‌شده در قرارداد فروش',
        amount: {
          amount: item.amount,
          currencyCode: item.currencyCode,
        },
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
        contractReference: null,
        title: item.title,
        partyDisplaySnapshot: item.employeeLabel,
        description: item.message,
        amount: null,
        status: hrStatus[item.status],
        dueAt: item.dueAt,
        createdAt: item.createdAt,
        requesterDisplaySnapshot: null,
        branchReference: item.branchId,
        sourceVersion: item.version,
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
      {
        source: 'RESERVATIONS',
        connection: 'NOT_CONNECTED',
        itemCount: 0,
        message:
          'Producer استاندارد درخواست پرداخت رزرواسیون هنوز منتشر نشده است.',
      },
      {
        source: 'PURCHASES',
        connection: 'NOT_CONNECTED',
        itemCount: 0,
        message: 'Producer استاندارد درخواست پرداخت خرید هنوز منتشر نشده است.',
      },
    ];
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      items,
      sources,
    };
  }

  private sourceState(
    source: 'SALES' | 'HR',
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
