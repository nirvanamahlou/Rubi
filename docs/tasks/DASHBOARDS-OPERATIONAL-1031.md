# DASHBOARDS-OPERATIONAL-1031

PC-C; base develop f3632a7a9. Owner requests continued production Dashboard finalization.
This task is not certification that every catalogue widget has an operational producer.

## Current evidence

### Production closeout, 2026-10-31

- PR1251 source8982acf3ea807c0669a00d7715688dc118ea6ff7 was merged by an
  external actor into develop de00baa4cb985857875036091ab29983ca34d1ce.
  All eight source checks and four merge checks succeeded before activation.
  This agent did not merge its own PR. The external merge preceded completion
  of all checks; publication waited for every check to pass.
- API/Web now run rubi-production:dashboard-1031-8982acf3ea80. The verified
  Dashboard-only overlay preserves existing Call Center changes, environments,
  mounts and Worker image. No migrations or business-data writes were performed.
- Fresh encrypted off-server backup was verified on the approved local destination
  and its isolated restore drill passed before publication. Rollback metadata and
  a verified deployment receipt are retained outside Git on the server.
- Post-publication actual deployed modules independently reconcile all eleven
  SQL aggregate checks in a read-only snapshot. Authenticated Demo production UI
  confirms real sales by currency, the corrected collection title, honest missing
  accounting/cost explanations and both labelled customer chart series.
- Validation:53 focused API tests;44 Web tests passed with one existing skip;
  scoped lint/types/build, isolated image tests and health/assets checks passed.
- This closes the bounded release, not all84 KPIs/91 visuals/28 pages. The source
  matrix below records the pre-release baseline and candidate scope; CANDIDATE
  implementations described above are now deployed. Remaining work is listed below.

- Verified SSH alias erp-server, host94.184.46.9, account codex-dev UID1002.
  Actual sudo policy now permits NOPASSWD ALL despite the supplied old description.
  No credential, key or production record is stored here.
- Active API/Web are independent Call Center overlays, not a clean develop image;
  Worker shares API networking. Preserve their actual image/configuration/environment
  and source changes. Never reuse the superseded1029 Dashboard release plan.
- Read-only actual deployed-module inventory covers all84 KPI definitions and91
  distinct visual definitions on28 pages, not just executive overview. Before this
  candidate,11 KPI IDs and9 visual IDs return native data under the authorized
  diagnostic scope. Other identifiers explicitly require sources or permissions.
- Independent SQL, in one repeatable-read read-only snapshot, reconciles gross/net
  sales, discounts, created/finalized contracts, Finance-confirmed receipt events,
  executed refunds, first/repeat paid buyers and the old lead-creation definition.
  Ten checks pass. No identities or monetary values are printed. This is an internal
  aggregate diagnostic, not authenticated HTTP or visual acceptance.

## Owner-confirmed Lead definition

New leads are created-in-window leads with no successful paid purchase before the
window end. A successful purchase uses both saved contract confirmation and a
Finance-confirmed receipt; a draft or merely scheduled payment cannot convert.
Match canonical customer IDs or an accepted Lead handoff's canonical contract ID.
Never infer identity from name or phone. Successful historical purchases remain
conversion evidence after later cancellation/refund; monetary revenue and refund
policies remain separate. New customers count distinct first paid-purchase buyers,
and returning customers count distinct previously successful buyers buying again.

Sales owns the bounded additive internal convertedLeadReferencesV1 boundary and
enforces its existing customers.read, sales.payments.read and own/branch/all scope.
Lead reads only its own branch-authorized leads and uses that public boundary.
Nonempty leads without conversion access remain unavailable rather than overstated;
empty authorized Lead rows yield a true zero without reading purchases. Purchase
and Lead limits fail closed; excessive handoffs/reference inputs do not truncate.
Lead growth compares those unconverted counts over equal preceding windows, each
evaluated at its own endpoint. A zero/missing denominator is unavailable, not 0%.

## Candidate changes

- Display a business explanation beside unavailable cards. Missing approved cost,
  missing posted accounting, zero denominator and general source/scope absence are
  distinct. Neither account definitions nor contract balances substitute for posted
  account/receivable amounts. Profit remains not calculable until its real source.
- Wire sales-weekday-pattern to existing Sales-owned net-sales observations;
  aggregate Tehran weekdays, preserve source currencies and numeric range checks.
  Do not mix monetary values and sales counts on one axis. Service chart copy now
  accurately distinguishes finalized net sales from Finance-confirmed collections.
- Isolate the API-absent test's environment instead of depending on image defaults.
  Production API configuration and security remain unchanged.
