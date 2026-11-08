import type { ReportingGrain } from './reporting.contracts';
import { OPERATIONAL_REPORTS } from './reporting-native-operational';
import { NATIVE_SALES_REPORTS } from './reporting-native-sales';
import { REPORT_READINESS, type ReportReadiness } from './reporting-readiness';

export interface ReportingCatalogEntryV1 {
  code: string;
  title: string;
  grain: ReportingGrain;
  permission: string;
  producerStatus: 'PENDING_CONNECTION' | 'READY';
  approvedView: string;
  outputs: readonly ['XLSX', 'PDF', 'CSV', 'API'];
  version: number;
  readiness?: ReportReadiness;
}

function pending(
  code: string,
  title: string,
  grain: ReportingGrain,
  permission: string,
  approvedView: string,
): ReportingCatalogEntryV1 {
  return {
    code,
    title,
    grain,
    permission,
    approvedView,
    outputs: ['XLSX', 'PDF', 'CSV', 'API'],
    producerStatus: 'PENDING_CONNECTION' as const,
    version: 1,
  };
}

function readyPublicProjection(
  code: string,
  title: string,
  grain: ReportingGrain,
  permission: string,
  publicProjection: string,
  version = 1,
): ReportingCatalogEntryV1 {
  return {
    code,
    title,
    grain,
    permission,
    approvedView: publicProjection,
    outputs: ['XLSX', 'PDF', 'CSV', 'API'],
    producerStatus: 'READY' as const,
    version,
  };
}

const baseCatalog: readonly ReportingCatalogEntryV1[] = [
  readyPublicProjection(
    'sales_by_organization',
    'هر کارشناس چه تعداد قرارداد و چه مبلغ فروشی ثبت کرده است؟',
    'CONTRACT',
    'reporting.sales.read',
    'sales.reporting.contract-currency.v1',
    4,
  ),
  readyPublicProjection(
    'sales_by_service_route',
    'کدام ترکیب خدمات و مسیر بیشترین فروش قرارداد را داشته است؟',
    'CONTRACT_CURRENCY',
    'reporting.sales.read',
    'sales.reporting.contract-currency.v1',
  ),
  readyPublicProjection(
    'purchase_by_supplier',
    'از کدام تأمین‌کنندگان بیشتر خرید کرده‌ایم و سهم هرکدام چقدر است؟',
    'PURCHASE',
    'reporting.procurement.read',
    'reporting.travel.facts.v1',
  ),
  readyPublicProjection(
    'contract_service_profit',
    'کدام قراردادها و خدمات بیشترین یا کمترین سود را داشته‌اند؟',
    'CONTRACT_SERVICE',
    'reporting.finance.read',
    'reporting.travel.facts.v1',
  ),
  pending(
    'receivables_payables',
    'بیشترین مطالبات و بدهی شرکت مربوط به چه اشخاصی است؟',
    'JOURNAL',
    'reporting.finance.read',
    'reporting_counterparty_balance_facts_v1',
  ),
  pending(
    'account_balances',
    'موجودی و مانده هر حساب، بانک یا صندوق چقدر است؟',
    'JOURNAL',
    'reporting.finance.read',
    'reporting_account_balance_facts_v1',
  ),
  pending(
    'due_checks',
    'کدام چک‌ها به‌زودی سررسید می‌شوند یا معوق شده‌اند؟',
    'CHECK',
    'reporting.finance.read',
    'reporting_check_facts_v1',
  ),
  pending(
    'cash_position',
    'با وضعیت فعلی پرونده‌ها و تعهدات، شرکت نیاز به تزریق نقدینگی دارد یا امکان برداشت وجه وجود دارد؟',
    'JOURNAL',
    'reporting.finance.read',
    'reporting_cash_position_facts_v1',
  ),
  readyPublicProjection(
    'payments_refunds',
    'چه میزان دریافت تأییدشده از مشتری و استرداد قطعی انجام شده است؟',
    'PAYMENT',
    'reporting.finance.read',
    'sales.reporting.payment-events.v1',
  ),
  readyPublicProjection(
    'paid_not_issued',
    'کدام پرداخت‌های موفق هنوز به صدور خدمت منجر نشده‌اند؟',
    'RESERVATION',
    'reporting.reservations.read',
    'reporting.travel.facts.v1',
  ),
  readyPublicProjection(
    'reservation_errors',
    'بیشترین خطاهای رزرواسیون مربوط به کدام Provider یا عملیات است؟',
    'RESERVATION',
    'reporting.reservations.read',
    'reporting.travel.facts.v1',
  ),
  readyPublicProjection(
    'cancellations_refunds',
    'چه تعداد رزرو لغو یا Refund شده و علت اصلی آن چیست؟',
    'RESERVATION',
    'reporting.reservations.read',
    'reporting.travel.facts.v1',
  ),
  pending(
    'marketing_performance',
    'کدام کمپین بیشترین فروش و بازگشت سرمایه را ایجاد کرده است؟',
    'CAMPAIGN',
    'reporting.marketing.read',
    'reporting_campaign_facts_v1',
  ),
  pending(
    'customer_service_sla',
    'کدام درخواست‌های مشتری از SLA عبور کرده‌اند؟',
    'TICKET_SUPPORT',
    'reporting.customer_affairs.read',
    'reporting_support_ticket_facts_v1',
  ),
  pending(
    'hr_performance',
    'عملکرد و ظرفیت کاری کارکنان چگونه است؟',
    'EMPLOYEE',
    'reporting.hr.read',
    'reporting_employee_performance_facts_v1',
  ),
  readyPublicProjection(
    'tickets_manifest',
    'کدام پروازها و مسیرها بیشترین صدور و ظرفیت مصرف‌شده را دارند؟',
    'TICKET',
    'reporting.tickets.read',
    'reporting.travel.facts.v1',
  ),
  readyPublicProjection(
    'agency_performance',
    'کدام مشتریان B2B بیشترین فروش و سود را ایجاد کرده‌اند؟',
    'AGENCY',
    'reporting.b2b.read',
    'reporting.travel.facts.v1',
  ),
  readyPublicProjection(
    'lead_to_order_conversion',
    'هر منبع لید چه تعداد سفارش و چه میزان فروش ایجاد کرده است؟',
    'LEAD',
    'reporting.sales.read',
    'reporting.travel.facts.v1',
  ),
  readyPublicProjection(
    'route_passengers',
    'کدام مقصدها و مسیرهای سفر بیشترین سفارش و مسافر را داشته‌اند؟',
    'CONTRACT_CURRENCY',
    'reporting.sales.read',
    'sales.reporting.contract-currency.v1',
  ),
  readyPublicProjection(
    'sales_contract_pipeline',
    'قراردادهای فروش در هر مرحله چه تعداد و چه مبلغی دارند؟',
    'CONTRACT_CURRENCY',
    'reporting.sales.read',
    'sales.reporting.contract-currency.v1',
  ),
  pending(
    'export_audit',
    'چه کسی، چه گزارشی را با چه فیلترهایی خروجی گرفته است؟',
    'EXPORT_RUN',
    'reporting.audit.read',
    'reporting_export_audit_facts_v1',
  ),
];

