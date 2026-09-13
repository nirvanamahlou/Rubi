export type ReportAvailability = 'PENDING_CONNECTION' | 'READY';
export type ReportPriority = 'P0' | 'P1' | 'P2';

export interface ReportDefinition {
  code: string;
  displayCode: string;
  title: string;
  category: string;
  description: string;
  grain: string;
  permission: string;
  availability: ReportAvailability;
  approvedView: string;
  dateBasis: string;
  dimensions: readonly string[];
  measures: readonly string[];
  filters: readonly string[];
  outputs: readonly ('XLSX' | 'PDF' | 'CSV' | 'API')[];
  drillDown: string;
}

export interface ReportPriorityGroup {
  id: ReportPriority;
  title: string;
  description: string;
  reportCodes: readonly string[];
}

export const REPORTING_PERMISSION_MATRIX = [
  'reporting.read',
  'reporting.sales.read',
  'reporting.reservations.read',
  'reporting.tickets.read',
  'reporting.procurement.read',
  'reporting.finance.read',
  'reporting.customers.read',
  'reporting.customer_affairs.read',
  'reporting.marketing.read',
  'reporting.b2b.read',
  'reporting.hr.read',
  'reporting.sensitive.read',
  'reporting.export',
  'reporting.export_sensitive',
  'reporting.schedule',
  'reporting.manage',
  'reporting.audit.read',
] as const;

const commonFilters = ['بازه تاریخ', 'شرکت', 'شعبه', 'ارز', 'وضعیت'] as const;
const allOutputs = ['XLSX', 'PDF', 'CSV', 'API'] as const;

const reportDisplayCodes: Readonly<Record<string, string>> = {
  sales_by_organization: 'RPT-001',
  sales_by_service_route: 'RPT-002',
  purchase_by_supplier: 'RPT-003',
  contract_service_profit: 'RPT-004',
  receivables_payables: 'RPT-005',
  account_balances: 'RPT-006',
  due_checks: 'RPT-007',
  payments_refunds: 'RPT-008',
  paid_not_issued: 'RPT-009',
  reservation_errors: 'RPT-010',
  cancellations_refunds: 'RPT-011',
  marketing_performance: 'RPT-012',
  customer_service_sla: 'RPT-013',
  hr_performance: 'RPT-014',
  tickets_manifest: 'RPT-015',
  export_audit: 'RPT-016',
  agency_performance: 'RPT-017',
  lead_to_order_conversion: 'RPT-018',
  route_passengers: 'RPT-019',
};

function report(
  definition: Omit<
    ReportDefinition,
    'availability' | 'outputs' | 'dateBasis' | 'displayCode'
  > &
    Partial<Pick<ReportDefinition, 'availability' | 'outputs' | 'dateBasis'>>,
): ReportDefinition {
  const displayCode = reportDisplayCodes[definition.code];
  if (!displayCode)
    throw new Error(`Missing display code for report: ${definition.code}`);
  return {
    ...definition,
    displayCode,
    availability: definition.availability ?? 'PENDING_CONNECTION',
    dateBasis: definition.dateBasis ?? 'زمان مؤثر رویداد در UTC',
    outputs: definition.outputs ?? allOutputs,
  };
}

