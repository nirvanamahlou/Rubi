import type {
  FinanceWorkspaceGroup,
  FinanceWorkspaceQuery,
} from '../api/contracts';

export interface FinanceFeature {
  id: number;
  title: string;
  description: string;
  group: FinanceWorkspaceGroup;
  keywords: readonly string[];
  primaryAction: string;
  permission: string;
}

export const financeGroupLabels: Readonly<
  Record<FinanceWorkspaceGroup, string>
> = {
  ledger: 'دفاتر و کدینگ',
  treasury: 'خزانه، بانک و چک',
  'sales-purchase': 'فروش، خرید و مانده‌ها',
  'travel-settlement': 'تسویه و سود سفر',
  planning: 'برنامه‌ریزی و پایان دوره',
  reporting: 'گزارش و خروجی',
};

export const financeFeatures: readonly FinanceFeature[] = [
  {
    id: 1,
    title: 'کدینگ و ساختار حساب‌ها',
    description: 'ساختار کل، معین و تفصیلی versioned برای هر شخصیت حقوقی',
    group: 'ledger',
    keywords: ['حساب', 'کدینگ', 'درخت'],
    primaryAction: 'تعریف حساب',
    permission: 'finance.journal.read',
  },
  {
    id: 2,
    title: 'اسناد حسابداری',
    description: 'فهرست سند، وضعیت، منبع و گردش تایید',
    group: 'ledger',
    keywords: ['سند', 'journal'],
    primaryAction: 'مشاهده اسناد',
    permission: 'finance.journal.read',
  },
  {
    id: 3,
    title: 'ثبت سند حسابداری جدید',
    description: 'پیش‌نویس دوطرفه با کنترل توازن و Maker/Checker',
    group: 'ledger',
    keywords: ['ثبت', 'بدهکار', 'بستانکار'],
    primaryAction: 'سند جدید',
    permission: 'finance.journal.create',
  },
  {
    id: 4,
    title: 'دفتر کل',
    description: 'گردش و مانده محاسباتی حساب‌های کل',
    group: 'ledger',
    keywords: ['دفتر کل', 'مانده'],
    primaryAction: 'مشاهده دفتر',
    permission: 'finance.journal.read',
  },
  {
    id: 5,
    title: 'دفتر معین',
    description: 'گردش حساب‌های معین با drill-down',
    group: 'ledger',
    keywords: ['معین', 'گردش'],
    primaryAction: 'مشاهده معین',
    permission: 'finance.journal.read',
  },
  {
    id: 6,
    title: 'دفتر تفصیلی',
    description: 'تفصیلی شناور طرف‌حساب، قرارداد و خدمت',
    group: 'ledger',
    keywords: ['تفصیلی', 'طرف حساب'],
    primaryAction: 'مشاهده تفصیلی',
    permission: 'finance.journal.read',
  },
  {
    id: 7,
    title: 'مراکز هزینه و پروژه‌ها',
    description: 'ابعاد هزینه، پروژه، تور، مسیر و خدمت',
    group: 'ledger',
    keywords: ['مرکز هزینه', 'پروژه', 'تور'],
    primaryAction: 'تعریف بُعد',
    permission: 'finance.journal.create',
  },
  {
    id: 8,
    title: 'اشخاص و طرف‌حساب‌ها',
    description: 'Party Account مبتنی بر Public Reference بدون کپی PII',
    group: 'ledger',
    keywords: ['شخص', 'مشتری', 'تامین کننده'],
    primaryAction: 'مشاهده حساب',
    permission: 'finance.read',
  },
  {
    id: 9,
    title: 'بانک‌ها، حساب‌های بانکی و صندوق‌ها',
    description: 'چند حساب و صندوق با مانده حاصل از دفتر',
    group: 'treasury',
    keywords: ['بانک', 'صندوق', 'حساب'],
    primaryAction: 'مشاهده خزانه',
    permission: 'finance.read',
  },
  {
    id: 10,
    title: 'دریافت‌ها',
    description: 'نقد، کارت، حواله، درگاه، چک، اعتبار و ترکیبی',
    group: 'treasury',
    keywords: ['دریافت', 'وصول'],
    primaryAction: 'دریافت جدید',
    permission: 'finance.receipt.create',
  },
  {
    id: 11,
    title: 'پرداخت‌ها',
    description: 'پرداخت کنترل‌شده با Maker/Checker و allocation',
    group: 'treasury',
    keywords: ['پرداخت', 'خروج وجه'],
    primaryAction: 'پرداخت جدید',
    permission: 'finance.payment.create',
  },
  {
    id: 12,
    title: 'انتقال وجه بین بانک و صندوق',
    description: 'انتقال دوطرفه با کارمزد و حساب مبدا/مقصد',
    group: 'treasury',
    keywords: ['انتقال', 'بانک', 'صندوق'],
    primaryAction: 'انتقال جدید',
    permission: 'finance.payment.create',
  },
  {
    id: 13,
    title: 'مدیریت چک‌های دریافتی و پرداختی',
    description: 'سررسید، واگذاری، وصول، برگشت، ابطال و یادآوری',
    group: 'treasury',
    keywords: ['چک', 'صیاد', 'سررسید'],
    primaryAction: 'چک جدید',
    permission: 'finance.check.manage',
  },
  {
    id: 14,
    title: 'تنخواه‌گردان',
    description: 'تنخواه، اسناد هزینه و تسویه مسئول',
    group: 'treasury',
    keywords: ['تنخواه', 'هزینه'],
    primaryAction: 'تنخواه جدید',
    permission: 'finance.payment.create',
  },
  {
    id: 15,
    title: 'فاکتور فروش',
    description: 'فاکتور خدمات قرارداد با snapshot تجاری',
    group: 'sales-purchase',
    keywords: ['فاکتور فروش', 'قرارداد'],
    primaryAction: 'فاکتور فروش',
    permission: 'finance.journal.create',
  },
  {
    id: 16,
    title: 'فاکتور خرید',
    description: 'فاکتور خرید approved از قرارداد عمومی Procurement',
    group: 'sales-purchase',
    keywords: ['فاکتور خرید', 'تامین کننده'],
    primaryAction: 'مشاهده خرید',
    permission: 'finance.journal.read',
  },
  {
    id: 17,
    title: 'حساب‌های دریافتنی',
    description: 'اصل، مانده باز، سررسید و وضعیت مطالبات',
    group: 'sales-purchase',
    keywords: ['دریافتنی', 'مطالبات'],
    primaryAction: 'مشاهده مطالبات',
    permission: 'finance.read',
  },
  {
    id: 18,
    title: 'حساب‌های پرداختنی',
    description: 'بدهی تاییدشده به تامین‌کننده و سررسید',
    group: 'sales-purchase',
    keywords: ['پرداختنی', 'بدهی'],
    primaryAction: 'مشاهده بدهی',
    permission: 'finance.read',
  },
  {
    id: 19,
    title: 'تسویه تأمین‌کنندگان، ایرلاین‌ها، هتل‌ها، DMCها و کارگزاران',
    description: 'تسویه خرید خدمت بر پایه net purchase approved',
    group: 'travel-settlement',
    keywords: ['تامین کننده', 'ایرلاین', 'هتل', 'DMC', 'کارگزار'],
    primaryAction: 'تسویه تامین‌کننده',
    permission: 'finance.settlement.manage',
  },
  {
    id: 20,
    title: 'تسویه آژانس‌ها و مشتریان سازمانی',
    description: 'صورت‌حساب، اعتبار و تخصیص وصول سازمانی',
    group: 'travel-settlement',
    keywords: ['آژانس', 'سازمانی', 'B2B'],
    primaryAction: 'تسویه سازمانی',
    permission: 'finance.settlement.manage',
  },
  {
    id: 21,
    title: 'اعتبار، Deposit و سقف اعتبار',
    description: 'Exposure و Deposit با reference سیاست مصوب',
    group: 'travel-settlement',
    keywords: ['اعتبار', 'deposit', 'سقف'],
    primaryAction: 'مشاهده اعتبار',
    permission: 'finance.read',
  },
  {
    id: 22,
    title: 'ارزها و نرخ ارز',
    description: 'Draft/Approved، منبع، زمان اعتبار و تاییدکننده',
    group: 'travel-settlement',
    keywords: ['ارز', 'نرخ', 'FX'],
    primaryAction: 'نرخ‌های Preview',
    permission: 'finance.exchange_rate.read',
  },
  {
    id: 23,
    title: 'تسعیر ارز',
    description: 'پیشنهاد محاسبه با snapshot نرخ و rounding policy',
    group: 'travel-settlement',
    keywords: ['تسعیر', 'ارز'],
    primaryAction: 'پیش‌نمایش تسعیر',
    permission: 'finance.exchange_rate.read',
  },
  {
    id: 24,
    title: 'هزینه‌ها',
    description: 'هزینه پرواز، هتل، ترانسفر، بیمه، ویزا و سایر',
    group: 'travel-settlement',
    keywords: ['هزینه', 'پرواز', 'هتل', 'بیمه', 'ویزا'],
    primaryAction: 'هزینه جدید',
    permission: 'finance.journal.create',
  },
  {
    id: 25,
    title: 'درآمدهای متفرقه',
    description: 'درآمد خارج قرارداد با rule و تایید جدا',
    group: 'travel-settlement',
    keywords: ['درآمد', 'متفرقه'],
    primaryAction: 'درآمد جدید',
    permission: 'finance.journal.create',
  },
  {
    id: 26,
    title: 'دارایی‌های ثابت',
    description: 'Foundation دارایی، بهای تمام‌شده و استهلاک پیشنهادی',
    group: 'planning',
    keywords: ['دارایی', 'استهلاک'],
    primaryAction: 'دارایی جدید',
    permission: 'finance.journal.create',
  },
  {
    id: 27,
    title: 'بودجه‌بندی',
    description: 'بودجه حساب، مرکز هزینه و پروژه در دوره مالی',
    group: 'planning',
    keywords: ['بودجه', 'برنامه'],
    primaryAction: 'بودجه جدید',
    permission: 'finance.journal.create',
  },
  {
    id: 28,
    title: 'سال و دوره‌های مالی',
    description: 'دوره باز، بسته نرم و بسته قطعی برای هر شرکت',
    group: 'planning',
    keywords: ['سال مالی', 'دوره'],
    primaryAction: 'مدیریت دوره',
    permission: 'finance.journal.approve',
  },
  {
    id: 29,
    title: 'بستن حساب‌ها و عملیات پایان دوره',
    description: 'Checklist، مغایرت‌ها و سند اختتامیه پیشنهادی',
    group: 'planning',
    keywords: ['بستن', 'پایان دوره', 'اختتامیه'],
    primaryAction: 'بررسی بستن',
    permission: 'finance.journal.approve',
  },
  {
    id: 30,
    title: 'گزارش‌های مالی',
    description: 'دفاتر، مانده، سود قرارداد و خروجی permission-aware',
    group: 'reporting',
    keywords: ['گزارش', 'Excel', 'PDF', 'سود'],
    primaryAction: 'گزارش جدید',
    permission: 'finance.export',
  },
];

