# DASHBOARD-READINESS-1103

PC-C; base60e18a750. Owner authorizes production readiness review, supported widget activation, PR to develop and merge only after every final-head CI gate succeeds. No migration, dependency, IAM or business-data write.

## Read-only evidence — 2026-11-03

- Entire public schema profiled:316 tables,3985 columns,712 FKs,1197 indexes. Counts and SQL/catalog definitions retained privately in F:/ERP-Backups/Rubi/dashboard-{schema-audit,structure,quality}-1103.*. No passenger, contact, credential or monetary value printed.
-353 contracts,399 reservation intakes,328 purchase rows,1263 customer identities,19 HR employees,849 HR records and153 calls exist. These records do not automatically satisfy each KPI definition.
- All4 payment entries remain PENDING_FINANCE_CONFIRMATION. No confirmed receipt or missing confirmed-account violation. No automatic approvals performed.
- Accounting books/journals/lines, approved Finance cost revisions, operational finance requests, automation tasks, Customer Affairs leads and reporting_travel_facts have0 rows. Missing approved cost is not zero.
- One existing NOT VALID CHECK requires finance_receipt_account_id for confirmed payments; current violation count0. Historical constraint validation belongs to Finance/migration owner; no constraint changed. All catalog FKs are validated; this is catalog evidence, not a complete semantic row audit.
- Deployed native-module review:11/84 catalog KPI IDs and10/91 visuals produce a projection; sources are ready under a broad read-only diagnostic scope. Lead growth is additionally supported but its current zero baseline correctly withholds a percentage. This is not authenticated role acceptance.
- Independent repeatable-read SQL reconciles all11 source aggregates for the current Tehran calendar month: gross/net/discount,average sale,new/finalized orders,confirmed receipts,executed refunds,first/repeat buyers,unconverted leads.

## Implementation

- customer-growth-overview: independent daily counts of unconverted leads,first paid buyers and created orders; explicitly not a conversion-rate/cohort funnel. Forbidden sources are omitted and identified, never zero-filled.
- finance-profit-trend: authorized net sales by source currency; gross/net-profit series withheld with explicit missing-source notice until their authoritative producers exist. This is partial financial coverage, not completed profitability.
- Existing period/branch/filter permissions, Tehran calendar and public owner projections retained. Web descriptions and two English catalogue entries updated.

## Remaining priorities

1. Finance must review/confirm real receipts through ordinary workflow. Posted Accounting balances,complete approved matched costs,expenses,commissions,receivable/payable aging and opening balances need owning public measurement; purchase records/bank definitions are not substitutes.
2. Reservations/Inventory/Procurement public status,capacity,issuance,cancellation,route/hotel/provider/purchase and due-obligation projections; preserve real FK attribution and snapshot/as-of semantics.
3. Sales public dimensions for agent/channel/destination/airline and discount allocation. All monetary series remain independent by currency; composite contracts count once.
4. CRM/Support/Marketing public cohort-conversion,SLA,satisfaction,consent,attribution and campaign-cost sources; zero actual leads cannot support invented conversion rates or ROAS.
5. HR/Call Center/Tasks/Documents public aggregates scoped to each role; current operational data exists but no approved generic Dashboard projection. Do not repurpose private tables or commercial reporting facts.
6. Sparse average-sale trend needs a null-aware chart contract or other explicit no-denominator display; never draw zero as a missing average.
7. Reconcile each new producer and drill-down by actor/branch/date/currency (تست). Run actual company-user browser acceptance and period/empty/denial cases (تست).
8. Final-head CI,verified merge,backed-up pinned deployment,post-release SQL/HTTP/UI checks and rollback receipt. Release evidence is appended after execution.

## Full registry coverage

READY means current broad diagnostic scope; it is not universal user authorization. CANDIDATE means the new code awaits release. Sources below are declared owner-public contracts, not direct table bindings.

