import { accountingTaxForms } from '@nora/contracts';
import { taxpayerPages } from '../accounting-taxpayer-catalog';
import { accountingParitySource1 } from './accounting-parity-source-1';
import { accountingParitySource2 } from './accounting-parity-source-2';
import { accountingParitySource3 } from './accounting-parity-source-3';
import { accountingParitySource4 } from './accounting-parity-source-4';

export type AccountingParitySupport =
  'supported' | 'dependency' | 'source-error';
export type AccountingParityImplementation =
  | 'coding-standard'
  | 'standard-mapping'
  | 'standard-report'
  | 'configuration'
  | 'ledger'
  | 'accounts'
  | 'details'
  | 'account-groups'
  | 'detail-groups'
  | 'mapping'
  | 'detail-conversion'
  | 'journal-edit'
  | 'journal-review'
  | 'journal-posting'
  | 'journal-deleted'
  | 'numbering'
  | 'move-drafts'
  | 'automatic-run'
  | 'revaluation'
  | 'year-end-closing'
  | 'year-end-opening'
  | 'year-end-final'
  | 'year-end-nature-adjustment'
  | 'statement-list'
  | 'trial-balance'
  | 'turnover-report'
  | 'analytical-report'
  | 'chart-report'
  | 'journal-line-report'
  | 'journal-browser-report'
  | 'electronic-book-report'
  | 'tax-reference'
  | 'taxpayer-seller'
  | 'tax-settings'
  | 'configuration-list'
  | 'journal-list'
  | 'template-list'
  | 'evidence-only';
export interface AccountingParityField {
  label: string;
  type: 'text' | 'date' | 'checkbox' | 'radio' | 'textarea' | 'password';
  disabled: boolean;
  sourceControlId?: string;
}
export interface AccountingParityCapture {
  route: string;
  title: string;
  sourcePath: string;
  sourcePage: string;
  evidenceStatus: 'observed-layout' | 'menu-only' | 'source-error';
  fields: AccountingParityField[];
  columns: string[];
  actions: string[];
  blocker?: string;
  stage: string;
}
export interface AccountingParityDefinition {
  route: string;
  title: string;
  sourcePath: string;
  sourcePages: string[];
  evidenceStatus: 'observed-layout' | 'menu-only' | 'source-error';
  fields: AccountingParityField[];
  columns: string[];
  actions: string[];
  blockers: string[];
  stages: string[];
  support: AccountingParitySupport;
  implementation: AccountingParityImplementation;
}

const implementationByRoute: Readonly<
  Record<string, AccountingParityImplementation>