export interface FinancePreviewRecord {
  id: string;
  kind: 'RECEIPT' | 'PAYMENT' | 'CHECK' | 'INVOICE' | 'JOURNAL' | 'RELEASE';
  title: string;
  party: string;
  contractReference: string;
  amount: string;
  currencyCode: 'IRR' | 'USD' | 'EUR' | 'TRY' | 'AED';
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'CONDITIONAL' | 'BLOCKED';
  branch: string;
  fiscalPeriod: string;
  dueAt: string;
  updatedAt: string;
}

export const financePreviewRecords: readonly FinancePreviewRecord[] = [
  {
    id: 'preview-fin-001',
    kind: 'RECEIPT',
    title: 'دریافت ترکیبی نمونه A',
    party: 'طرف‌حساب ساختگی ۰۱',
    contractReference: 'preview-contract-001',
    amount: '125000000',
    currencyCode: 'IRR',
    status: 'APPROVED',
    branch: 'شعبه نمونه مرکزی',
    fiscalPeriod: 'دوره نمونه ۱۴۰۵-۰۱',
    dueAt: '2026-08-24T12:00:00.000Z',
    updatedAt: '2026-08-24T10:00:00.000Z',
  },
  {
    id: 'preview-fin-002',
    kind: 'PAYMENT',
    title: 'پرداخت کارگزار نمونه B',
    party: 'کارگزار ساختگی ۰۲',
    contractReference: 'preview-contract-002',
    amount: '4200.50',
    currencyCode: 'EUR',
    status: 'PENDING_APPROVAL',
    branch: 'شعبه نمونه مرکزی',
    fiscalPeriod: 'دوره نمونه ۱۴۰۵-۰۱',
    dueAt: '2026-08-26T12:00:00.000Z',
    updatedAt: '2026-08-24T09:20:00.000Z',
  },
  {
    id: 'preview-fin-003',
    kind: 'CHECK',
    title: 'چک دریافتی نمونه C',
    party: 'طرف‌حساب ساختگی ۰۳',
    contractReference: 'preview-contract-003',
    amount: '98000000',
    currencyCode: 'IRR',
    status: 'CONDITIONAL',
    branch: 'شعبه نمونه غرب',
    fiscalPeriod: 'دوره نمونه ۱۴۰۵-۰۱',
    dueAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-23T15:00:00.000Z',
  },
  {
    id: 'preview-fin-004',
    kind: 'INVOICE',
    title: 'فاکتور فروش نمونه D',
    party: 'سازمان ساختگی ۰۴',
    contractReference: 'preview-contract-004',
    amount: '8700',
    currencyCode: 'USD',
    status: 'DRAFT',
    branch: 'شعبه نمونه غرب',
    fiscalPeriod: 'دوره نمونه ۱۴۰۵-۰۱',
    dueAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-08-23T13:00:00.000Z',
  },
  {
    id: 'preview-fin-005',
    kind: 'JOURNAL',
    title: 'سند دوطرفه نمونه E',
    party: 'طرف‌حساب ساختگی ۰۵',
    contractReference: 'preview-contract-005',
    amount: '64000000',
    currencyCode: 'IRR',
    status: 'APPROVED',
    branch: 'شعبه نمونه مرکزی',
    fiscalPeriod: 'دوره نمونه ۱۴۰۵-۰۱',
    dueAt: '2026-08-24T16:00:00.000Z',
    updatedAt: '2026-08-24T11:00:00.000Z',
  },
  {
    id: 'preview-fin-006',
    kind: 'RELEASE',
    title: 'آزادسازی مالی نمونه F',
    party: 'طرف‌حساب ساختگی ۰۶',
    contractReference: 'preview-contract-006',
    amount: '210000000',
    currencyCode: 'IRR',
    status: 'BLOCKED',
    branch: 'شعبه نمونه مرکزی',
    fiscalPeriod: 'دوره نمونه ۱۴۰۵-۰۱',
    dueAt: '2026-08-24T18:00:00.000Z',
    updatedAt: '2026-08-24T11:30:00.000Z',
  },
];