export const reportCatalog: readonly ReportDefinition[] = [
  report({
    code: 'sales_by_organization',
    title: 'مبلغ قراردادهای قابل‌مشاهده به تفکیک کارشناس و ارز چقدر است؟',
    category: 'فروش و قراردادها',
    description:
      'مبالغ قراردادهای در دسترس کاربر، به تفکیک کارشناس مسئول و ارز قرارداد.',
    grain: 'Contract Currency Grain',
    permission: 'reporting.sales.read',
    availability: 'READY',
    approvedView: 'sales.reporting.organization.v2',
    dimensions: ['شرکت', 'سایت', 'شعبه', 'کارشناس', 'کانال'],
    measures: ['مبلغ قرارداد', 'پرداخت تأییدشده', 'مانده'],
    filters: [...commonFilters, 'سایت', 'کارشناس', 'کانال فروش'],
    drillDown: 'قراردادهای تشکیل‌دهنده هر مقدار',
  }),
  report({
    code: 'sales_by_service_route',
    title: 'کدام خدمت، مسیر یا شهر مقصد بیشترین فروش را ایجاد کرده است؟',
    category: 'فروش و قراردادها',
    description:
      'ارزش فروش اقلام خدماتی، به تفکیک نوع خدمت، مبدأ، مقصد و مسیر سفر.',
    grain: 'Contract Service Grain',
    permission: 'reporting.sales.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['نوع خدمت', 'مبدأ', 'مقصد', 'مسیر', 'ایرلاین'],
    measures: ['فروش خدمت', 'تخفیف', 'کمیسیون'],
    filters: [...commonFilters, 'نوع خدمت', 'مبدأ', 'مقصد', 'مسیر', 'ایرلاین'],
    drillDown: 'خدمت‌های قرارداد در همان Grain',
  }),
  report({
    code: 'purchase_by_supplier',
    title: 'از کدام تأمین‌کنندگان بیشتر خرید کرده‌ایم و سهم هرکدام چقدر است؟',
    category: 'خرید و تأمین',
    description:
      'خالص خریدهای تأییدشده، به تفکیک تأمین‌کننده، ارائه‌دهنده و نوع خدمت.',
    grain: 'Purchase Grain',
    permission: 'reporting.procurement.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['تأمین‌کننده', 'Provider', 'نوع خدمت', 'روش خرید'],
    measures: ['قیمت اولیه', 'تخفیف', 'Fee و مالیات', 'خرید خالص'],
    filters: [...commonFilters, 'تأمین‌کننده', 'Provider', 'نوع خدمت'],
    drillDown: 'خریدها و فاکتورهای خرید مصوب',
  }),
  report({
    code: 'contract_service_profit',
    title: 'کدام قراردادها و خدمات بیشترین یا کمترین سود را داشته‌اند؟',
    category: 'گزارش‌های مدیریتی تجمیعی',
    description:
      'سود ناخالص قراردادها و خدمات، براساس تفاوت فروش و خرید خالص تأییدشده.',
    grain: 'Contract Service Grain',
    permission: 'reporting.finance.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['قرارداد', 'خدمت', 'شرکت', 'شعبه'],
    measures: ['فروش مصوب', 'خرید خالص مصوب', 'سود ناخالص', 'حاشیه سود'],
    filters: [...commonFilters, 'شماره قرارداد', 'نوع خدمت'],
    drillDown: 'Snapshot فروش و خرید تطبیق‌یافته هر خدمت',
  }),
  report({
    code: 'receivables_payables',
    title: 'بیشترین مطالبات و بدهی شرکت مربوط به چه اشخاصی است؟',
    category: 'مالی و خزانه‌داری',
    description:
      'مانده مطالبات و بدهی‌های ثبت‌شده قطعی، به تفکیک طرف حساب و ارز.',
    grain: 'Journal Grain',
    permission: 'reporting.finance.read',
    approvedView: 'reporting_counterparty_balance_facts_v1',
    dimensions: ['طرف حساب', 'نوع طرف حساب', 'حساب', 'ارز'],
    measures: ['مطالبات', 'بدهی', 'سررسیدشده'],
    filters: [...commonFilters, 'طرف حساب', 'وضعیت تسویه'],
    drillDown: 'خطوط سند Posted و اسناد مبدأ',
  }),
  report({
    code: 'account_balances',
    title: 'موجودی و مانده هر حساب، بانک یا صندوق چقدر است؟',
    category: 'مالی و خزانه‌داری',
    description:
      'مانده محاسبه‌شده حساب‌های بانکی، صندوق‌ها و سایر حساب‌های مالی.',
    grain: 'Journal Grain',
    permission: 'reporting.finance.read',
    approvedView: 'reporting_account_balance_facts_v1',
    dimensions: ['حساب', 'بانک یا صندوق', 'شرکت', 'ارز'],
    measures: ['بدهکار Posted', 'بستانکار Posted', 'مانده محاسباتی'],
    filters: [...commonFilters, 'حساب', 'روش پرداخت'],
    drillDown: 'دفتر حساب و خطوط سند Posted',
  }),
  report({
    code: 'due_checks',
    title: 'کدام چک‌ها به‌زودی سررسید می‌شوند یا معوق شده‌اند؟',
    category: 'مالی و خزانه‌داری',
    description:
      'فهرست رسمی چک‌های دریافتنی و پرداختنی فعال، سررسیدشده و معوق در بازه انتخابی.',
    grain: 'Check Grain',
    permission: 'reporting.finance.read',
    approvedView: 'reporting_check_facts_v1',
    dimensions: ['جهت چک', 'بانک', 'طرف حساب', 'وضعیت'],
    measures: ['مبلغ چک', 'روز تا سررسید'],
    filters: [...commonFilters, 'جهت چک', 'بانک', 'وضعیت چک'],
    drillDown: 'چک و تاریخچه وضعیت مجاز',
  }),
  report({
    code: 'payments_refunds',
    title: 'چه میزان دریافت، پرداخت و استرداد انجام شده است؟',
    category: 'مالی و خزانه‌داری',
    description:
      'جمع دریافت‌ها، پرداخت‌ها و استردادهای تکمیل‌شده، به تفکیک نوع و روش تراکنش.',
    grain: 'Payment Grain',
    permission: 'reporting.finance.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['نوع تراکنش', 'روش پرداخت', 'شرکت', 'شعبه'],
    measures: ['مبلغ تأییدشده', 'مبلغ استرداد تکمیل‌شده'],
    filters: [...commonFilters, 'نوع تراکنش', 'روش پرداخت'],
    drillDown: 'تراکنش و تخصیص‌های همان پرداخت',
  }),
  report({
    code: 'paid_not_issued',
    title: 'کدام پرداخت‌های موفق هنوز به صدور خدمت منجر نشده‌اند؟',
    category: 'رزرواسیون و عملیات سفر',
    description:
      'فهرست پرداخت‌های تأییدشده‌ای که در مهلت مصوب هنوز به صدور نهایی خدمت منجر نشده‌اند.',
    grain: 'Reservation Grain',
    permission: 'reporting.reservations.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['Provider', 'خدمت', 'سایت', 'کارشناس'],
    measures: ['تعداد موارد', 'مبلغ تخصیص‌یافته', 'زمان انتظار'],
    filters: [...commonFilters, 'Provider', 'نوع خدمت', 'وضعیت صدور'],
    drillDown: 'Timeline پرداخت، رزرو و تلاش‌های صدور',
  }),
  report({
    code: 'reservation_errors',
    title: 'بیشترین خطاهای رزرواسیون مربوط به کدام Provider یا عملیات است؟',
    category: 'رزرواسیون و عملیات سفر',
    description:
      'تعداد و نرخ خطاهای رزرواسیون، به تفکیک ارائه‌دهنده، عملیات و کد خطا.',
    grain: 'Reservation Grain',
    permission: 'reporting.reservations.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['Provider', 'عملیات', 'کد خطا', 'قابلیت retry'],
    measures: ['تعداد خطا', 'نرخ شکست', 'مدت رفع'],
    filters: [...commonFilters, 'Provider', 'عملیات', 'کد خطا'],
    drillDown: 'Timeline خطای redacted بدون Token یا PII',
  }),
  report({
    code: 'cancellations_refunds',
    title: 'چه تعداد رزرو لغو یا Refund شده و علت اصلی آن چیست؟',
    category: 'رزرواسیون و عملیات سفر',
    description:
      'تعداد و مبلغ رزروهای لغوشده، درخواست‌های استرداد و استردادهای تکمیل‌شده، به تفکیک علت و وضعیت.',
    grain: 'Reservation Grain',
    permission: 'reporting.reservations.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['علت لغو', 'وضعیت Refund', 'Provider', 'خدمت'],
    measures: ['تعداد لغو', 'مبلغ درخواستی', 'مبلغ استردادشده'],
    filters: [...commonFilters, 'علت لغو', 'وضعیت Refund', 'Provider'],
    drillDown: 'رزرو، درخواست Refund و تراکنش تکمیل‌شده',
  }),
  report({
    code: 'marketing_performance',
    title: 'کدام کمپین بیشترین فروش و بازگشت سرمایه را ایجاد کرده است؟',
    category: 'مارکتینگ',
    description:
      'هزینه، فروش منتسب و بازده کمپین‌های بازاریابی، براساس مدل انتساب و رضایت ثبت‌شده.',
    grain: 'Campaign Grain',
    permission: 'reporting.marketing.read',
    approvedView: 'reporting_campaign_facts_v1',
    dimensions: ['کمپین', 'کانال', 'مدل Attribution'],
    measures: [
      'هزینه',
      'ارسال',
      'تحویل',
      'Open',
      'Click',
      'Conversion',
      'ROAS',
    ],
    filters: [...commonFilters, 'کمپین', 'کانال'],
    drillDown: 'Touchpointهای مجاز و فروش منتسب',
  }),
  report({
    code: 'customer_service_sla',
    title: 'کدام درخواست‌های مشتری از SLA عبور کرده‌اند؟',
    category: 'امور مشتریان و SLA',
    description:
      'زمان پاسخ نخست، زمان حل و موارد نقض توافق‌نامه سطح خدمت برای درخواست‌های واجد شرایط مشتریان.',
    grain: 'Ticket Support Grain',
    permission: 'reporting.customer_affairs.read',
    approvedView: 'reporting_support_ticket_facts_v1',
    dimensions: ['دسته Ticket', 'اولویت', 'کارشناس', 'وضعیت SLA'],
    measures: ['زمان پاسخ اول', 'زمان حل', 'تعداد نقض', 'نرخ نقض'],
    filters: [...commonFilters, 'دسته Ticket', 'اولویت', 'کارشناس'],
    drillDown: 'Ticket و Timeline SLA مجاز',
  }),
  report({
    code: 'hr_performance',
    title: 'عملکرد و ظرفیت کاری کارکنان چگونه است؟',
    category: 'منابع انسانی',
    description:
      'کارکرد، حضور، مرخصی، اضافه‌کاری و نتایج ارزیابی کارکنان، بدون نمایش اطلاعات حقوقی.',
    grain: 'Employee Grain',
    permission: 'reporting.hr.read',
    approvedView: 'reporting_employee_performance_facts_v1',
    dimensions: ['کارمند', 'واحد', 'سمت', 'شعبه'],
    measures: ['روز کارکرد', 'مرخصی', 'اضافه‌کاری', 'امتیاز ارزیابی'],
    filters: [...commonFilters, 'کارمند', 'واحد', 'سمت'],
    drillDown: 'رکوردهای HR مجاز و غیرحقوقی',
  }),
  report({
    code: 'tickets_manifest',
    title: 'کدام پروازها و مسیرها بیشترین صدور و ظرفیت مصرف‌شده را دارند؟',
    category: 'مدیریت بلیت‌ها',
    description:
      'تعداد بلیت‌های صادرشده، ظرفیت مصرف‌شده و وضعیت فهرست مسافران، به تفکیک پرواز و مسیر.',
    grain: 'Ticket Grain',
    permission: 'reporting.tickets.read',
    approvedView: 'reporting.travel.facts.v1',
    availability: 'READY',
    dimensions: ['پرواز', 'مسیر', 'ایرلاین', 'Manifest', 'وضعیت صدور'],
    measures: ['تعداد بلیت', 'ظرفیت', 'فروخته‌شده', 'باقی‌مانده'],
    filters: [...commonFilters, 'پرواز', 'مسیر', 'ایرلاین', 'وضعیت Manifest'],
    drillDown: 'بلیت‌ها یا Manifest بدون جمع مبلغ قرارداد',
  }),
  {
    ...report({
      code: 'export_audit',
      title: 'چه کسی، چه گزارشی را با چه فیلترهایی خروجی گرفته است؟',
      category: 'گزارش‌های مدیریتی تجمیعی',
      description:
        'سوابق رسمی دریافت خروجی گزارش‌ها، شامل درخواست‌کننده، فیلترهای اعمال‌شده، نوع فایل و وضعیت اجرا.',
      grain: 'Export Run Grain',
      permission: 'reporting.audit.read',
      approvedView: 'reporting_export_audit_facts_v1',
      dimensions: ['گزارش', 'کاربر', 'نوع خروجی', 'وضعیت'],
      measures: ['تعداد رکورد', 'مدت اجرا', 'زمان انقضا'],
      filters: ['بازه تاریخ', 'کاربر', 'گزارش', 'نوع خروجی', 'وضعیت'],
      drillDown: 'Report Run، Filter Snapshot و Documents Artifact',
    }),
  },
  report({
    code: 'agency_performance',
    title: 'کدام آژانس‌ها و مشتریان سازمانی بیشترین فروش و سود را ایجاد کرده‌اند؟',
    category: 'گزارش‌های مدیریتی تجمیعی',
    description: 'فروش، خرید و سود ناخالص به تفکیک آژانس، نوع مشتری و کانال فروش.',
    grain: 'Order Item Currency Grain',
    permission: 'reporting.b2b.read', availability: 'READY', approvedView: 'reporting.travel.facts.v1',
    dimensions: ['آژانس', 'نوع مشتری', 'کانال فروش'], measures: ['فروش', 'خرید', 'سود ناخالص'],
    filters: [...commonFilters, 'آژانس', 'کانال فروش'], drillDown: 'اقلام سفر تشکیل‌دهنده مبلغ بدون تکثیر مسافر',
  }),
  report({
    code: 'lead_to_order_conversion',
    title: 'هر منبع لید چه تعداد سفارش و چه میزان فروش ایجاد کرده است؟',
    category: 'مارکتینگ',
    description: 'ردیابی منبع جذب تا سفارش سفر و ارزش فروش حاصل از هر منبع لید.',
    grain: 'Order Item Currency Grain', permission: 'reporting.sales.read', availability: 'READY', approvedView: 'reporting.travel.facts.v1',
    dimensions: ['منبع لید', 'نوع مشتری'], measures: ['تعداد سفارش', 'مبلغ فروش'],
    filters: [...commonFilters, 'منبع لید', 'نوع مشتری'], drillDown: 'سفارش‌های سفر منتسب به منبع لید',
  }),
  report({
    code: 'route_passengers',
    title: 'کدام مقصدها و مسیرهای سفر بیشترین سفارش و مسافر را داشته‌اند؟',
    category: 'رزرواسیون و عملیات سفر',
    description: 'تعداد سفارش، مسافر و بلیت به تفکیک مقصد و مسیر سفر.',
    grain: 'Order Item Currency Grain', permission: 'reporting.sales.read', availability: 'READY', approvedView: 'reporting.travel.facts.v1',
    dimensions: ['مقصد', 'مسیر'], measures: ['تعداد سفارش', 'تعداد مسافر', 'تعداد بلیت'],
    filters: [...commonFilters, 'مقصد', 'مسیر'], drillDown: 'اقلام سفارش و شمارنده‌های مستقل مسافر و Segment',
  }),
];