> = {
  'general-ledger/reports/legal-reports/standards': 'coding-standard',
  'general-ledger/reports/legal-reports/mappings': 'standard-mapping',
  'general-ledger/reports/legal-reports/report': 'standard-report',
  'general-ledger/reports/legal-reports/lists/standards': 'configuration-list',
  'general-ledger/base-information/fiscal-years': 'configuration',
  'general-ledger/base-information/ledgers': 'ledger',
  'general-ledger/base-information/voucher-types': 'configuration',
  'general-ledger/accounts/chart': 'accounts',
  'general-ledger/accounts/detail-types': 'configuration',
  'general-ledger/accounts/details': 'details',
  'general-ledger/accounts/account-groups': 'account-groups',
  'general-ledger/accounts/detail-groups': 'detail-groups',
  'general-ledger/accounts/mappings': 'mapping',
  'general-ledger/accounts/detail-type-converter': 'detail-conversion',
  'general-ledger/documents/journals': 'journal-edit',
  'general-ledger/documents/revaluation': 'revaluation',
  'general-ledger/documents/revaluation-templates': 'template-list',
  'general-ledger/documents/automatic-templates': 'template-list',
  'general-ledger/documents/numbering': 'numbering',
  'general-ledger/documents/move': 'move-drafts',
  'general-ledger/documents/deleted': 'journal-deleted',
  'general-ledger/documents/posting': 'journal-posting',
  'general-ledger/documents/automatic-runs': 'evidence-only',
  'general-ledger/documents/review': 'journal-review',
  'general-ledger/year-end/closing': 'year-end-closing',
  'general-ledger/year-end/closing-templates': 'template-list',
  'general-ledger/year-end/opening': 'year-end-opening',
  'general-ledger/year-end/final': 'year-end-final',
  'general-ledger/year-end/nature-adjustment': 'year-end-nature-adjustment',
  'general-ledger/reports/journal-browser': 'journal-browser-report',
  'general-ledger/reports/electronic-trade-books': 'electronic-book-report',
  'general-ledger/reports/debit-credit-notices': 'statement-list',
  'general-ledger/reports/account-browser': 'turnover-report',
  'general-ledger/reports/trial-balance': 'trial-balance',
  'general-ledger/reports/dormant-accounts': 'analytical-report',
  'general-ledger/reports/nature-conflict-period': 'analytical-report',
  'general-ledger/reports/nature-conflict-range': 'analytical-report',
  'general-ledger/reports/comparative': 'analytical-report',
  'taxpayer-system/settings': 'tax-settings',
  'taxpayer-system/seller-information': 'taxpayer-seller',
  'general-ledger/reports/chart-structure': 'chart-report',
  'general-ledger/reports/journal-lines': 'journal-line-report',
  'tax-accounting/base-information/quarterly-thresholds': 'tax-reference',
  'tax-accounting/base-information/lists/quarterly-thresholds': 'tax-reference',
  'tax-accounting/vat/tax-periods': 'tax-reference',
  'tax-accounting/vat/lists/tax-periods': 'tax-reference',
  'tax-accounting/vat/aggregation-methods': 'tax-reference',
  'tax-accounting/vat/lists/aggregation-methods': 'tax-reference',
  'general-ledger/base-information/lists/fiscal-years': 'configuration-list',
  'general-ledger/base-information/lists/ledgers': 'configuration-list',
  'general-ledger/base-information/lists/voucher-types': 'configuration-list',
  'general-ledger/accounts/lists/detail-types': 'configuration-list',
  'general-ledger/accounts/lists/details': 'configuration-list',
  'general-ledger/accounts/lists/detail-type-converters': 'configuration-list',
  'general-ledger/documents/lists/journals': 'journal-list',
  'general-ledger/documents/lists/revaluations': 'evidence-only',
  'general-ledger/documents/lists/gl-vouchers': 'evidence-only',
  'general-ledger/documents/lists/automatic-templates': 'template-list',
  'general-ledger/documents/lists/revaluation-templates': 'template-list',
  'general-ledger/year-end/lists/closing-templates': 'template-list',
};

const menuOnly = (
  route: string,
  title: string,
  parentPath: string,
  sourceMenuKey: string,
  blocker?: string,
): AccountingParityCapture => ({
  route,
  title,
  sourcePath: `${parentPath} / ${title}`,
  sourcePage: `menu-search:${sourceMenuKey}`,
  evidenceStatus: 'menu-only',
  fields: [],
  columns: [],
  actions: [],
  ...(blocker ? { blocker } : {}),
  stage: title,
});