export interface FinancePreviewDraft {
  title: string;
  partyReference: string;
  contractReference: string;
  amount: string;
  currencyCode: 'IRR' | 'USD' | 'EUR' | 'TRY' | 'AED';
  description: string;
  expectedVersion: string;
  idempotencyKey: string;
}

export function validateFinancePreviewDraft(draft: FinancePreviewDraft) {
  const errors: Partial<Record<keyof FinancePreviewDraft, string>> = {};
  if (draft.title.trim().length < 3)
    errors.title = 'عنوان حداقل سه نویسه لازم دارد.';
  if (!/^preview-[a-z0-9-]{3,80}$/.test(draft.partyReference))
    errors.partyReference =
      'فقط Public Reference ساختگی با پیشوند preview- مجاز است.';
  if (
    draft.contractReference &&
    !/^preview-[a-z0-9-]{3,80}$/.test(draft.contractReference)
  )
    errors.contractReference = 'Contract Reference باید synthetic باشد.';
  if (
    !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(draft.amount) ||
    draft.amount === '0'
  )
    errors.amount = 'مبلغ باید Decimal مثبت و بدون جداکننده باشد.';
  if (draft.description.trim().length < 10)
    errors.description = 'شرح و دلیل حداقل ده نویسه لازم دارد.';
  if (!/^[1-9]\d*$/.test(draft.expectedVersion))
    errors.expectedVersion = 'نسخه مورد انتظار باید عدد صحیح مثبت باشد.';
  if (!/^finance:[a-z0-9:_-]{12,120}$/.test(draft.idempotencyKey))
    errors.idempotencyKey = 'کلید idempotency معتبر و synthetic لازم است.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function filterFinanceFeatures(
  query: Pick<FinanceWorkspaceQuery, 'search' | 'group'>,
): readonly FinanceFeature[] {
  const needle = query.search.toLocaleLowerCase('fa-IR');
  return financeFeatures.filter((feature) => {
    const haystack =
      `${feature.title} ${feature.description} ${feature.keywords.join(' ')}`.toLocaleLowerCase(
        'fa-IR',
      );
    return (
      (query.group === 'ALL' || feature.group === query.group) &&
      (!needle || haystack.includes(needle))
    );
  });
}

