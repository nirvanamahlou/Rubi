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
    id: 'a-110102',
    code: '110102',
    title: 'بانک ارزی یورو نمونه',
    level: 'DETAIL',
    nature: 'DEBIT',
    parentId: 'a-1101',
    postingAllowed: true,
    balance: '0',
    currencyCode: 'EUR',
    active: true,
  },
  {
    id: 'a-110103',
    code: '110103',
    title: 'بانک ارزی دلار نمونه',
    level: 'DETAIL',
    nature: 'DEBIT',
    parentId: 'a-1101',
    postingAllowed: true,
    balance: '0',
    currencyCode: 'USD',
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
    id: 'a-110201',
    code: '110201',
    title: 'صندوق مرکزی نمونه',
    level: 'DETAIL',
    nature: 'DEBIT',
    parentId: 'a-1102',
    postingAllowed: true,
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
  contractTitle: string;
  partyReference: string;
  partySnapshot: string;
  partyRoleSnapshot: string;
  serviceSnapshot: string;
  amount: string;
  contractAmount: string;
  previouslySettledAmount: string;
  outstandingAmount: string;
  previousPayments: readonly {
    reference: string;
    amount: string;
    exchangeRateToIrr: string;
    rialEquivalent: string;
    occurredAt: string;
  }[];
  documentSnapshots: readonly FinanceDocumentSnapshot[];
  currencyCode: 'IRR' | 'USD' | 'EUR';
  suggestedExchangeRateToIrr: string;
  rialEquivalent: string;
  dueAt: string;
  requesterSnapshot: string;
  status: InboxRequestStatus;
  branchSnapshot: string;
  version: number;
}

export interface FinanceDocumentSnapshot {
  reference: string;
  fileName: string;
  kind: 'RECEIPT' | 'PAYMENT_PROOF' | 'INVOICE';
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeLabel: string;
  uploadedAt: string;
  scanStatus: 'CLEAN' | 'PENDING_SCAN';
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
      contractTitle: 'قرارداد تور آنتالیا خانواده احمدی',
      partyReference: 'customer:preview-001',
      partySnapshot: 'مشتری نمونه الف',
      partyRoleSnapshot: 'پرداخت‌کننده قرارداد',
      serviceSnapshot: 'تور آنتالیا ۶ شب',
      amount: '125000000',
      contractAmount: '850000000',
      previouslySettledAmount: '300000000',
      outstandingAmount: '550000000',
      previousPayments: [
        {
          reference: 'RC-1405-0182',
          amount: '300000000',
          exchangeRateToIrr: '1',
          rialEquivalent: '300000000',
          occurredAt: '2026-08-30T08:20:00.000Z',
        },
      ],
      documentSnapshots: [
        {
          reference: 'document:preview-receipt-001',
          fileName: 'فیش-واریز-قرارداد-آنتالیا.pdf',
          kind: 'RECEIPT',
          mimeType: 'application/pdf',
          sizeLabel: '۲۴۸ کیلوبایت',
          uploadedAt: '2026-09-12T09:42:00.000Z',
          scanStatus: 'CLEAN',
        },
      ],
      currencyCode: 'IRR',
      suggestedExchangeRateToIrr: '1',
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
      contractTitle: 'قرارداد گروهی نمایشگاه استانبول',
      partyReference: 'supplier:preview-002',
      partySnapshot: 'کارگزار نمونه ب',
      partyRoleSnapshot: 'کارگزار اجرای پرواز و هتل',
      serviceSnapshot: 'پرواز و اقامت استانبول',
      amount: '4200.50',
      contractAmount: '5200.50',
      previouslySettledAmount: '1000',
      outstandingAmount: '4200.50',
      previousPayments: [
        {
          reference: 'PY-1405-0071',
          amount: '1000',
          exchangeRateToIrr: '69000',
          rialEquivalent: '69000000',
          occurredAt: '2026-09-01T09:15:00.000Z',
        },
      ],
      documentSnapshots: [
        {
          reference: 'document:preview-invoice-002',
          fileName: 'پیش‌فاکتور-کارگزار-استانبول.pdf',
          kind: 'INVOICE',
          mimeType: 'application/pdf',
          sizeLabel: '۳۱۲ کیلوبایت',
          uploadedAt: '2026-09-11T15:30:00.000Z',
          scanStatus: 'CLEAN',
        },
      ],
      currencyCode: 'EUR',
      suggestedExchangeRateToIrr: '70000',
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
      contractTitle: 'قرارداد اقامت گروه فروش شیراز',
      partyReference: 'supplier:preview-003',
      partySnapshot: 'هتل نمونه ج',
      partyRoleSnapshot: 'تأمین‌کننده اقامت',
      serviceSnapshot: 'اقامت هتل شیراز',
      amount: '870',
      contractAmount: '1070',
      previouslySettledAmount: '200',
      outstandingAmount: '870',
      previousPayments: [
        {
          reference: 'PY-1405-0064',
          amount: '200',
          exchangeRateToIrr: '68500',
          rialEquivalent: '13700000',
          occurredAt: '2026-08-28T11:00:00.000Z',
        },
      ],
      documentSnapshots: [],
      currencyCode: 'USD',
      suggestedExchangeRateToIrr: '69900',
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
  exchangeRateToIrr: string;
  occurredAt: string;
  trackingReference: string;
  feeAmount: string;
  note: string;
  evidenceReviewed: boolean;
  idempotencyKey: string;
  expectedVersion: string;
  paymentParts: readonly FinancePaymentPartDraft[];
}