| Kind | ID | Title | Status | Declared sources |
| --- | --- | --- | --- | --- |
| KPI | employee-lead-count | تعداد لید کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-call-count | تعداد تماس کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-followup-count | تعداد پیگیری کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-finalized-sales-count | تعداد فروش کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-sales-amount | مبلغ فروش کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-lead-conversion | نرخ تبدیل لید کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-average-sale | میانگین مبلغ فروش کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-contract-count | تعداد قرارداد کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-cancellation-count | تعداد لغو کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_commercial_activity_facts_v1 |
| KPI | employee-sales-rank | رتبه فروش کارشناس | SOURCE_OR_SCOPE_UNAVAILABLE | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| KPI | gross-sales | فروش ناخالص | READY | reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | net-sales | فروش خالص | READY | reporting_sales_contract_facts, reporting_contract_service_facts, reporting_payment_facts |
| KPI | collected | وصول | READY | reporting_payment_facts |
| KPI | refunded | استرداد | READY | reporting_payment_facts |
| KPI | gross-profit | سود ناخالص | APPROVED_MATCHED_COST_REQUIRED | reporting_contract_service_facts, reporting_purchase_request_facts |
| KPI | net-profit | سود خالص | POSTED_ACCOUNTING_SOURCE_REQUIRED | reporting_journal_balance_facts |
| KPI | operating-expenses | هزینه‌ها | POSTED_ACCOUNTING_SOURCE_REQUIRED | reporting_journal_balance_facts |
| KPI | paid-commissions | کمیسیون پرداختی | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_journal_balance_facts, reporting_payment_facts |
| KPI | receivables | مطالبات | POSTED_ACCOUNTING_SOURCE_REQUIRED | reporting_journal_balance_facts |
| KPI | provider-payables | بدهی Provider | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_purchase_request_facts, reporting_journal_balance_facts |
| KPI | account-balance | مانده حساب | POSTED_ACCOUNTING_SOURCE_REQUIRED | reporting_journal_balance_facts |
| KPI | new-orders | قراردادهای جدید | READY | reporting_sales_contract_facts |
| KPI | finalized-sales-count | تعداد فروش | READY | reporting_sales_contract_facts |
| KPI | average-sale-value | میانگین مبلغ هر فروش | READY | reporting_sales_contract_facts |
| KPI | discount-amount | تخفیف داده‌شده | READY | reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | awaiting-payment | در انتظار پرداخت | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts, reporting_payment_facts |
| KPI | awaiting-issue | در انتظار صدور | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_reservation_facts |
| KPI | paid-not-issued | پرداخت موفق بدون صدور | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_payment_facts, reporting_reservation_facts |
| KPI | issued-documents | اسناد صادرشده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_ticket_facts |
| KPI | cancelled-orders | قراردادهای لغوشده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts |
| KPI | cancelled-reservations | رزروهای لغوشده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_reservation_facts |
| KPI | average-ticket-price | متوسط قیمت بلیت | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1, reporting_ticket_facts |
| KPI | ticket-cancellation-rate | نرخ لغو بلیت | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1, reporting_ticket_facts |
| KPI | new-customers | مشتریان جدید | READY | reporting_sales_contract_facts, reporting_payment_facts |
| KPI | returning-customers | مشتریان بازگشتی | READY | reporting_sales_contract_facts, reporting_payment_facts |
| KPI | customer-interest-coverage | مشتریان دارای علاقه ثبت‌شده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_affairs_lead_facts_v1, reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | customer-destination-demand | سفارش‌های دارای مقصد | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1 |
| KPI | customer-service-usage | مشتریان استفاده‌کننده از خدمات | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | customers-by-acquisition-channel | مشتریان منتسب به کانال جذب | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_portfolio_growth_facts_v1 |
| KPI | open-tickets | Ticketهای باز | SOURCE_OR_SCOPE_UNAVAILABLE | approved_customer_affairs_ticket_projection |
| KPI | overdue-tasks | وظایف عقب‌افتاده | SOURCE_OR_SCOPE_UNAVAILABLE | approved_task_projection |
| KPI | due-checks | چک‌های نزدیک سررسید | SOURCE_OR_SCOPE_UNAVAILABLE | approved_finance_check_projection |
| KPI | collection-rate | نرخ وصول | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts, reporting_payment_facts |
| KPI | refund-rate | نرخ استرداد | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_payment_facts, reporting.travel.facts.v1 |
| KPI | pipeline-age | میانگین توقف در مرحله | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_pipeline_facts_v1 |
| KPI | reservation-failure-rate | نرخ خطای رزرو | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1 |
| KPI | delivery-blockers | رزروهای دارای مانع تحویل | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_reservation_delivery_readiness_facts_v1 |
| KPI | issue-success-rate | نرخ موفقیت صدور | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1 |
| KPI | active-offers | پیشنهادهای فعال سفر | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_ticket_capacity_facts_v1 |
| KPI | sell-through-rate | نرخ تکمیل ظرفیت | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_ticket_capacity_facts_v1 |
| KPI | remaining-capacity | ظرفیت باقی‌مانده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_ticket_capacity_facts_v1 |
| KPI | low-capacity-offers | عرضه‌های نزدیک تکمیل | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_ticket_capacity_facts_v1 |
| KPI | tour-reservations | تعداد رزرو تور | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | tour-remaining-capacity | ظرفیت باقی‌مانده تور | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_contract_service_facts, reporting_ticket_capacity_facts_v1 |
| KPI | tour-sell-through-rate | درصد تکمیل ظرفیت تور | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_contract_service_facts, reporting_ticket_capacity_facts_v1 |
| KPI | hotel-reservations | تعداد رزرو هتل | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | average-stay-length | میانگین اقامت | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_sales_contract_facts, reporting_contract_service_facts |
| KPI | supplier-spend | خرید خالص تأییدشده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1 |
| KPI | pending-supplier-payments | خریدهای منتظر پرداخت | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_supplier_payment_queue_facts_v1 |
| KPI | supplier-payment-wait | میانگین انتظار پرداخت تأمین‌کننده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_supplier_payment_queue_facts_v1 |
| KPI | overdue-balance | مانده سررسیدگذشته | POSTED_ACCOUNTING_SOURCE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| KPI | lead-volume | لیدهای فعال | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_affairs_lead_facts_v1 |
| KPI | new-leads | لیدهای جدید | READY | reporting_customer_affairs_lead_facts_v1 |
| KPI | lead-growth-rate | نرخ رشد لیدها | ZERO_DENOMINATOR | reporting_customer_affairs_lead_facts_v1 |
| KPI | lead-conversion-rate | نرخ تبدیل لید به سفارش | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| KPI | overdue-followups | پیگیری‌های عقب‌افتاده | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_affairs_lead_facts_v1 |
| KPI | sla-breach-rate | نرخ نقض SLA | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_support_ticket_facts_v1 |
| KPI | first-response-time | میانگین زمان پاسخ نخست | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_support_ticket_facts_v1 |
| KPI | low-satisfaction | رضایت پایین نیازمند اقدام | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_satisfaction_facts_v1 |
| KPI | agency-sales | فروش آژانس‌ها | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1 |
| KPI | agency-profit | سود ناخالص آژانس‌ها | SOURCE_OR_SCOPE_UNAVAILABLE | reporting.travel.facts.v1 |
| KPI | credit-at-risk | اعتبار در معرض ریسک | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_b2b_agency_risk_facts_v1 |
| KPI | expiring-guarantees | تضمین‌های نزدیک انقضا | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_b2b_agency_risk_facts_v1 |
| KPI | attributed-sales | فروش منتسب به کمپین | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_campaign_facts_v1 |
| KPI | advertising-spend | هزینه تبلیغات | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_campaign_facts_v1 |
| KPI | campaign-conversion | نرخ تبدیل کمپین | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_campaign_facts_v1 |
| KPI | campaign-roas | بازده هزینه تبلیغات | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_campaign_facts_v1 |
| KPI | consent-coverage | پوشش رضایت بازاریابی | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_customer_consent_facts_v1 |
| KPI | employee-workdays | روزهای کارکرد | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_performance_facts_v1 |
| KPI | employee-leave | بار مرخصی | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_performance_facts_v1 |
| KPI | employee-overtime | اضافه‌کاری | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_performance_facts_v1 |
| KPI | employee-performance | امتیاز ارزیابی عملکرد | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_employee_performance_facts_v1 |
| KPI | expiring-hr-records | سوابق نزدیک انقضا | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_hr_record_expiry_facts_v1 |
| KPI | incomplete-hr-records | سوابق ناقص کارکنان | SOURCE_OR_SCOPE_UNAVAILABLE | reporting_hr_record_expiry_facts_v1 |
| Visual | executive-trend | روند فروش، وصول و سود | READY | reporting.travel.facts.v1 |
| Visual | executive-sales-by-service | فروش بر اساس نوع خدمت | READY | reporting.travel.facts.v1, reporting_payment_facts |
| Visual | executive-customer-retention | مشتریان جدید و بازگشتی | READY | reporting_sales_contract_facts, reporting_payment_facts |
| Visual | executive-exceptions | استثناهای نیازمند تصمیم | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1, reporting_reservation_delivery_readiness_facts_v1, reporting_supplier_payment_queue_facts_v1 |
| Visual | finalized-sales-trend | روند مبلغ و تعداد فروش | READY | reporting_sales_contract_facts, reporting.travel.facts.v1 |
| Visual | sales-channel | کانال فروش | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | service-type | درآمد به تفکیک نوع خدمت | READY | reporting.travel.facts.v1 |
| Visual | commercial-pipeline | قیف و عمر قراردادها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_pipeline_facts_v1 |
| Visual | sales-collection-trend | روند فروش و وصول | READY | reporting_sales_contract_facts, reporting_payment_facts |
| Visual | collection-status | وضعیت تسویه قراردادها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_payment_facts |
| Visual | overdue-counterparties | مطالبات سررسیدگذشته | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| Visual | refund-by-service | استرداد به تفکیک نوع خدمت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_payment_facts, reporting.travel.facts.v1 |
| Visual | issue-funnel | قیف عملیات | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_payment_facts, reporting_reservation_facts, reporting_ticket_facts |
| Visual | issue-alerts | استثناهای صدور | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_reservation_facts, reporting_ticket_facts |
| Visual | provider-failure-rate | نرخ خطا به تفکیک Provider | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | inventory-capacity | مصرف ظرفیت به تفکیک مسیر | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| Visual | inventory-departure-curve | ظرفیت تا تاریخ حرکت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| Visual | inventory-action-queue | عرضه‌های نیازمند اقدام | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_ticket_capacity_facts_v1 |
| Visual | supplier-spend-share | سهم خرید تأمین‌کنندگان | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | supplier-payment-status | وضعیت پرداخت خریدها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_supplier_payment_queue_facts_v1 |
| Visual | supplier-action-queue | صف تعهدات تأمین‌کننده | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_supplier_payment_queue_facts_v1, reporting_reservation_delivery_readiness_facts_v1 |
| Visual | hotel-rate-comparison | مقایسه نرخ خرید هتل | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_hotel_rate_comparison_facts_v1 |
| Visual | treasury-flow | گردش خزانه | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_payment_facts, reporting_journal_balance_facts |
| Visual | finance-profit-trend | روند درآمد و سود | CANDIDATE_PARTIAL_SOURCE_AWARE | reporting_contract_service_facts, reporting_journal_balance_facts |
| Visual | counterparty-exposure | ریسک طرف‌حساب‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| Visual | due-checks-queue | اولویت چک‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | approved_finance_check_projection |
| Visual | customer-growth-overview | روند جذب تا سفارش | CANDIDATE_PARTIAL_SOURCE_AWARE | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| Visual | customer-source-quality | کیفیت منابع جذب | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | customer-trust-guardrails | رضایت و کیفیت خدمت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_consent_facts_v1, reporting_support_ticket_facts_v1, reporting_customer_satisfaction_facts_v1 |
| Visual | crm-funnel | قیف CRM | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting_sales_contract_pipeline_facts_v1 |
| Visual | lead-source-conversion | تبدیل به تفکیک منبع لید | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| Visual | crm-followup-queue | فرصت‌های نیازمند پیگیری | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting_sales_contract_pipeline_facts_v1 |
| Visual | support-breakdown | ترکیب حجم و SLA | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_support_ticket_facts_v1 |
| Visual | support-time-trend | روند زمان پاسخ و حل | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_support_ticket_facts_v1 |
| Visual | support-recovery-queue | اقدام‌های اصلاحی باز | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_support_ticket_facts_v1, reporting_customer_satisfaction_facts_v1 |
| Visual | partner-performance | فروش و سود شرکا | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | partner-credit-risk | ریسک قرارداد و اعتبار | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_b2b_agency_risk_facts_v1 |
| Visual | partner-action-queue | قراردادهای نیازمند اقدام | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_b2b_agency_risk_facts_v1 |
| Visual | campaign-performance | قیف تعامل کمپین | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_campaign_facts_v1, reporting_customer_consent_facts_v1 |
| Visual | campaign-value | فروش منتسب و ROAS | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_campaign_facts_v1 |
| Visual | advertising-spend-by-channel | هزینه تبلیغات به تفکیک کانال | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_campaign_facts_v1 |
| Visual | consent-coverage-chart | پوشش رضایت به تفکیک کانال | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_consent_facts_v1 |
| Visual | workforce-capacity | ظرفیت کارکرد واحدها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_performance_facts_v1 |
| Visual | workforce-performance | روند عملکرد و فشار کاری | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_performance_facts_v1 |
| Visual | employee-sales-count-by-agent | تعداد فروش کارشناسان | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-sales-amount-by-agent | مبلغ فروش کارشناسان | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-conversion-by-agent | نرخ تبدیل لید به فروش | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-performance-ranking | مقایسه عملکرد کارشناسان | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| Visual | task-automation-queue | صف وظایف و اجراها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | approved_task_projection, approved_automation_run_projection |
| Visual | document-quality-overview | سلامت اسناد | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | approved_document_quality_projection |
| Visual | report-data-quality-overview | کیفیت گزارش و داده | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | approved_reporting_quality_projection |
| Visual | executive-lead-acquisition | روند روزانه جذب لید | READY | reporting_customer_affairs_lead_facts_v1 |
| Visual | executive-lead-conversion | تبدیل لید به فروش | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| Visual | executive-reservation-cancellations | روند و دلایل لغو رزرو | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_reservation_facts |
| Visual | executive-cash-exposure | ترکیب مطالبات و بدهی‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_counterparty_balance_facts_v1 |
| Visual | average-sale-trend | روند میانگین مبلغ فروش | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts |
| Visual | discount-analysis | تخفیف به تفکیک کارشناس و خدمت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| Visual | discount-trend | روند تخفیف داده‌شده | READY | reporting_sales_contract_facts, reporting_contract_service_facts |
| Visual | service-sales-portfolio | سهم و رتبه خدمات از فروش | READY | reporting.travel.facts.v1 |
| Visual | agent-ranking | عملکرد کارشناس | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts |
| Visual | sales-weekday-pattern | مبلغ فروش روزهای هفته | READY | reporting_sales_contract_facts |
| Visual | sales-destination-ranking | مقصدها و شهرهای پرفروش | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | sales-country-ranking | فروش بر اساس کشور مقصد | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts |
| Visual | sales-channel-trend | روند فروش کانال‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | airline-sales-performance | فروش و سهم هر ایرلاین | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | route-sales-performance | فروش و تردد مسیرها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | average-ticket-price-trend | روند متوسط قیمت بلیت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1, reporting_ticket_facts |
| Visual | ticket-cancellation-analysis | نرخ لغو بلیت به تفکیک ایرلاین | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1, reporting_ticket_facts |
| Visual | tour-sales-ranking | فروش و رزرو تورها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| Visual | tour-capacity-performance | ظرفیت تورها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_contract_service_facts, reporting_ticket_capacity_facts_v1 |
| Visual | hotel-sales-ranking | فروش و رزرو هتل‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| Visual | popular-hotel-cities | شهرهای محبوب اقامت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| Visual | average-stay-analysis | میانگین شب اقامت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts |
| Visual | gross-profit-by-service | سود ناخالص به تفکیک خدمت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | expense-structure | ساختار هزینه‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_journal_balance_facts |
| Visual | expense-trend | روند مجموع هزینه‌ها | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_journal_balance_facts |
| Visual | paid-commission-by-recipient | کمیسیون پرداختی به تفکیک ذی‌نفع | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_journal_balance_facts, reporting_payment_facts |
| Visual | paid-commission-trend | روند کمیسیون پرداختی | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_journal_balance_facts, reporting_payment_facts |
| Visual | customer-debt-aging | بدهی مشتریان و سررسید | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_payment_aging_facts_v1 |
| Visual | customer-interest-distribution | علایق ثبت‌شده مشتریان | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_affairs_lead_facts_v1, reporting.travel.facts.v1 |
| Visual | customer-destination-distribution | مشتریان و تقاضا بر اساس مقصد | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting.travel.facts.v1 |
| Visual | customer-service-distribution | مشتریان بر اساس نوع خدمت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_sales_contract_facts, reporting_contract_service_facts, reporting.travel.facts.v1 |
| Visual | customer-acquisition-channel-mix | ترکیب مشتریان بر اساس کانال جذب | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_portfolio_growth_facts_v1 |
| Visual | customer-acquisition-channel-trend | روند جذب مشتری به تفکیک کانال | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_customer_portfolio_growth_facts_v1 |
| Visual | workforce-compliance-queue | سوابق پرسنلی نیازمند اقدام | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_hr_record_expiry_facts_v1 |
| Visual | employee-leads-by-agent | لیدها به تفکیک کارشناس | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-calls-by-agent | تماس‌ها و تماس‌های موفق | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-followups-by-agent | پیگیری‌ها و موارد معوق | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-average-sale-by-agent | میانگین مبلغ فروش | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-contracts-by-agent | قراردادهای ثبت‌شده و نهایی | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | sales.reporting.organization.v2, reporting_employee_commercial_activity_facts_v1 |
| Visual | employee-cancellations-by-agent | لغوها به تفکیک کارشناس و علت | OWNER_PUBLIC_SOURCE_OR_SCOPE_REQUIRED | reporting_employee_commercial_activity_facts_v1 |

## Verification update

All90 Reporting API tests and51 Dashboard/translation Web tests pass (1 existing Web skip); scoped lint passes. In-memory candidate using the real production public modules exposes12 chart IDs while preserving the11 KPI IDs; no business-data write. Hosted CI found optional unavailableMetrics access in two new test assertions; corrected to optional access without altering runtime behavior. Final-head CI and production publication remain pending.
