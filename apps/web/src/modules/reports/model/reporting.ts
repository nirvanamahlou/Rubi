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
  sales_contract_pipeline: 'RPT-020',
  agency_contract_risk: 'RPT-021',
  ticket_capacity: 'RPT-022',
  supplier_payment_queue: 'RPT-023',
  reservation_delivery_readiness: 'RPT-024',
  lead_pipeline: 'RPT-025',
  customer_satisfaction: 'RPT-026',
  customer_consent_coverage: 'RPT-027',
  document_compliance: 'RPT-028',
  hr_record_expiry: 'RPT-029',
  workbench_due_actions: 'RPT-030',
  hotel_rate_comparison: 'RPT-031',
  future_travel_commitments: 'RPT-032',
  customer_payment_aging: 'RPT-033',
  reservation_cycle_time: 'RPT-034',
  manifest_finance_exclusions: 'RPT-035',
  customer_portfolio_growth: 'RPT-036',
  cash_position: 'RPT-037',
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
    // A producer must publish its approved projection before a pending card
    // can become an executable financial report.
    availability: definition.availability ?? 'PENDING_CONNECTION',
    dateBasis: definition.dateBasis ?? 'زمان مؤثر رویداد در UTC',
    outputs: definition.outputs ?? allOutputs,
  };
}