export interface FinancePaymentPartDraft {
  id: string;
  amount: string;
  trackingReference: string;
  method: FinancePaymentMethod | '';
}

export const financePaymentMethods = [
  { value: 'BANK_TRANSFER', label: 'حواله بانکی' },
  { value: 'CHECK', label: 'چک' },
  { value: 'CASH', label: 'نقد' },
  { value: 'POS', label: 'کارت‌خوان (POS)' },
  { value: 'CARD_TO_CARD', label: 'کارت‌به‌کارت' },
  { value: 'DIRECT_DEBIT', label: 'برداشت مستقیم' },
  { value: 'OTHER', label: 'سایر' },
] as const;

export type FinancePaymentMethod =
  (typeof financePaymentMethods)[number]['value'];

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

function decimalUnits(value: string): bigint | null {
  if (!DECIMAL_PATTERN.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(`${whole}${fraction.padEnd(18, '0')}`);
}

function unitsToDecimal(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const padded = absolute.toString().padStart(19, '0');
  const whole = padded.slice(0, -18);
  const fraction = padded.slice(-18).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function sumDecimalAmounts(values: readonly string[]): string | null {
  let total = 0n;
  for (const value of values) {
    const units = decimalUnits(value);
    if (units === null) return null;
    total += units;
  }
  return unitsToDecimal(total);
}

export function multiplyDecimalAmounts(
  amount: string,
  multiplier: string,
): string | null {
  const amountUnits = decimalUnits(amount);
  const multiplierUnits = decimalUnits(multiplier);
  if (amountUnits === null || multiplierUnits === null) return null;
  return unitsToDecimal((amountUnits * multiplierUnits) / 10n ** 18n);
}

export function remainingAfterAmount(
  outstandingAmount: string,
  settlementAmount: string,
): string | null {
  const outstanding = decimalUnits(outstandingAmount);
  const settlement = decimalUnits(settlementAmount);
  if (outstanding === null || settlement === null || settlement > outstanding)
    return null;
  return unitsToDecimal(outstanding - settlement);
}

export function validateFinanceActionDraft(
  kind: InboxRequestKind,
  draft: FinanceActionDraft,
  outstandingAmount?: string,
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
  const paymentTotal = sumDecimalAmounts(
    draft.paymentParts.map((part) => part.amount),
  );
  const settlementAmount =
    kind === 'PAYMENT_REQUEST' ? paymentTotal : draft.actualAmount;
  if (
    kind === 'PAYMENT_REQUEST' &&
    (draft.paymentParts.length === 0 ||
      draft.paymentParts.some(
        (part) => !DECIMAL_PATTERN.test(part.amount) || part.amount === '0',
      ))
  )
    errors.push('حداقل یک ردیف پرداخت با مبلغ Decimal مثبت لازم است.');
  if (
    kind === 'PAYMENT_REQUEST' &&
    draft.paymentParts.some((part) => !part.method)
  )
    errors.push('روش هر ردیف پرداخت باید مشخص شود.');
  if (
    kind === 'PAYMENT_REQUEST' &&
    draft.paymentParts.some(
      (part) => part.method === 'CHECK' && !part.trackingReference.trim(),
    )
  )
    errors.push('برای پرداخت با چک، شماره چک الزامی است.');
  if (
    kind === 'RECEIPT_VERIFICATION' &&
    (!DECIMAL_PATTERN.test(draft.actualAmount) || draft.actualAmount === '0')
  )
    errors.push('مبلغ واقعی دریافت باید Decimal مثبت باشد.');
  if (
    outstandingAmount &&
    settlementAmount &&
    remainingAfterAmount(outstandingAmount, settlementAmount) === null
  )
    errors.push('جمع مبلغ از مانده قرارداد بیشتر است.');
  if (!DECIMAL_PATTERN.test(draft.feeAmount))
    errors.push('کارمزد باید مبلغ Decimal نامنفی باشد.');
  if (!draft.currencyCode.trim()) errors.push('ارز الزامی است.');
  if (
    draft.currencyCode !== 'IRR' &&
    (!DECIMAL_PATTERN.test(draft.exchangeRateToIrr) ||
      draft.exchangeRateToIrr === '0')
  )
    errors.push('نرخ روز هر واحد ارز به ریال الزامی است.');
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(draft.occurredAt)
  )
    errors.push('تاریخ و ساعت باید UTC باشد.');
  if (!draft.evidenceReviewed) errors.push('بررسی فایل رسید باید تأیید شود.');
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