export const reportPriorityGroups: readonly ReportPriorityGroup[] = [
  {
    id: 'P0',
    title: 'اولویت اول ضروری و عملیاتی',
    description:
      'گزارش‌های روزانه برای کنترل فروش، نقدینگی، تعهدات و خطاهای فوری عملیات.',
    reportCodes: [
      'sales_by_organization',
      'sales_by_service_route',
      'contract_service_profit',
      'receivables_payables',
      'account_balances',
      'due_checks',
      'paid_not_issued',
      'reservation_errors',
      'agency_performance',
      'lead_to_order_conversion',
      'route_passengers',
    ],
  },
  {
    id: 'P1',
    title: 'اولویت دوم کنترل عملکرد',
    description:
      'گزارش‌های کنترلی برای خرید، گردش پرداخت، لغو، خدمات مشتریان و عملیات بلیت.',
    reportCodes: [
      'purchase_by_supplier',
      'payments_refunds',
      'cancellations_refunds',
      'customer_service_sla',
      'tickets_manifest',
    ],
  },
  {
    id: 'P2',
    title: 'اولویت سوم تحلیلی و حاکمیتی',
    description:
      'گزارش‌های دوره‌ای برای تحلیل بازاریابی، منابع انسانی و نظارت بر خروجی‌ها.',
    reportCodes: ['marketing_performance', 'hr_performance', 'export_audit'],
  },
];

