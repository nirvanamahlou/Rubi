export type FinanceSection = 'accounting' | 'inbox';
export type InboxRequestKind = 'RECEIPT_VERIFICATION' | 'PAYMENT_REQUEST';
export type InboxRequestStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'READY_FOR_PAYMENT'
  | 'PAID'
  | 'REJECTED'
  | 'REQUIRES_MANUAL_REVIEW';

export interface AccountTreeItem {
  id: string;
  code: string;
  title: string;
  level: 'GROUP' | 'GENERAL' | 'SUBSIDIARY' | 'DETAIL';
  nature: 'DEBIT' | 'CREDIT';
  parentId: string | null;
  postingAllowed: boolean;
  balance: string;
  currencyCode: 'IRR' | 'USD' | 'EUR';
  active: boolean;
}

export const accountTreePreview: readonly AccountTreeItem[] = [
  {
    id: 'a-1',
    code: '1',
    title: 'دارایی‌ها',
    level: 'GROUP',
    nature: 'DEBIT',
    parentId: null,
    postingAllowed: false,
    balance: '0',
    currencyCode: 'IRR',
    active: true,
  },
  {
    id: 'a-11',
    code: '11',
    title: 'دارایی‌های جاری',
    level: 'GENERAL',
    nature: 'DEBIT',
    parentId: 'a-1',
    postingAllowed: false,
    balance: '0',
    currencyCode: 'IRR',
    active: true,
  },
  {
    id: 'a-1101',
    code: '1101',
    title: 'بانک‌ها',
    level: 'SUBSIDIARY',
    nature: 'DEBIT',
    parentId: 'a-11',
    postingAllowed: false,
    balance: '0',
    currencyCode: 'IRR',
    active: true,
  },
  {
    id: 'a-110101',
    code: '110101',
    title: 'بانک ریالی نمونه',
    level: 'DETAIL',
    nature: 'DEBIT',
    parentId: 'a-1101',
    postingAllowed: true,
    balance: '0',
    currencyCode: 'IRR',
    active: true,
  },
  {
    id: 'a-1102',
    code: '1102',
    title: 'صندوق‌ها',
    level: 'SUBSIDIARY',
    nature: 'DEBIT',
    parentId: 'a-11',
    postingAllowed: false,
    balance: '0',
    currencyCode: 'IRR',
    active: true,
  },
  {
    id: 'a-2',
    code: '2',
    title: 'بدهی‌ها',
    level: 'GROUP',
    nature: 'CREDIT',
    parentId: null,
    postingAllowed: false,
    balance: '0',
    currencyCode: 'IRR',
    active: true,
  },
];

export interface FinanceInboxPreviewRequest {
  id: string;
  requestNumber: string;
  kind: InboxRequestKind;
  sourceModule: 'SALES' | 'RESERVATIONS' | 'PROCUREMENT' | 'HR';
  sourceReference: string;
  contractReference: string;
  partySnapshot: string;
  amount: string;
  currencyCode: 'IRR' | 'USD' | 'EUR';
  rialEquivalent: string;
  dueAt: string;
  requesterSnapshot: string;
  status: InboxRequestStatus;
  branchSnapshot: string;
  version: number;
}

export const financeInboxPreviewRequests: readonly FinanceInboxPreviewRequest[] =
  [
    {
      id: 'preview-request-001',
      requestNumber: 'FR-1405-0001',
      kind: 'RECEIPT_VERIFICATION',
      sourceModule: 'SALES',
      sourceReference: 'preview-sales-contract-001',
      contractReference: 'CNT-PREVIEW-001',
      partySnapshot: 'مشتری نمونه الف',
      amount: '125000000',
      currencyCode: 'IRR',
      rialEquivalent: '125000000',
      dueAt: '2026-09-12T12:00:00.000Z',
      requesterSnapshot: 'کانتر فروش نمونه',
      status: 'NEW',
      branchSnapshot: 'شعبه مرکزی',
      version: 1,
    },
    {
      id: 'preview-request-002',
      requestNumber: 'FP-1405-0002',
      kind: 'PAYMENT_REQUEST',
      sourceModule: 'RESERVATIONS',
      sourceReference: 'preview-reservation-002',
      contractReference: 'CNT-PREVIEW-002',
      partySnapshot: 'کارگزار نمونه ب',
      amount: '4200.50',
      currencyCode: 'EUR',
      rialEquivalent: '294035000',
      dueAt: '2026-09-13T09:00:00.000Z',
      requesterSnapshot: 'عملیات رزرواسیون نمونه',
      status: 'READY_FOR_PAYMENT',
      branchSnapshot: 'شعبه مرکزی',
      version: 3,
    },
    {
      id: 'preview-request-003',
      requestNumber: 'FP-1405-0003',
      kind: 'PAYMENT_REQUEST',
      sourceModule: 'PROCUREMENT',
      sourceReference: 'preview-purchase-003',
      contractReference: 'CNT-PREVIEW-003',
      partySnapshot: 'هتل نمونه ج',
      amount: '870',
      currencyCode: 'USD',
      rialEquivalent: '60813000',
      dueAt: '2026-09-10T08:00:00.000Z',
      requesterSnapshot: 'خرید نمونه',
      status: 'CORRECTION_REQUIRED',
      branchSnapshot: 'شعبه غرب',
      version: 2,
    },
  ];

export interface FinanceActionDraft {
  accountReference: string;
  partyReference: string;
  actualAmount: string;
  currencyCode: string;
  occurredAt: string;
  trackingReference: string;
  feeAmount: string;
  note: string;
  evidenceReviewed: boolean;
  idempotencyKey: string;
  expectedVersion: string;
}

export function validateFinanceActionDraft(
  kind: InboxRequestKind,
  draft: FinanceActionDraft,
): readonly string[] {
  const errors: string[] = [];
  if (!draft.accountReference.trim())
    errors.push(
      kind === 'RECEIPT_VERIFICATION'
        ? 'انتخاب حساب مقصد الزامی است.'
        : 'انتخاب حساب مبدأ الزامی است.',
    );
  if (kind === 'PAYMENT_REQUEST' && !draft.partyReference.trim())
    errors.push('طرف‌حساب معتبر برای پرداخت الزامی است.');
  if (
    !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(draft.actualAmount) ||
    draft.actualAmount === '0'
  )
    errors.push('مبلغ واقعی باید Decimal مثبت باشد.');
  if (!draft.currencyCode.trim()) errors.push('ارز الزامی است.');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(draft.occurredAt)
  )
    errors.push('تاریخ و ساعت باید UTC باشد.');
  if (!draft.evidenceReviewed) errors.push('بررسی فایل رسید باید تأیید شود.');
  if (draft.note.trim().length < 10)
    errors.push('توضیح مالی حداقل ده نویسه لازم دارد.');
  if (!/^finance:[a-z0-9:_-]{12,120}$/.test(draft.idempotencyKey))
    errors.push('Idempotency Key معتبر لازم است.');
  if (!/^[1-9]\d*$/.test(draft.expectedVersion))
    errors.push('Version معتبر لازم است.');
  return errors;
}

export function validateFinanceDecision(reason: string): string | null {
  return reason.trim().length >= 10
    ? null
    : 'دلیل رد یا درخواست اصلاح حداقل ده نویسه لازم دارد.';
}