- Correct demonstrated chart defects: negative net amounts previously escaped
  the positive-only line scale or became positive minimum-width bars; comparison
  rendering silently dropped categories after12 and the compact combo after8.
  Signed zero-aware scales retain true zero width. Overflow/negative combo datasets
  use the existing scrollable comparison, retaining every category and exact labels.
- Authenticated production Demo UI inspection found a misleading executive card:
  collected was relabelled as period sales, so zero confirmed receipts appeared to
  contradict nonzero net sales. Keep the canonical collected title. Inspection also
  confirmed the customer-retention combo only plotted its first values array;
  render all named series as actual signed stacks with legends and every bucket.
  No moving-average substitute or eight-bucket truncation for multiple series.
- Candidate modules evaluated in memory against production inside a repeatable-read
  read-only transaction independently reconcile11 SQL checks, including mean sale
  value and the corrected unconverted-lead/purchase definitions. This probe writes
  no production source/configuration, and is not a completed deployment.
- No operational data write, permission grant, schema, migration, dependency or
  root contract change. Preserve every unmodified domain and runtime overlay.

## Remaining product work

1. Owner-public posted Finance/Accounting balance, receivable/payable, expense,
   commission and complete approved matched-cost sources. Do not replace them with
   purchase forms, bank definitions or contractual outstanding balances.
2. Owner-public operational Reservation/Inventory/Procurement status/capacity/queue
   measurements and meaningful as-of snapshots; current mutable status cannot be
   presented as an accurate historical baseline without evidence.
3. CRM conversion/cohort, SLA, satisfaction, consent, attribution, campaign and HR
   performance measurements with explicit grain and permissions. No travel-row
   proxies for actual employee calls, leads, tasks or accounting balances.
4. Remaining dimension breakdowns and drill-down reconciliation, respecting the
   approved independent currencies and composite-service allocation policy.
5. Authenticated actor/branch/filter browser reconciliation and actual rendering,
   including empty, forbidden and unavailable states. Mark manual acceptance (تست).

The matrix below is definition/source coverage, not a claim that every required
view exists. READY_BEFORE denotes deployed native coverage before this candidate;
CANDIDATE denotes the bounded new measurement, contingent on validation/deployment.

## KPI source matrix