const statusRank: Readonly<Record<FinancePreviewRecord['status'], number>> = {
  BLOCKED: 1,
  DRAFT: 2,
  PENDING_APPROVAL: 3,
  CONDITIONAL: 4,
  APPROVED: 5,
};

export function filterFinanceRecords(
  records: readonly FinancePreviewRecord[],
  query: FinanceWorkspaceQuery,
): readonly FinancePreviewRecord[] {
  const needle = `${query.search} ${query.partyReference}`
    .trim()
    .toLocaleLowerCase('fa-IR');
  const filtered = records.filter((record) => {
    const haystack =
      `${record.title} ${record.party} ${record.contractReference}`.toLocaleLowerCase(
        'fa-IR',
      );
    return (
      (!needle || haystack.includes(needle)) &&
      (query.branchReference === 'ALL' ||
        record.branch === query.branchReference) &&
      (query.fiscalPeriodReference === 'ALL' ||
        record.fiscalPeriod === query.fiscalPeriodReference) &&
      (query.currencyCode === 'ALL' ||
        record.currencyCode === query.currencyCode) &&
      (query.status === 'ALL' || record.status === query.status)
    );
  });
  return [...filtered].sort((left, right) => {
    const direction = query.sortDirection === 'asc' ? 1 : -1;
    if (query.sortBy === 'status')
      return (statusRank[left.status] - statusRank[right.status]) * direction;
    if (query.sortBy === 'dueAt')
      return left.dueAt.localeCompare(right.dueAt) * direction;
    if (query.sortBy === 'amount')
      return left.amount.length === right.amount.length
        ? left.amount.localeCompare(right.amount) * direction
        : (left.amount.length - right.amount.length) * direction;
    return left.updatedAt.localeCompare(right.updatedAt) * direction;
  });
}

export function paginateFinanceRecords<T>(
  records: readonly T[],
  page: number,
  pageSize: number,
): readonly T[] {
  return records.slice((page - 1) * pageSize, page * pageSize);
}
