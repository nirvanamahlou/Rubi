import type { ReportingGrain } from './reporting.contracts';

export interface ReportingCatalogEntryV1 {
  code: string;
  title: string;
  grain: ReportingGrain;
  permission: string;
  producerStatus: 'PENDING_CONNECTION' | 'READY';
  approvedView: string;
  outputs: readonly ['XLSX', 'PDF', 'CSV', 'API'];
  version: number;
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
    producerStatus: 'PENDING_CONNECTION',
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
    producerStatus: 'READY',
    version,
  };
}

export const REPORTING_CATALOG_V1: readonly ReportingCatalogEntryV1[] = [
  readyPublicProjection(
    'sales_by_organization',
    'کدام شرکت، سایت، شعبه یا کارشناس بیشترین فروش را ایجاد کرده است؟',
    'CONTRACT_CURRENCY',
    'reporting.sales.read',
    'sales.reporting.organization.v2',
    2,
  ),
  readyPublicProjection(
    'sales_by_service_route',
    'کدام خدمت، مسیر یا شهر مقصد بیشترین فروش را ایجاد کرده است؟',
    'CONTRACT_SERVICE',
    'reporting.sales.read',
    'reporting.travel.facts.v1',
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
  readyPublicProjection(
    'payments_refunds',
    'چه میزان دریافت، پرداخت و استرداد انجام شده است؟',
    'PAYMENT',
    'reporting.finance.read',
    'reporting.travel.facts.v1',
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
    'کدام آژانس‌ها و مشتریان سازمانی بیشترین فروش و سود را ایجاد کرده‌اند؟',
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
    'PASSENGER',
    'reporting.sales.read',
    'reporting.travel.facts.v1',
  ),
  pending(
    'export_audit',
    'چه کسی، چه گزارشی را با چه فیلترهایی خروجی گرفته است؟',
    'EXPORT_RUN',
    'reporting.audit.read',
    'reporting_export_audit_facts_v1',
  ),
];