const operationalTitles: Readonly<Record<string, string>> = {
  customer_service_sla:
    'مهلت پاسخ و رسیدگی درخواست‌ها در هر واحد چگونه رعایت شده است؟',
  workbench_due_actions: 'کدام پیگیری‌های شخصی تقویم من از موعد گذشته‌اند؟',
  hr_record_expiry: 'کدام سوابق کارکنان تاریخ انقضای گذشته یا نزدیک دارند؟',
  cancellations_refunds:
    'قراردادهای ایجادشده که اکنون باطل‌اند چه تعداد و چه مبلغی دارند؟',
  purchase_by_supplier: 'مبلغ خرید ثبت‌شده خدمات نزد هر تأمین‌کننده چقدر است؟',
  tickets_manifest: 'برای کدام قراردادها مدرک داخلی مسافر صادر شده است؟',
  hr_performance: 'حضور و وضعیت ثبت کارکرد کارکنان هر واحد چگونه است؟',
  export_audit: 'چه خروجی‌هایی توسط حساب من ایجاد شده و وضعیت آن‌ها چیست؟',
  reservation_delivery_readiness:
    'کدام پرونده‌ها وارد رزرواسیون شده‌اند و چند مسافر مدرک دارند؟',
  reservation_cycle_time:
    'از دریافت پرونده تا اولین صدور مدرک چند دقیقه گذشته است؟',
  hotel_rate_comparison: 'نرخ پایه ثبت‌شده هتل‌ها در هر بازه چقدر است؟',
};