const menuOnlyCaptures: readonly AccountingParityCapture[] = [
  menuOnly(
    'general-ledger/base-information/lists/fiscal-years',
    'دوره مالی',
    'مالی / دفتر کل / اطلاعات پایه / فهرست ها',
    'Financial.GL.BasicData.Lists.FiscalYearList',
  ),
  menuOnly(
    'general-ledger/base-information/lists/ledgers',
    'دفتر کل',
    'مالی / دفتر کل / اطلاعات پایه / فهرست ها',
    'Financial.GL.BasicData.Lists.LedgerList',
  ),
  menuOnly(
    'general-ledger/base-information/lists/voucher-types',
    'نوع سند',
    'مالی / دفتر کل / اطلاعات پایه / فهرست ها',
    'Financial.GL.BasicData.Lists.VoucherTypeList',
  ),
  menuOnly(
    'general-ledger/accounts/lists/detail-types',
    'نوع تفصیلی',
    'مالی / دفتر کل / حساب ها / فهرست ها',
    'Financial.GL.COAManagement.Lists.DLTypeList',
  ),
  menuOnly(
    'general-ledger/accounts/lists/details',
    'حساب تفصیلی',
    'مالی / دفتر کل / حساب ها / فهرست ها',
    'Financial.GL.COAManagement.Lists.DLList',
  ),
  menuOnly(
    'general-ledger/accounts/lists/detail-type-converters',
    'مبدل نوع تفصیل',
    'مالی / دفتر کل / حساب ها / فهرست ها',
    'Financial.GL.COAManagement.Lists.DLTypeConversionList',
  ),
  menuOnly(
    'general-ledger/documents/lists/journals',
    'سند حسابداری',
    'مالی / دفتر کل / اسناد / فهرست ها',
    'Financial.GL.VoucherManagement.Lists.VoucherList',
  ),
  menuOnly(
    'general-ledger/documents/lists/gl-vouchers',
    'سند کل',
    'مالی / دفتر کل / اسناد / فهرست ها',
    'Financial.GL.VoucherManagement.Lists.GLVoucherList',
    'فهرست مستقل، فیلتر، خروجی، گروه‌بندی و ویرایش تاریخ سند کل متصل‌اند؛ حذف و عملیات جانبی هنوز کامل نیستند',
  ),
  menuOnly(
    'general-ledger/documents/lists/revaluations',
    'تسعیر ارز',
    'مالی / دفتر کل / اسناد / فهرست ها',
    'Financial.GL.VoucherManagement.Lists.ConversionVoucherList',
    'فهرست شش‌ستونه و بازکردن سند متصل‌اند؛ تکمیل همه عملیات جانبی هنوز در حال انجام است',
  ),
  menuOnly(
    'general-ledger/documents/issue-gl-voucher',
    'صدور سند کل',
    'مالی / دفتر کل / اسناد',
    'Financial.GL.VoucherManagement.NewGLVoucher',
  ),
  menuOnly(
    'general-ledger/documents/lists/automatic-templates',
    'الگوی سند اتوماتیک',
    'مالی / دفتر کل / اسناد / فهرست ها',
    'Financial.GL.VoucherManagement.Lists.AutomaticVoucherPatternList',
  ),
  menuOnly(
    'general-ledger/documents/lists/revaluation-templates',
    'الگوی تسعیر ارز',
    'مالی / دفتر کل / اسناد / فهرست ها',
    'Financial.GL.VoucherManagement.Lists.ConversionPatternList',
  ),
  menuOnly(
    'general-ledger/year-end/lists/closing-templates',
    'الگوی بستن حساب',
    'مالی / دفتر کل / عملیات پایان سال / فهرست ها',
    'Financial.GL.YearClosingOperations.Lists.ClosingVoucherPatternList',
  ),
  menuOnly(
    'tax-accounting/base-information/lists/quarterly-thresholds',
    'حد نصاب تجمیع گزارش فصلی',
    'مالی / حسابداری مالیاتی / اطلاعات پایه / فهرست ها',
    'Financial.TaxAccounting.VATBasicInfo.Lists.TaxInformationList',
  ),
  menuOnly(
    'tax-accounting/vat/lists/tax-periods',
    'دوره مالیاتی',
    'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده / فهرست ها',
    'Financial.TaxAccounting.VAT.Lists.TaxYearList',
  ),
  menuOnly(
    'tax-accounting/vat/lists/taxpayer-identities',
    'اطلاعات هویتی مودی',
    'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده / فهرست ها',
    'Financial.TaxAccounting.VAT.Lists.VATBaseInformationList',
  ),
  menuOnly(
    'tax-accounting/vat/lists/aggregation-methods',
    'روش تجمیع اطلاعات گزارش خرید و فروش فصلی',
    'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده / فهرست ها',
    'Financial.TaxAccounting.VAT.Lists.MergePatternList',
  ),
  menuOnly(
    'tax-accounting/vat/lists/general-returns',
    'اظهارنامه عمومی',
    'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده / فهرست ها',
    'Financial.TaxAccounting.VAT.Lists.GeneralVATStatementList',
  ),
  menuOnly(
    'tax-accounting/vat/lists/pollution-returns',
    'اظهارنامه آلایندگی',
    'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده / فهرست ها',
    'Financial.TaxAccounting.VAT.Lists.ContaminationTollVATStatementList',
  ),
  menuOnly(
    'taxpayer-system/reports/bill-payment-information',
    'گزارش اطلاعات پرداخت صورتحسابهای مودیان',
    'مالی / ارتباط با سامانه مودیان مالیاتی / گزارش ها',
    'Financial.TaxPayer.TaxPayerReports.TaxPayerBillPaymentInformationReport',
  ),
];