export const reportCatalog: readonly ReportDefinition[] = [
  report({
    code: 'sales_by_organization',
    title: 'هر کارشناس چه تعداد قرارداد و چه مبلغ فروشی ثبت کرده است؟',
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
    title: 'در بازه انتخابی چه میزان دریافت، پرداخت و استرداد قطعی شده است؟',
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
    title:
      'بیشترین خطاهای رزرواسیون مربوط به کدام ارائه‌دهنده یا مرحله عملیاتی است؟',
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
    title: 'چه تعداد رزرو لغو یا مسترد شده و علت و مبلغ آن‌ها چیست؟',
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
    title:
      'کدام درخواست‌های مشتری از زمان توافق‌شده برای پاسخ یا حل عبور کرده‌اند؟',
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
    title: 'کارکرد، مرخصی و اضافه‌کاری کارکنان هر واحد چگونه است؟',
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
    title:
      'کدام آژانس‌ها و مشتریان سازمانی بیشترین فروش و سود را ایجاد کرده‌اند؟',
    category: 'گزارش‌های مدیریتی تجمیعی',
    description:
      'فروش، خرید و سود ناخالص به تفکیک آژانس، نوع مشتری و کانال فروش.',
    grain: 'Order Item Currency Grain',
    permission: 'reporting.b2b.read',
    availability: 'READY',
    approvedView: 'reporting.travel.facts.v1',
    dimensions: ['آژانس', 'نوع مشتری', 'کانال فروش'],
    measures: ['فروش', 'خرید', 'سود ناخالص'],
    filters: [...commonFilters, 'آژانس', 'کانال فروش'],
    drillDown: 'اقلام سفر تشکیل‌دهنده مبلغ بدون تکثیر مسافر',
  }),
  report({
    code: 'lead_to_order_conversion',
    title: 'هر منبع جذب چه تعداد سفارش و چه میزان فروش ایجاد کرده است؟',
    category: 'مارکتینگ',
    description:
      'ردیابی منبع جذب تا سفارش سفر و ارزش فروش حاصل از هر منبع لید.',
    grain: 'Order Item Currency Grain',
    permission: 'reporting.sales.read',
    availability: 'READY',
    approvedView: 'reporting.travel.facts.v1',
    dimensions: ['منبع لید', 'نوع مشتری'],
    measures: ['تعداد سفارش', 'مبلغ فروش'],
    filters: [...commonFilters, 'منبع لید', 'نوع مشتری'],
    drillDown: 'سفارش‌های سفر منتسب به منبع لید',
  }),
  report({
    code: 'route_passengers',
    title: 'کدام مقصدها و مسیرهای سفر بیشترین سفارش و مسافر را داشته‌اند؟',
    category: 'رزرواسیون و عملیات سفر',
    description: 'تعداد سفارش، مسافر و بلیت به تفکیک مقصد و مسیر سفر.',
    grain: 'Order Item Currency Grain',
    permission: 'reporting.sales.read',
    availability: 'READY',
    approvedView: 'reporting.travel.facts.v1',
    dimensions: ['مقصد', 'مسیر'],
    measures: ['تعداد سفارش', 'تعداد مسافر', 'تعداد بلیت'],
    filters: [...commonFilters, 'مقصد', 'مسیر'],
    drillDown: 'اقلام سفارش و شمارنده‌های مستقل مسافر و Segment',
  }),
  report({
    code: 'sales_contract_pipeline',
    title: 'قراردادهای فروش در هر مرحله چه تعداد و چه مبلغی دارند؟',
    category: 'فروش و قراردادها',
    description:
      'تعداد و مبلغ قراردادهای فروش به تفکیک وضعیت قرارداد، رزرو، تسویه و مسئول پیگیری.',
    grain: 'Sales Contract Grain',
    permission: 'reporting.sales.read',
    approvedView: 'reporting_sales_contract_pipeline_facts_v1',
    dimensions: ['وضعیت قرارداد', 'وضعیت رزرو', 'وضعیت تسویه', 'مسئول', 'مسیر'],
    measures: ['تعداد قرارداد', 'مبلغ قرارداد', 'میانگین زمان توقف در مرحله'],
    filters: [...commonFilters, 'مسئول', 'نوع سفر', 'مبدأ', 'مقصد'],
    drillDown: 'قرارداد فروش و تاریخچه تغییر وضعیت آن',
  }),
  report({
    code: 'agency_contract_risk',
    title:
      'کدام قراردادها و تضامین آژانس‌ها رو به انقضا هستند و سقف اعتبارشان چقدر است؟',
    category: 'آژانس‌ها و مشتریان سازمانی',
    description:
      'قراردادهای رو به پایان، تضامین در آستانه انقضا و سیاست‌های اعتباری فعال آژانس‌ها به تفکیک ارز.',
    grain: 'Agency Agreement Currency Grain',
    permission: 'reporting.b2b.read',
    approvedView: 'reporting_b2b_agency_risk_facts_v1',
    dimensions: ['آژانس', 'قرارداد', 'مدیر حساب', 'نوع تضمین', 'ارز'],
    measures: ['سقف اعتبار', 'مبلغ تضمین', 'روز تا انقضا', 'مهلت تسویه'],
    filters: [
      ...commonFilters,
      'آژانس',
      'وضعیت قرارداد',
      'نوع تضمین',
      'مدیر حساب',
    ],
    drillDown: 'قرارداد، نسخه مصوب، سیاست اعتبار و تضمین مرتبط',
  }),
  report({
    code: 'ticket_capacity',
    title:
      'ظرفیت کدام پروازها رو به تکمیل است و چه تعداد صندلی باقی مانده است؟',
    category: 'مدیریت بلیت‌ها',
    description:
      'ظرفیت کل، تخصیص فعال و ظرفیت باقی‌مانده پیشنهادهای پرواز به تفکیک مسیر، تاریخ و کلاس پروازی.',
    grain: 'Published Ticket Offer Grain',
    permission: 'reporting.tickets.read',
    approvedView: 'reporting_ticket_capacity_facts_v1',
    dimensions: ['پرواز', 'ایرلاین', 'مسیر', 'تاریخ حرکت', 'کلاس پروازی'],
    measures: [
      'ظرفیت کل',
      'تخصیص فعال',
      'ظرفیت باقی‌مانده',
      'درصد تکمیل ظرفیت',
    ],
    filters: [...commonFilters, 'ایرلاین', 'مبدأ', 'مقصد', 'کلاس پروازی'],
    drillDown: 'پیشنهاد پرواز و تخصیص‌های فعال قرارداد',
  }),
  report({
    code: 'supplier_payment_queue',
    title: 'کدام خریدهای خدمات سفر در انتظار پرداخت به تأمین‌کننده هستند؟',
    category: 'خرید و تأمین',
    description:
      'آخرین وضعیت پرداخت خرید هر خدمت، مبلغ، ارز، تأمین‌کننده و مدت انتظار تا تأیید مالی.',
    grain: 'Latest Service Purchase Revision Grain',
    permission: 'reporting.procurement.read',
    approvedView: 'reporting_supplier_payment_queue_facts_v1',
    dimensions: ['تأمین‌کننده', 'نوع خدمت', 'وضعیت پرداخت', 'بانک', 'مسئول'],
    measures: ['مبلغ خرید', 'تعداد خرید', 'مدت انتظار', 'تعداد تلاش پرداخت'],
    filters: [
      ...commonFilters,
      'تأمین‌کننده',
      'نوع خدمت',
      'وضعیت پرداخت',
      'بانک',
    ],
    drillDown: 'آخرین نسخه خرید خدمت و تاریخچه پرداخت مالی',
  }),
  report({
    code: 'reservation_delivery_readiness',
    title: 'کدام رزروها برای تحویل آماده نیستند و مانع هرکدام چیست؟',
    category: 'رزرواسیون و عملیات سفر',
    description:
      'رزروهای در جریان به تفکیک وضعیت عملیات، تکمیل خرید خدمات و تأیید تحویل از سوی واحد مالی.',
    grain: 'Reservation Intake Grain',
    permission: 'reporting.reservations.read',
    approvedView: 'reporting_reservation_delivery_readiness_facts_v1',
    dimensions: ['وضعیت رزرو', 'مانع تحویل', 'نوع خدمت', 'مسئول فروش', 'شعبه'],
    measures: [
      'تعداد رزرو',
      'خریدهای ناقص',
      'پرداخت‌های تأمین‌کننده معوق',
      'زمان انتظار',
    ],
    filters: [...commonFilters, 'مانع تحویل', 'نوع خدمت', 'مسئول فروش'],
    drillDown: 'رزرو، آخرین وضعیت گردش کار، خریدها و تأیید تحویل مالی',
  }),
  report({
    code: 'lead_pipeline',
    title:
      'سرنخ‌های فروش سفر در چه مراحلی هستند و کدام پیگیری‌ها عقب افتاده‌اند؟',
    category: 'امور مشتریان و SLA',
    description:
      'تعداد و ارزش احتمالی لیدهای سفر به تفکیک مرحله، منبع، کانال ورودی، مسئول و موعد اقدام بعدی.',
    grain: 'Customer Affairs Lead Grain',
    permission: 'reporting.customer_affairs.read',
    approvedView: 'reporting_customer_affairs_lead_facts_v1',
    dimensions: ['مرحله لید', 'منبع لید', 'کانال ورودی', 'مسئول', 'مقصد'],
    measures: ['تعداد لید', 'بودجه احتمالی', 'پیگیری معوق', 'میانگین عمر لید'],
    filters: [
      ...commonFilters,
      'مرحله لید',
      'منبع لید',
      'کانال ورودی',
      'مسئول',
    ],
    drillDown: 'لید و خط زمانی اقدامات مجاز آن',
  }),
  report({
    code: 'customer_satisfaction',
    title:
      'کدام خدمات یا واحدها کمترین رضایت مشتری و بیشترین اقدام اصلاحی را دارند؟',
    category: 'امور مشتریان و SLA',
    description:
      'امتیاز رضایت، نرخ مشارکت و درخواست‌های نیازمند اقدام اصلاحی به تفکیک نوع خدمت و واحد پاسخ‌گو.',
    grain: 'Customer Satisfaction Response Grain',
    permission: 'reporting.customer_affairs.read',
    approvedView: 'reporting_customer_satisfaction_facts_v1',
    dimensions: ['نوع درخواست', 'نوع خدمت', 'واحد پاسخ‌گو', 'کارشناس'],
    measures: [
      'میانگین امتیاز',
      'نرخ پاسخ',
      'تعداد امتیاز پایین',
      'اقدام اصلاحی باز',
    ],
    filters: [
      ...commonFilters,
      'نوع درخواست',
      'نوع خدمت',
      'واحد پاسخ‌گو',
      'کارشناس',
    ],
    drillDown: 'پاسخ رضایت و اقدام اصلاحی مرتبط بدون نمایش اطلاعات حساس',
  }),
  report({
    code: 'customer_consent_coverage',
    title: 'در هر کانال با چه تعداد مشتری اجازه معتبر برای ارتباط داریم؟',
    category: 'مارکتینگ',
    description:
      'آخرین وضعیت رضایت مشتریان برای اهداف و کانال‌های ارتباطی به تفکیک نوع مشتری و شعبه مالک.',
    grain: 'Customer Purpose Channel Grain',
    permission: 'reporting.customers.read',
    approvedView: 'reporting_customer_consent_facts_v1',
    dimensions: ['هدف ارتباط', 'کانال', 'وضعیت رضایت', 'نوع مشتری', 'شعبه'],
    measures: ['تعداد مشتری مجاز', 'تعداد لغو رضایت', 'نرخ پوشش رضایت'],
    filters: [...commonFilters, 'هدف ارتباط', 'کانال', 'نوع مشتری'],
    drillDown: 'آخرین رویداد رضایت هر مشتری با اطلاعات هویتی محدودشده',
  }),
  report({
    code: 'document_compliance',
    title: 'کدام اسناد عملیاتی ناقص، منقضی یا در انتظار پردازش هستند؟',
    category: 'اسناد و انطباق',
    description:
      'اسناد نیازمند اقدام به تفکیک نوع، دسته، ماژول مبدأ، وضعیت بایگانی و موعد اعتبار.',
    grain: 'Document Grain',
    permission: 'reporting.audit.read',
    approvedView: 'reporting_document_compliance_facts_v1',
    dimensions: [
      'نوع سند',
      'دسته',
      'ماژول مبدأ',
      'وضعیت بایگانی',
      'وضعیت پردازش',
    ],
    measures: [
      'تعداد سند ناقص',
      'تعداد منقضی',
      'روز تا انقضا',
      'کار پردازشی ناموفق',
    ],
    filters: [
      ...commonFilters,
      'نوع سند',
      'دسته',
      'ماژول مبدأ',
      'وضعیت بایگانی',
    ],
    drillDown: 'سند، نسخه جاری و آخرین کار پردازشی مجاز',
  }),
  report({
    code: 'hr_record_expiry',
    title: 'کدام سوابق کارکنان به‌زودی منقضی می‌شوند یا نیازمند تکمیل هستند؟',
    category: 'منابع انسانی',
    description:
      'سوابق فعال کارکنان با موعد انقضا، وضعیت تکمیل و اقدام لازم به تفکیک واحد، سمت و شعبه.',
    grain: 'HR Record Grain',
    permission: 'reporting.hr.read',
    approvedView: 'reporting_hr_record_expiry_facts_v1',
    dimensions: ['نوع سابقه', 'کارمند', 'واحد', 'سمت', 'شعبه'],
    measures: [
      'تعداد در آستانه انقضا',
      'تعداد منقضی',
      'روز تا انقضا',
      'تعداد ناقص',
    ],
    filters: [...commonFilters, 'نوع سابقه', 'کارمند', 'واحد', 'سمت'],
    drillDown: 'رکورد منابع انسانی و سند مرتبط در محدوده مجاز',
  }),
  report({
    code: 'workbench_due_actions',
    title: 'کدام کارها و پیگیری‌های میزکار سررسید شده یا عقب افتاده‌اند؟',
    category: 'گزارش‌های مدیریتی تجمیعی',
    description:
      'کارهای برنامه‌ریزی‌شده کاربران به تفکیک موعد، اولویت، وضعیت، شعبه و پیوند عملیاتی.',
    grain: 'Workbench Calendar Event Grain',
    permission: 'reporting.read',
    approvedView: 'reporting_workbench_due_action_facts_v1',
    dimensions: ['کاربر', 'شعبه', 'اولویت', 'وضعیت', 'نوع پیوند'],
    measures: ['تعداد سررسیدشده', 'تعداد معوق', 'میانگین تأخیر'],
    filters: [...commonFilters, 'کاربر', 'اولویت', 'وضعیت'],
    drillDown: 'رویداد میزکار و مسیر مجاز عملیات مرتبط',
  }),
  report({
    code: 'hotel_rate_comparison',
    title:
      'نرخ خرید هتل‌ها در هر بازه و نزد هر تأمین‌کننده چگونه مقایسه می‌شود؟',
    category: 'خرید و تأمین',
    description:
      'نرخ پایه و عوامل مؤثر ثبت‌شده برای هتل و تأمین‌کننده در بازه اقامت و ارز انتخابی.',
    grain: 'Hotel Broker Rate Grain',
    permission: 'reporting.procurement.read',
    approvedView: 'reporting_hotel_rate_comparison_facts_v1',
    dimensions: ['هتل', 'تأمین‌کننده', 'بازه اقامت', 'روش نرخ‌گذاری', 'ارز'],
    measures: ['نرخ پایه', 'نرخ نهایی محاسبه‌شده', 'اختلاف با کمترین نرخ'],
    filters: [...commonFilters, 'هتل', 'تأمین‌کننده', 'روش نرخ‌گذاری'],
    drillDown: 'بسته نرخ و عوامل محاسبه همان ردیف',
  }),
  report({
    code: 'future_travel_commitments',
    title: 'در هفته‌های آینده چه میزان فروش، مانده وصول‌نشده و تعهد سفر داریم؟',
    category: 'گزارش‌های مدیریتی تجمیعی',
    description:
      'تعهدات سفر آینده بر پایه تاریخ حرکت قرارداد، مبلغ فروش، مانده وصول‌نشده و وضعیت آمادگی رزرو.',
    grain: 'Sales Contract Currency Departure Week Grain',
    permission: 'reporting.sales.read',
    approvedView: 'reporting_future_travel_commitment_facts_v1',
    dimensions: ['هفته حرکت', 'مقصد', 'نوع خدمت', 'وضعیت رزرو', 'وضعیت تسویه'],
    measures: ['تعداد قرارداد', 'مبلغ فروش', 'مانده وصول‌نشده', 'تعداد مسافر'],
    filters: [...commonFilters, 'بازه حرکت', 'مقصد', 'نوع خدمت', 'وضعیت رزرو'],
    drillDown: 'قرارداد، خدمات، مسافران و برنامه پرداخت همان تعهد سفر',
  }),
  report({
    code: 'customer_payment_aging',
    title:
      'چه مبلغی از تعهدات پرداخت مشتریان سررسید شده یا در آستانه سررسید است؟',
    category: 'مالی و خزانه‌داری',
    description:
      'تعهدات پرداخت قراردادهای فروش به تفکیک سررسید، وضعیت تأیید مالی، روش پرداخت، مشتری و ارز.',
    grain: 'Sales Contract Payment Entry Grain',
    permission: 'reporting.finance.read',
    approvedView: 'reporting_customer_payment_aging_facts_v1',
    dimensions: ['بازه سررسید', 'مشتری', 'روش پرداخت', 'وضعیت تأیید', 'ارز'],
    measures: ['مبلغ سررسیدشده', 'مبلغ آتی', 'تعداد تعهد', 'میانگین روز تأخیر'],
    filters: [
      ...commonFilters,
      'مشتری',
      'روش پرداخت',
      'وضعیت تأیید',
      'بازه سررسید',
    ],
    drillDown: 'برنامه پرداخت قرارداد و آخرین تأیید مالی مجاز',
  }),
  report({
    code: 'reservation_cycle_time',
    title:
      'کدام مرحله رزرواسیون بیشترین زمان انتظار و گلوگاه عملیاتی را ایجاد می‌کند؟',
    category: 'رزرواسیون و عملیات سفر',
    description:
      'زمان سپری‌شده از دریافت درخواست تا خرید، تأیید مالی و آمادگی تحویل به تفکیک مرحله و نوع خدمت.',
    grain: 'Reservation Intake Latest Workflow Grain',
    permission: 'reporting.reservations.read',
    approvedView: 'reporting_reservation_cycle_time_facts_v1',
    dimensions: ['مرحله جاری', 'نوع خدمت', 'تأمین‌کننده', 'شعبه', 'مسئول'],
    measures: [
      'میانگین زمان مرحله',
      'صدک ۹۰ زمان انتظار',
      'تعداد رزرو متوقف',
      'عمر رزرو',
    ],
    filters: [
      ...commonFilters,
      'مرحله جاری',
      'نوع خدمت',
      'تأمین‌کننده',
      'مسئول',
    ],
    drillDown: 'درخواست رزرو و آخرین نسخه گردش کار، خرید و تأیید تحویل',
  }),
  report({
    code: 'manifest_finance_exclusions',
    title:
      'چه تعداد قرارداد به علت تأیید مالی‌نشده از فهرست مسافران حذف شده‌اند؟',
    category: 'مدیریت بلیت‌ها',
    description:
      'تعداد قراردادها و مسافرانی که در هر اجرای فهرست مسافران پذیرفته یا به علت مانع مالی کنار گذاشته شده‌اند.',
    grain: 'Reservation Manifest Export Run Grain',
    permission: 'reporting.tickets.read',
    approvedView: 'reporting_manifest_finance_exclusion_facts_v1',
    dimensions: ['بازه حرکت', 'اجراکننده', 'شعبه', 'وضعیت پذیرش'],
    measures: [
      'قرارداد پذیرفته‌شده',
      'مسافر پذیرفته‌شده',
      'حذف‌شده به علت مانع مالی',
      'نرخ حذف',
    ],
    filters: ['بازه تاریخ', 'شرکت', 'شعبه', 'اجراکننده', 'وضعیت پذیرش'],
    drillDown:
      'اجرای فهرست مسافران و اقلام پذیرفته‌شده بدون افشای اطلاعات هویتی',
  }),
  report({
    code: 'customer_portfolio_growth',
    title: 'ترکیب و رشد مشتریان فعال در هر بخش و کانال جذب چگونه است؟',
    category: 'گزارش‌های مدیریتی تجمیعی',
    description:
      'تعداد مشتریان فعال، مشتریان جدید و غیرفعال‌شده به تفکیک نوع مشتری، روش آشنایی و شعبه مالک.',
    grain: 'Customer Cohort Month Grain',
    permission: 'reporting.customers.read',
    approvedView: 'reporting_customer_portfolio_growth_facts_v1',
    dimensions: [
      'ماه عضویت',
      'نوع مشتری',
      'روش آشنایی',
      'شعبه مالک',
      'وضعیت فعالیت',
    ],
    measures: ['مشتری فعال', 'مشتری جدید', 'مشتری غیرفعال‌شده', 'نرخ رشد خالص'],
    filters: [
      'بازه تاریخ',
      'شرکت',
      'شعبه',
      'نوع مشتری',
      'روش آشنایی',
      'وضعیت فعالیت',
    ],
    drillDown: 'پرونده‌های مشتری مجاز بدون نمایش داده هویتی حساس',
  }),
  report({
    code: 'cash_position',
    title:
      'با وضعیت فعلی پرونده‌ها و تعهدات، شرکت نیاز به تزریق نقدینگی دارد یا امکان برداشت وجه وجود دارد؟',
    category: 'مالی و خزانه‌داری',
    description:
      'مقایسه وجه قابل استفاده امروز با تعهدات پرداخت قطعی تا هفت روز آینده، به تفکیک شرکت و ارز؛ فقط پس از تأیید داده خزانه‌داری منتشر می‌شود.',
    grain:
      'شرکت، ارز و زمان مبنای محاسبه؛ اقلام پرونده و تعهد پیش از تجمیع جداگانه محاسبه می‌شوند',
    permission: 'reporting.finance.read',
    approvedView: 'reporting_cash_position_facts_v1',
    dateBasis:
      'مانده امروز و سررسید تعهدات در هفت روز آینده، با ثبت زمان دریافت داده در UTC',
    dimensions: [
      'شرکت',
      'ارز',
      'نوع منبع نقد',
      'پرونده',
      'تأمین‌کننده',
      'سررسید',
    ],
    measures: [
      'وجه قابل استفاده',
      'دریافت قطعی مشتری',
      'خرید تأییدشده',
      'پرداخت تأمین‌کننده',
      'تعهد هفت روزه',
      'کسری یا مازاد مشروط',
    ],
    filters: [...commonFilters, 'نوع منبع نقد', 'پرونده', 'تأمین‌کننده'],
    drillDown:
      'ردیف‌های تأییدشده حساب، وصول، پرونده و تعهد با تفکیک شرکت و ارز',
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
      'cash_position',
      'paid_not_issued',
      'reservation_errors',
      'agency_performance',
      'lead_to_order_conversion',
      'route_passengers',
      'sales_contract_pipeline',
      'ticket_capacity',
      'supplier_payment_queue',
      'reservation_delivery_readiness',
      'lead_pipeline',
      'workbench_due_actions',
      'future_travel_commitments',
      'customer_payment_aging',
      'reservation_cycle_time',
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
      'agency_contract_risk',
      'customer_satisfaction',
      'customer_consent_coverage',
      'document_compliance',
      'hr_record_expiry',
      'hotel_rate_comparison',
      'manifest_finance_exclusions',
      'customer_portfolio_growth',
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
  cash_position:
    'موقعیت نقدینگی تزریق وجه برداشت وجه تعهد تامین‌کننده هفت روز آینده',
  payments_refunds: 'پرداخت و استرداد',
  paid_not_issued: 'پرداخت موفق بدون صدور',
  reservation_errors: 'خطاهای رزرواسیون',
  cancellations_refunds: 'لغو و Refund',
  marketing_performance: 'عملکرد مارکتینگ',
  customer_service_sla: 'SLA خدمات مشتریان',
  hr_performance: 'عملکرد منابع انسانی',
  tickets_manifest: 'گزارش بلیت و Manifest',
  export_audit: 'Audit خروجی‌ها',
  agency_performance: 'عملکرد آژانس‌ها و مشتریان سازمانی',
  lead_to_order_conversion: 'تبدیل منبع لید به سفارش',
  route_passengers: 'مقصد مسیر سفارش مسافر',
  sales_contract_pipeline: 'قیف قرارداد فروش وضعیت رزرو تسویه',
  agency_contract_risk: 'قرارداد آژانس اعتبار تضمین انقضا',
  ticket_capacity: 'ظرفیت پرواز صندلی باقی‌مانده',
  supplier_payment_queue: 'صف پرداخت تأمین‌کننده خرید خدمت',
  reservation_delivery_readiness: 'آمادگی تحویل رزرو مانع خرید مالی',
  lead_pipeline: 'قیف لید پیگیری معوق امور مشتریان',
  customer_satisfaction: 'رضایت مشتری امتیاز اقدام اصلاحی',
  customer_consent_coverage: 'رضایت‌نامه ارتباط بازاریابی کانال',
  document_compliance: 'اسناد ناقص منقضی پردازش انطباق',
  hr_record_expiry: 'سوابق کارکنان انقضا منابع انسانی',
  workbench_due_actions: 'میزکار کارها پیگیری سررسید معوق',
  hotel_rate_comparison: 'مقایسه نرخ خرید هتل تأمین‌کننده',
  future_travel_commitments: 'تعهد سفر آینده فروش وصول رزرو ظرفیت',
  customer_payment_aging: 'سررسید تعهد پرداخت مشتری وصول مطالبات قرارداد',
  reservation_cycle_time: 'زمان چرخه رزرواسیون گلوگاه عملیات توقف',
  manifest_finance_exclusions: 'حذف مالی فهرست مسافران مانیفست قرارداد',
  customer_portfolio_growth: 'رشد ترکیب مشتری فعال جدید کانال جذب',
};

export function searchReports(query: string): readonly ReportDefinition[] {
  const term = query.trim().toLocaleLowerCase('fa-IR');
  return term
    ? reportCatalog.filter((report) =>
        [
          report.title,
          report.category,
          report.description,
          reportSearchAliases[report.code] ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('fa-IR')
          .includes(term),
      )
    : reportCatalog;
}