const additionalCatalog = [
  pending(
    'agency_contract_risk',
    'کدام قراردادهای آژانس‌ها نیازمند پیگیری هستند؟',
    'AGENCY',
    'reporting.b2b.read',
    'reporting_agency_contract_risk_facts_v1',
  ),
  pending(
    'ticket_capacity',
    'ظرفیت کل، تخصیص‌یافته و باقی‌مانده هر پرواز چقدر است؟',
    'TICKET',
    'reporting.tickets.read',
    'reporting_ticket_capacity_facts_v1',
  ),
  pending(
    'supplier_payment_queue',
    'کدام تعهدات تأمین‌کنندگان در صف پرداخت هستند؟',
    'PURCHASE',
    'reporting.finance.read',
    'reporting_supplier_payment_queue_facts_v1',
  ),
  pending(
    'reservation_delivery_readiness',
    operationalTitles.reservation_delivery_readiness!,
    'RESERVATION',
    'reporting.reservations.read',
    'reporting_delivery_readiness_facts_v1',
  ),
  pending(
    'lead_pipeline',
    'سرنخ‌ها در کدام مرحله متوقف شده‌اند؟',
    'LEAD',
    'reporting.customer_affairs.read',
    'reporting_lead_pipeline_facts_v1',
  ),
  pending(
    'customer_satisfaction',
    'رضایت مشتریان در هر خدمت چگونه است؟',
    'TICKET_SUPPORT',
    'reporting.customer_affairs.read',
    'reporting_customer_satisfaction_facts_v1',
  ),
  pending(
    'customer_consent_coverage',
    'پوشش رضایت معتبر مشتریان چقدر است؟',
    'CUSTOMER',
    'reporting.customers.read',
    'reporting_customer_consent_facts_v1',
  ),
  pending(
    'document_compliance',
    'اسناد مجاز چه وضعیت تکمیل، اعتبار و اسکن دارند؟',
    'EXPORT_RUN',
    'reporting.audit.read',
    'reporting_document_compliance_facts_v1',
  ),
  pending(
    'hr_record_expiry',
    'کدام مدارک و قراردادهای کارکنان نزدیک انقضا هستند؟',
    'EMPLOYEE',
    'reporting.hr.read',
    'reporting_hr_record_expiry_facts_v1',
  ),
  pending(
    'workbench_due_actions',
    'کدام کارهای پیگیری در موعد مقرر انجام نشده‌اند؟',
    'TICKET_SUPPORT',
    'reporting.read',
    'reporting_workbench_due_actions_facts_v1',
  ),
  pending(
    'hotel_rate_comparison',
    operationalTitles.hotel_rate_comparison!,
    'RESERVATION',
    'reporting.reservations.read',
    'reporting_hotel_rate_facts_v1',
  ),
  pending(
    'future_travel_commitments',
    'تعهدات سفرهای آینده و وصول آن‌ها چقدر است؟',
    'CONTRACT_CURRENCY',
    'reporting.finance.read',
    'reporting_future_travel_facts_v1',
  ),
  pending(
    'customer_payment_aging',
    'کدام دریافتنی‌های مشتریان از سررسید گذشته‌اند؟',
    'PAYMENT',
    'reporting.finance.read',
    'reporting_payment_aging_facts_v1',
  ),
  pending(
    'reservation_cycle_time',
    operationalTitles.reservation_cycle_time!,
    'RESERVATION',
    'reporting.reservations.read',
    'reporting_reservation_cycle_facts_v1',
  ),
  pending(
    'manifest_finance_exclusions',
    'کدام مسافران از مانیفست مالی مستثنا شده‌اند؟',
    'PASSENGER',
    'reporting.finance.read',
    'reporting_manifest_exclusion_facts_v1',
  ),
  pending(
    'customer_portfolio_growth',
    'تعداد مشتریان ثبت‌شده در هر دوره چگونه تغییر کرده است؟',
    'CUSTOMER',
    'reporting.customers.read',
    'reporting_customer_growth_facts_v1',
  ),
];

export const REPORTING_CATALOG_V1: readonly ReportingCatalogEntryV1[] = [
  ...baseCatalog,
  ...additionalCatalog,
]
  .map((entry) => {
    if (NATIVE_SALES_REPORTS.has(entry.code))
      return {
        ...entry,
        producerStatus: 'READY' as const,
        approvedView: 'sales.reporting.contract-currency.v1',
        grain: 'CONTRACT' as const,
        version: entry.code === 'sales_by_organization' ? 4 : 2,
        ...(entry.code === 'agency_performance'
          ? { title: 'کدام مشتریان سازمانی بیشترین فروش قرارداد را داشته‌اند؟' }
          : {}),
        ...(entry.code === 'future_travel_commitments'
          ? {
              title: 'قراردادهای سفر آینده چه مبلغ فروشی دارند؟',
              permission: 'reporting.sales.read',
            }
          : {}),
      };
    const source = Object.hasOwn(OPERATIONAL_REPORTS, entry.code)
      ? OPERATIONAL_REPORTS[entry.code]
      : undefined;
    if (source)
      return {
        ...entry,
        title: operationalTitles[entry.code] ?? entry.title,
        producerStatus: 'READY' as const,
        approvedView: source.projection,
        grain: source.grain,
      };
    // A demo/staging table is never an operational producer.
    if (entry.approvedView === 'reporting.travel.facts.v1')
      return {
        ...entry,
        producerStatus: 'PENDING_CONNECTION' as const,
        approvedView: `reporting_${entry.code}_facts_v1`,
      };
    return entry;
  })
  .map((entry) =>
    entry.producerStatus === 'PENDING_CONNECTION' &&
    REPORT_READINESS[entry.code]
      ? { ...entry, readiness: REPORT_READINESS[entry.code]! }
      : entry,
  );