const explicitGaps: readonly AccountingParityCapture[] = [
  {
    route: 'general-ledger/reports/legal-reports/lists/standards',
    title: 'کدینگ استاندارد',
    sourcePath:
      'مالی / دفتر کل / گزارش ها / گزارش های قانونی / فهرست ها / معرفی کدینگ استاندارد',
    sourcePage:
      'List.aspx?ComponentName=SystemGroup.Financial.CodingStandardManagement&EntityName=CodingStandard',
    evidenceStatus: 'observed-layout',
    fields: [],
    columns: [
      'عنوان کدینگ استاندارد',
      'عنوان لاتین کدینگ استاندارد',
      'عنوان پروتکل',
      'نسخه پروتکل',
      'استاندارد پیش فرض',
    ],
    actions: [
      'جدید',
      'ویرایش',
      'حذف',
      'بارگذاری مجدد',
      'فیلتر',
      'انتخاب چند رکورد',
      'محاسبه تعداد رکوردها',
      'چاپ',
      'ارسال به Excel',
    ],
    blocker: '',
    stage: 'فهرست کدینگ استاندارد',
  },
  {
    route: 'general-ledger/reports/legal-reports/standards',
    title: 'معرفی کدینگ استاندارد',
    sourcePath:
      'مالی / دفتر کل / گزارش ها / گزارش های قانونی / معرفی کدینگ استاندارد',
    sourcePage:
      'Financial/CodingStandardManagement/CodingStandardPages/EditView.view',
    evidenceStatus: 'observed-layout',
    fields: [
      'عنوان کدینگ استاندارد',
      'عنوان لاتین کدینگ استاندارد',
      'نسخه پروتکل',
    ].map((label) => ({ label, type: 'text', disabled: false })),
    columns: [
      'شماره قلم',
      'عنوان موجودیت استاندارد',
      'عنوان لاتین موجودیت استاندارد',
      'موجودیت سیستمی',
      'مرجع جزئیات',
      'عنوان فیلد',
      'مقدار فیلد',
      'شرح فیلد',
    ],
    actions: [
      'جدید',
      'باز کردن',
      'ذخیره',
      'عملیات کپی',
      'افزودن',
      'حذف',
      'جستجو',
    ],
    blocker:
      'درخت در فرم معرفی خالی دیده شد؛ کدهای استاندارد در فرم نگاشت قابل مشاهده‌اند. ویرایش کد از فرم معرفی هنوز مشاهده نشده است.',
    stage: 'اطلاعات اصلی و فیلدهای تکمیلی',
  },
  {
    route: 'general-ledger/reports/legal-reports',
    title: 'گزارش‌های قانونی',
    sourcePath: 'مالی / دفتر کل / گزارش ها / گزارش های قانونی',
    sourcePage: '',
    evidenceStatus: 'menu-only',
    fields: [],
    columns: [],
    actions: [],
    blocker:
      'زیرمنوی مستقل شامل معرفی کدینگ استاندارد، نگاشت کدهای استاندارد، گزارش کدینگ استاندارد، فرمول کدینگ استاندارد و صحت سنجی کنترل است؛ پیاده‌سازی این فرم‌ها هنوز کامل نشده است',
    stage: 'گزارش‌های قانونی',
  },
  {
    route: 'taxpayer-system/operations/batch-schedules',
    title: 'زمان‌بندی عملیات دسته‌جمعی',
    sourcePath:
      'مالی / ارتباط با سامانه مودیان مالیاتی / عملیات / زمانبندی عملیات دسته جمعی',
    sourcePage: '',
    evidenceStatus: 'menu-only',
    fields: [],
    columns: [],
    actions: [],
    blocker:
      'فقط فهرست زمان‌بندی مشاهده شد؛ اجرای عملیات تغییردهنده منبع عمداً انجام نشد',
    stage: 'زمان‌بندی عملیات دسته‌جمعی',
  },
  {
    route: 'tax-accounting/vat/reporting-engine-update',
    title: 'به‌روزرسانی موتور گزارش‌گیری',
    sourcePath:
      'مالی / حسابداری مالیاتی / مالیات بر ارزش افزوده / بروز رسانی موتور گزارش‌گیری',
    sourcePage: '',
    evidenceStatus: 'menu-only',
    fields: [],
    columns: [],
    actions: [],
    blocker: 'برای این برگ منو capture معتبر فرم موجود نیست',
    stage: 'به‌روزرسانی موتور گزارش‌گیری',
  },
];