| ID | Title | Native source coverage | Required definition source |
| --- | --- | --- | --- |
| employee-lead-count | تعداد لید کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-call-count | تعداد تماس کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-followup-count | تعداد پیگیری کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-finalized-sales-count | تعداد فروش کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-sales-amount | مبلغ فروش کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-lead-conversion | نرخ تبدیل لید کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-average-sale | میانگین مبلغ فروش کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-contract-count | تعداد قرارداد کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-cancellation-count | تعداد لغو کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-sales-rank | رتبه فروش کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| gross-sales | فروش ناخالص | READY_BEFORE | reporting_sales_contract_facts, reporting_contract_service_facts |
| net-sales | فروش خالص | READY_BEFORE | reporting_sales_contract_facts, reporting_contract_service_facts, reporting_payment_facts |
| collected | وصول | READY_BEFORE | reporting_payment_facts |
| refunded | استرداد | READY_BEFORE | reporting_payment_facts |
| gross-profit | سود ناخالص | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_contract_service_facts, reporting_purchase_request_facts |
| net-profit | سود خالص | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts |
| operating-expenses | هزینه‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts |
| paid-commissions | کمیسیون پرداختی | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts, reporting_payment_facts |
| receivables | مطالبات | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts |
| provider-payables | بدهی Provider | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_purchase_request_facts, reporting_journal_balance_facts |
| account-balance | مانده حساب | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts |
| new-orders | قراردادهای جدید | READY_BEFORE | reporting_sales_contract_facts |
| finalized-sales-count | تعداد فروش | READY_BEFORE | reporting_sales_contract_facts |
| average-sale-value | میانگین مبلغ هر فروش | READY_BEFORE | reporting_sales_contract_facts |
| discount-amount | تخفیف داده‌شده | READY_BEFORE | reporting_sales_contract_facts, reporting_contract_service_facts |
| awaiting-payment | در انتظار پرداخت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_payment_facts |
| awaiting-issue | در انتظار صدور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_reservation_facts |
| paid-not-issued | پرداخت موفق بدون صدور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_payment_facts, reporting_reservation_facts |
| issued-documents | اسناد صادرشده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_facts |
| cancelled-orders | قراردادهای لغوشده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts |
| cancelled-reservations | رزروهای لغوشده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_reservation_facts |
| average-ticket-price | متوسط قیمت بلیت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1, reporting_ticket_facts |
| ticket-cancellation-rate | نرخ لغو بلیت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1, reporting_ticket_facts |
| new-customers | مشتریان جدید | READY_BEFORE; revised purchase semantics | reporting_sales_contract_facts, reporting_payment_facts |
| returning-customers | مشتریان بازگشتی | READY_BEFORE; revised purchase semantics | reporting_sales_contract_facts, reporting_payment_facts |
| customer-interest-coverage | مشتریان دارای علاقه ثبت‌شده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting_sales_contract_facts, reporting_contract_service_facts |
| customer-destination-demand | سفارش‌های دارای مقصد | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| customer-service-usage | مشتریان استفاده‌کننده از خدمات | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| customers-by-acquisition-channel | مشتریان منتسب به کانال جذب | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_portfolio_growth_facts_v1 |
| open-tickets | Ticketهای باز | OWNER_PUBLIC_SOURCE_REQUIRED | approved_customer_affairs_ticket_projection |
| overdue-tasks | وظایف عقب‌افتاده | OWNER_PUBLIC_SOURCE_REQUIRED | approved_task_projection |
| due-checks | چک‌های نزدیک سررسید | OWNER_PUBLIC_SOURCE_REQUIRED | approved_finance_check_projection |
| collection-rate | نرخ وصول | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_payment_facts |
| refund-rate | نرخ استرداد | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_payment_facts, reporting.travel.facts.v1 |
| pipeline-age | میانگین توقف در مرحله | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_pipeline_facts_v1 |
| reservation-failure-rate | نرخ خطای رزرو | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| delivery-blockers | رزروهای دارای مانع تحویل | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_reservation_delivery_readiness_facts_v1 |
| issue-success-rate | نرخ موفقیت صدور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| active-offers | پیشنهادهای فعال سفر | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| sell-through-rate | نرخ تکمیل ظرفیت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| remaining-capacity | ظرفیت باقی‌مانده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| low-capacity-offers | عرضه‌های نزدیک تکمیل | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| tour-reservations | تعداد رزرو تور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| tour-remaining-capacity | ظرفیت باقی‌مانده تور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_contract_service_facts, reporting_ticket_capacity_facts_v1 |
| tour-sell-through-rate | درصد تکمیل ظرفیت تور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_contract_service_facts, reporting_ticket_capacity_facts_v1 |
| hotel-reservations | تعداد رزرو هتل | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| average-stay-length | میانگین اقامت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| supplier-spend | خرید خالص تأییدشده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| pending-supplier-payments | خریدهای منتظر پرداخت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_supplier_payment_queue_facts_v1 |
| supplier-payment-wait | میانگین انتظار پرداخت تأمین‌کننده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_supplier_payment_queue_facts_v1 |
| overdue-balance | مانده سررسیدگذشته | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| lead-volume | لیدهای فعال | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1 |
| new-leads | لیدهای جدید | READY_BEFORE; revised purchase semantics | reporting_customer_affairs_lead_facts_v1 |
| lead-growth-rate | نرخ رشد لیدها | CANDIDATE: denominator required | reporting_customer_affairs_lead_facts_v1 |
| lead-conversion-rate | نرخ تبدیل لید به سفارش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| overdue-followups | پیگیری‌های عقب‌افتاده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1 |
| sla-breach-rate | نرخ نقض SLA | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_support_ticket_facts_v1 |
| first-response-time | میانگین زمان پاسخ نخست | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_support_ticket_facts_v1 |
| low-satisfaction | رضایت پایین نیازمند اقدام | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_satisfaction_facts_v1 |
| agency-sales | فروش آژانس‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| agency-profit | سود ناخالص آژانس‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| credit-at-risk | اعتبار در معرض ریسک | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_b2b_agency_risk_facts_v1 |
| expiring-guarantees | تضمین‌های نزدیک انقضا | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_b2b_agency_risk_facts_v1 |
| attributed-sales | فروش منتسب به کمپین | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1 |
| advertising-spend | هزینه تبلیغات | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1 |
| campaign-conversion | نرخ تبدیل کمپین | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1 |
| campaign-roas | بازده هزینه تبلیغات | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1 |
| consent-coverage | پوشش رضایت بازاریابی | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_consent_facts_v1 |
| employee-workdays | روزهای کارکرد | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_performance_facts_v1 |
| employee-leave | بار مرخصی | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_performance_facts_v1 |
| employee-overtime | اضافه‌کاری | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_performance_facts_v1 |
| employee-performance | امتیاز ارزیابی عملکرد | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_performance_facts_v1 |
| expiring-hr-records | سوابق نزدیک انقضا | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_hr_record_expiry_facts_v1 |
| incomplete-hr-records | سوابق ناقص کارکنان | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_hr_record_expiry_facts_v1 |

