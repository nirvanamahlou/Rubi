import { accountingParitySource1 } from './accounting-parity-source-1';
import { accountingParitySource2 } from './accounting-parity-source-2';
import { accountingParitySource3 } from './accounting-parity-source-3';
import { accountingParitySource4 } from './accounting-parity-source-4';

export type AccountingParitySupport =
  'supported' | 'dependency' | 'source-error';
export type AccountingParityImplementation =
  | 'configuration'
  | 'ledger'
  | 'accounts'
  | 'details'
  | 'account-groups'
  | 'detail-groups'
  | 'mapping'
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
  | 'trial-balance'
  | 'turnover-report'
  | 'analytical-report'
  | 'tax-settings'
  | 'configuration-list'
  | 'journal-list'
  | 'template-list'
  | 'evidence-only';
export interface AccountingParityField {
  label: string;
  type: 'text' | 'date' | 'checkbox' | 'textarea' | 'password';
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
  'general-ledger/base-information/fiscal-years': 'configuration',
  'general-ledger/base-information/ledgers': 'ledger',
  'general-ledger/base-information/voucher-types': 'configuration',
  'general-ledger/accounts/chart': 'accounts',
  'general-ledger/accounts/detail-types': 'configuration',
  'general-ledger/accounts/details': 'details',
  'general-ledger/accounts/account-groups': 'account-groups',
  'general-ledger/accounts/detail-groups': 'detail-groups',
  'general-ledger/accounts/mappings': 'mapping',
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
  'general-ledger/reports/account-browser': 'turnover-report',
  'general-ledger/reports/trial-balance': 'trial-balance',
  'general-ledger/reports/dormant-accounts': 'analytical-report',
  'general-ledger/reports/nature-conflict-period': 'analytical-report',
  'general-ledger/reports/nature-conflict-range': 'analytical-report',
  'general-ledger/reports/comparative': 'analytical-report',
  'taxpayer-system/settings': 'tax-settings',
  'general-ledger/base-information/lists/fiscal-years': 'configuration-list',
  'general-ledger/base-information/lists/ledgers': 'configuration-list',
  'general-ledger/base-information/lists/voucher-types': 'configuration-list',
  'general-ledger/accounts/lists/detail-types': 'configuration-list',
  'general-ledger/accounts/lists/details': 'configuration-list',
  'general-ledger/accounts/lists/detail-type-converters': 'evidence-only',
  'general-ledger/documents/lists/journals': 'journal-list',
  'general-ledger/documents/lists/gl-vouchers': 'journal-list',
  'general-ledger/documents/lists/automatic-templates': 'template-list',
  'general-ledger/documents/lists/revaluation-templates': 'template-list',
  'general-ledger/year-end/lists/closing-templates': 'template-list',
};

const menuOnly = (
  route: string,
  title: string,
  parentPath: string,
  sourceMenuKey: string,
): AccountingParityCapture => ({
  route,
  title,
  sourcePath: `${parentPath} / ${title}`,
  sourcePage: `menu-search:${sourceMenuKey}`,
  evidenceStatus: 'menu-only',
  fields: [],
  columns: [],
  actions: [],
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
    route: 'general-ledger/reports/legal-reports',
    title: 'گزارش‌های قانونی',
    sourcePath: 'مالی / دفتر کل / گزارش ها / گزارش های قانونی',
    sourcePage: '',
    evidenceStatus: 'menu-only',
    fields: [],
    columns: [],
    actions: [],
    blocker:
      'منوی منبع صفحه مستقلی را اثبات نکرد و alias مشاهده‌شده متعلق به دفاتر تجاری الکترونیکی بود',
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
const definitions = new Map<string, AccountingParityDefinition>();
for (const capture of [
  ...accountingParitySource1,
  ...accountingParitySource2,
  ...accountingParitySource3,
  ...accountingParitySource4,
  ...menuOnlyCaptures,
  ...explicitGaps,
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
    title: capture.title === 'خطا' ? capture.stage : capture.title,
    sourcePath: capture.sourcePath,
    sourcePages: unique([
      ...(current?.sourcePages ?? []),
      ...(capture.sourcePage ? [capture.sourcePage] : []),
    ]),
    evidenceStatus,
    fields: unique([...(current?.fields ?? []), ...capture.fields]),
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