const unique = <T>(items: readonly T[]) => [...new Set(items)];
const uniqueFields = (items: readonly AccountingParityField[]) => {
  const fields = new Map<string, AccountingParityField>();
  for (const field of items) {
    const key = `${field.sourceControlId || field.label}:${field.type}`;
    const previous = fields.get(key);
    if (!previous || (previous.disabled && !field.disabled))
      fields.set(key, field);
  }
  return [...fields.values()];
};
const definitions = new Map<string, AccountingParityDefinition>();
const standardCaptures: AccountingParityCapture[] = [
  {
    route: 'general-ledger/reports/legal-reports/mappings',
    title: 'نگاشت کدهای استاندارد',
    sourcePath:
      'مالی / دفتر کل / گزارش ها / گزارش های قانونی / نگاشت کدهای استاندارد',
    sourcePage:
      'Financial/CodingStandardManagement/CodingStandardMapingPages/EditView.view',
    evidenceStatus: 'observed-layout',
    fields: ['کدینگ استاندارد', 'نسخه پروتکل', 'موجودیت استاندارد'].map(
      (label) => ({ label, type: 'text', disabled: false }),
    ),
    columns: ['کد', 'عنوان'],
    actions: ['نگاشت', 'حذف نگاشت', 'بارگذاری مجدد'],
    stage: 'درخت کدها و دو فهرست نگاشت',
    blocker:
      'گزینهٔ دارای گردش در این موجودیت تأیید نشد؛ موجودیت‌های غیرحسابی قرارداد مستقل لازم دارند.',
  },
  {
    route: 'general-ledger/reports/legal-reports/report',
    title: 'گزارش کدینگ استاندارد',
    sourcePath:
      'مالی / دفتر کل / گزارش ها / گزارش های قانونی / گزارش کدینگ استاندارد',
    sourcePage: 'Financial/Reports/CodingStandardReportPages/EditView.view',
    evidenceStatus: 'observed-layout',
    fields: [
      'کدینگ استاندارد',
      'نسخه پروتکل',
      'از تاریخ',
      'تا تاریخ',
      'از دوره مالی',
      'تا دوره مالی',
      'نوع سند',
    ].map((label) => ({ label, type: 'text', disabled: false })),
    columns: [],
    actions: ['گزارش'],
    stage: 'فیلتر گزارش',
    blocker:
      'گردش داخلی بر اساس نگاشت فعلی؛ قالب رسمی پروتکل و اسناد متمم تأیید نشده‌اند.',
  },
  {
    route: 'general-ledger/reports/legal-reports/formulas',
    title: 'فرمول کدینگ استاندارد',
    sourcePath:
      'مالی / دفتر کل / گزارش ها / گزارش های قانونی / فرمول کدینگ استاندارد',
    sourcePage:
      'Financial/CodingStandardManagement/CodingStandardFormulaPages/Edit.aspx',
    evidenceStatus: 'source-error',
    fields: [],
    columns: [],
    actions: [],
    stage: 'خطا',
    blocker:
      'فرم فرمول در همین دورهٔ راهکاران خطای سمت سرور دارد؛ فرمول حدسی اجرا نمی‌شود.',
  },
  {
    route: 'general-ledger/reports/legal-reports/validation',
    title: 'صحت سنجی کنترل',
    sourcePath: 'مالی / دفتر کل / گزارش ها / گزارش های قانونی / صحت سنجی کنترل',
    sourcePage:
      'Financial/CodingStandardManagement/CodingStandardFormulaValidationPages/Edit.aspx',
    evidenceStatus: 'observed-layout',
    fields: ['کدینگ استاندارد', 'نسخه', 'از تاریخ', 'تا تاریخ'].map(
      (label) => ({ label, type: 'text', disabled: false }),
    ),
    columns: ['عنوان', 'عنوان کدینگ استاندارد', 'نسخه پروتکل'],
    actions: ['فیلتر'],
    stage: 'فهرست کنترل‌ها',
    blocker:
      'فهرست کنترل‌های منبع خالی است و فرم فرمول خطا دارد؛ تعریف یا اجرای قواعد مشاهده نشده فعال نیست.',
  },
];
for (const capture of [
  ...accountingParitySource1,
  ...accountingParitySource2,
  ...accountingParitySource3,
  ...accountingParitySource4,
  ...menuOnlyCaptures,
  ...explicitGaps,
  ...standardCaptures,
  ...accountingTaxForms
    .filter((form) => form.key === 'parties' || form.key === 'history')
    .map((form): AccountingParityCapture => ({
      route: form.route,
      title: form.title,
      sourcePath: [
        'مالی',
        'حسابداری مالیاتی',
        'مالیات بر ارزش افزوده',
        'فهرست ها',
        form.title,
      ].join(' / '),
      sourcePage: form.listSourcePage,
      evidenceStatus: 'observed-layout',
      fields: [],
      columns: form.listColumns,
      actions: [],
      stage: form.title,
    })),
  ...taxpayerPages
    .filter((page) => page.route === 'taxpayer-system/reports/uncollected-days')
    .map((page): AccountingParityCapture => ({
      route: page.route,
      title: page.title,
      sourcePath: [
        'مالی',
        'ارتباط با سامانه مودیان مالیاتی',
        'گزارش ها',
        page.title,
      ].join(' / '),
      sourcePage: page.sourcePage,
      evidenceStatus: 'observed-layout',
      fields: [],
      columns: page.columns,
      actions: page.actions,
      stage: page.title,
    })),
]) {
  const current = definitions.get(capture.route);
  const evidenceStatus =
    current?.evidenceStatus === 'source-error' ||
    capture.evidenceStatus === 'source-error'
      ? 'source-error'
      : current?.evidenceStatus === 'observed-layout' ||
          capture.evidenceStatus === 'observed-layout'
        ? 'observed-layout'
        : 'menu-only';
  const implementation =
    implementationByRoute[capture.route] ?? 'evidence-only';
  definitions.set(capture.route, {
    route: capture.route,
    title:
      capture.title.startsWith('خطا') || capture.stage === 'خطا'
        ? capture.sourcePath.split('/').at(-1)!.trim()
        : capture.title,
    sourcePath: capture.sourcePath,
    sourcePages: unique([
      ...(current?.sourcePages ?? []),
      ...(capture.sourcePage ? [capture.sourcePage] : []),
    ]),
    evidenceStatus,
    fields: uniqueFields([...(current?.fields ?? []), ...capture.fields]),
    columns: unique([...(current?.columns ?? []), ...capture.columns]),
    actions: unique([...(current?.actions ?? []), ...capture.actions]),
    blockers: unique([
      ...(current?.blockers ?? []),
      ...('blocker' in capture && capture.blocker ? [capture.blocker] : []),
    ]),
    stages: unique([...(current?.stages ?? []), capture.stage]),
    support:
      evidenceStatus === 'source-error'
        ? 'source-error'
        : implementation === 'evidence-only'
          ? 'dependency'
          : 'supported',
    implementation,
  });
}

export const accountingParityDefinitions = [...definitions.values()];
export const accountingParityByRoute = new Map(
  accountingParityDefinitions.map((definition) => [
    definition.route,
    definition,
  ]),
);