## Visual source matrix

| ID | Title | Native source coverage | Required definition source |
| --- | --- | --- | --- |
| executive-trend | روند فروش، وصول و سود | READY_BEFORE | reporting.travel.facts.v1 |
| executive-sales-by-service | فروش بر اساس نوع خدمت | READY_BEFORE | reporting.travel.facts.v1, reporting_payment_facts |
| executive-customer-retention | مشتریان جدید و بازگشتی | READY_BEFORE | reporting_sales_contract_facts, reporting_payment_facts |
| executive-exceptions | استثناهای نیازمند تصمیم | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1, reporting_reservation_delivery_readiness_facts_v1, reporting_supplier_payment_queue_facts_v1 |
| finalized-sales-trend | روند مبلغ و تعداد فروش | READY_BEFORE | reporting_sales_contract_facts, reporting.travel.facts.v1 |
| sales-channel | کانال فروش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| service-type | درآمد به تفکیک نوع خدمت | READY_BEFORE | reporting.travel.facts.v1 |
| commercial-pipeline | قیف و عمر قراردادها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_pipeline_facts_v1 |
| sales-collection-trend | روند فروش و وصول | READY_BEFORE | reporting_sales_contract_facts, reporting_payment_facts |
| collection-status | وضعیت تسویه قراردادها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_payment_facts |
| overdue-counterparties | مطالبات سررسیدگذشته | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| refund-by-service | استرداد به تفکیک نوع خدمت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_payment_facts, reporting.travel.facts.v1 |
| issue-funnel | قیف عملیات | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_payment_facts, reporting_reservation_facts, reporting_ticket_facts |
| issue-alerts | استثناهای صدور | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_reservation_facts, reporting_ticket_facts |
| provider-failure-rate | نرخ خطا به تفکیک Provider | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| inventory-capacity | مصرف ظرفیت به تفکیک مسیر | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| inventory-departure-curve | ظرفیت تا تاریخ حرکت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| inventory-action-queue | عرضه‌های نیازمند اقدام | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| supplier-spend-share | سهم خرید تأمین‌کنندگان | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| supplier-payment-status | وضعیت پرداخت خریدها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_supplier_payment_queue_facts_v1 |
| supplier-action-queue | صف تعهدات تأمین‌کننده | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_supplier_payment_queue_facts_v1, reporting_reservation_delivery_readiness_facts_v1 |
| hotel-rate-comparison | مقایسه نرخ خرید هتل | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_hotel_rate_comparison_facts_v1 |
| treasury-flow | گردش خزانه | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_payment_facts, reporting_journal_balance_facts |
| finance-profit-trend | روند درآمد و سود | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_contract_service_facts, reporting_journal_balance_facts |
| counterparty-exposure | ریسک طرف‌حساب‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| due-checks-queue | اولویت چک‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | approved_finance_check_projection |
| customer-growth-overview | روند جذب تا سفارش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| customer-source-quality | کیفیت منابع جذب | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| customer-trust-guardrails | رضایت و کیفیت خدمت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_consent_facts_v1, reporting_support_ticket_facts_v1, reporting_customer_satisfaction_facts_v1 |
| crm-funnel | قیف CRM | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting_sales_contract_pipeline_facts_v1 |
| lead-source-conversion | تبدیل به تفکیک منبع لید | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| crm-followup-queue | فرصت‌های نیازمند پیگیری | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting_sales_contract_pipeline_facts_v1 |
| support-breakdown | ترکیب حجم و SLA | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_support_ticket_facts_v1 |
| support-time-trend | روند زمان پاسخ و حل | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_support_ticket_facts_v1 |
| support-recovery-queue | اقدام‌های اصلاحی باز | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_support_ticket_facts_v1, reporting_customer_satisfaction_facts_v1 |
| partner-performance | فروش و سود شرکا | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| partner-credit-risk | ریسک قرارداد و اعتبار | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_b2b_agency_risk_facts_v1 |
| partner-action-queue | قراردادهای نیازمند اقدام | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_b2b_agency_risk_facts_v1 |
| campaign-performance | قیف تعامل کمپین | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1, reporting_customer_consent_facts_v1 |
| campaign-value | فروش منتسب و ROAS | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1 |
| advertising-spend-by-channel | هزینه تبلیغات به تفکیک کانال | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_campaign_facts_v1 |
| consent-coverage-chart | پوشش رضایت به تفکیک کانال | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_consent_facts_v1 |
| workforce-capacity | ظرفیت کارکرد واحدها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_performance_facts_v1 |
| workforce-performance | روند عملکرد و فشار کاری | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_performance_facts_v1 |
| employee-sales-count-by-agent | تعداد فروش کارشناسان | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-sales-amount-by-agent | مبلغ فروش کارشناسان | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-conversion-by-agent | نرخ تبدیل لید به فروش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-performance-ranking | مقایسه عملکرد کارشناسان | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| task-automation-queue | صف وظایف و اجراها | OWNER_PUBLIC_SOURCE_REQUIRED | approved_task_projection, approved_automation_run_projection |
| document-quality-overview | سلامت اسناد | OWNER_PUBLIC_SOURCE_REQUIRED | approved_document_quality_projection |
| report-data-quality-overview | کیفیت گزارش و داده | OWNER_PUBLIC_SOURCE_REQUIRED | approved_reporting_quality_projection |
| executive-lead-acquisition | روند روزانه جذب لید | READY_BEFORE | reporting_customer_affairs_lead_facts_v1 |
| executive-lead-conversion | تبدیل لید به فروش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| executive-reservation-cancellations | روند و دلایل لغو رزرو | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_reservation_facts |
| executive-cash-exposure | ترکیب مطالبات و بدهی‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| average-sale-trend | روند میانگین مبلغ فروش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts |
| discount-analysis | تخفیف به تفکیک کارشناس و خدمت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| discount-trend | روند تخفیف داده‌شده | READY_BEFORE | reporting_sales_contract_facts, reporting_contract_service_facts |
| service-sales-portfolio | سهم و رتبه خدمات از فروش | READY_BEFORE | reporting.travel.facts.v1 |
| agent-ranking | عملکرد کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts |
| sales-weekday-pattern | مبلغ فروش روزهای هفته | CANDIDATE | reporting_sales_contract_facts |
| sales-destination-ranking | مقصدها و شهرهای پرفروش | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| sales-country-ranking | فروش بر اساس کشور مقصد | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts |
| sales-channel-trend | روند فروش کانال‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| airline-sales-performance | فروش و سهم هر ایرلاین | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| route-sales-performance | فروش و تردد مسیرها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| average-ticket-price-trend | روند متوسط قیمت بلیت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1, reporting_ticket_facts |
| ticket-cancellation-analysis | نرخ لغو بلیت به تفکیک ایرلاین | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1, reporting_ticket_facts |
| tour-sales-ranking | فروش و رزرو تورها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| tour-capacity-performance | ظرفیت تورها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_contract_service_facts, reporting_ticket_capacity_facts_v1 |
| hotel-sales-ranking | فروش و رزرو هتل‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| popular-hotel-cities | شهرهای محبوب اقامت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| average-stay-analysis | میانگین شب اقامت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| gross-profit-by-service | سود ناخالص به تفکیک خدمت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| expense-structure | ساختار هزینه‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts |
| expense-trend | روند مجموع هزینه‌ها | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts |
| paid-commission-by-recipient | کمیسیون پرداختی به تفکیک ذی‌نفع | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts, reporting_payment_facts |
| paid-commission-trend | روند کمیسیون پرداختی | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_journal_balance_facts, reporting_payment_facts |
| customer-debt-aging | بدهی مشتریان و سررسید | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_payment_aging_facts_v1 |
| customer-interest-distribution | علایق ثبت‌شده مشتریان | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| customer-destination-distribution | مشتریان و تقاضا بر اساس مقصد | OWNER_PUBLIC_SOURCE_REQUIRED | reporting.travel.facts.v1 |
| customer-service-distribution | مشتریان بر اساس نوع خدمت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts, reporting.travel.facts.v1 |
| customer-acquisition-channel-mix | ترکیب مشتریان بر اساس کانال جذب | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_portfolio_growth_facts_v1 |
| customer-acquisition-channel-trend | روند جذب مشتری به تفکیک کانال | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_customer_portfolio_growth_facts_v1 |
| workforce-compliance-queue | سوابق پرسنلی نیازمند اقدام | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_hr_record_expiry_facts_v1 |
| employee-leads-by-agent | لیدها به تفکیک کارشناس | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-calls-by-agent | تماس‌ها و تماس‌های موفق | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-followups-by-agent | پیگیری‌ها و موارد معوق | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| employee-average-sale-by-agent | میانگین مبلغ فروش | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-contracts-by-agent | قراردادهای ثبت‌شده و نهایی | OWNER_PUBLIC_SOURCE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| employee-cancellations-by-agent | لغوها به تفکیک کارشناس و علت | OWNER_PUBLIC_SOURCE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