export function reportPriorityFor(code: string): ReportPriority {
  return (
    reportPriorityGroups.find((group) => group.reportCodes.includes(code))
      ?.id ?? 'P2'
  );
}

export function filterReportCatalog({
  availability = 'all',
  category = 'all',
  priority = 'all',
  query = '',
}: {
  availability?: ReportAvailability | 'all';
  category?: string;
  priority?: ReportPriority | 'all';
  query?: string;
}): readonly ReportDefinition[] {
  return searchReports(query).filter(
    (report) =>
      (category === 'all' || report.category === category) &&
      (availability === 'all' || report.availability === availability) &&
      (priority === 'all' || reportPriorityFor(report.code) === priority),
  );
}

const reportSearchAliases: Readonly<Record<string, string>> = {
  sales_by_organization: 'فروش براساس شرکت سایت شعبه و کارشناس',
  sales_by_service_route: 'فروش براساس خدمت و مسیر',
  purchase_by_supplier: 'خرید براساس تأمین‌کننده',
  contract_service_profit: 'سود قرارداد و خدمت سود قرارداد',
  receivables_payables: 'مطالبات و بدهی‌ها',
  account_balances: 'مانده حساب‌ها',
  due_checks: 'چک‌های سررسید',
  payments_refunds: 'پرداخت و استرداد',
  paid_not_issued: 'پرداخت موفق بدون صدور',
  reservation_errors: 'خطاهای رزرواسیون',
  cancellations_refunds: 'لغو و Refund',
  marketing_performance: 'عملکرد مارکتینگ',
  customer_service_sla: 'SLA خدمات مشتریان',
  hr_performance: 'عملکرد منابع انسانی',
  tickets_manifest: 'گزارش بلیت و Manifest',
  export_audit: 'Audit خروجی‌ها',
};

export function searchReports(query: string): readonly ReportDefinition[] {
  const term = query.trim().toLocaleLowerCase('fa-IR');
  return term
    ? reportCatalog.filter((report) =>
        [
          report.title,
          report.category,
          report.description,
          report.displayCode,
          report.code,
          reportSearchAliases[report.code] ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('fa-IR')
          .includes(term),
      )
    : reportCatalog;
}
