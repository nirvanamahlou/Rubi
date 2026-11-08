# Dashboard chart coverage audit — 2026-11-08

Read-only production inspection: six deployed native calculation/reader files match repository HEAD after newline normalization. Accounting journals/lines, approved supplier/ticket payment revisions, B2B credit policies, marketing campaigns/spend and leads contain no records. Payment entries: 3 FINANCE_CONFIRMED, 7 pending, 1 rejected; refunds: 0. No business rows, identities or amounts exported.

Coverage is based on the actual native dispatcher, not the existence of planned tables. An authorized empty event source is zero; missing sources or denied scope are unavailable. Sources outside the dispatcher require owner-public producers before activation. Treasury receipt/refund coverage is added in this candidate and is not yet deployed.

| Page | Chart | ID | Native calculation coverage |
|---|---|---|---|
| executive-overview | روند فروش، وصول و سود | executive-trend | Connected, partial: no approved profit source |
| executive-overview | فروش بر اساس نوع خدمت | executive-sales-by-service | Connected; data and permission dependent |
| executive-overview | مشتریان جدید و بازگشتی | executive-customer-retention | Connected; data and permission dependent |
| executive-overview | استثناهای نیازمند تصمیم | executive-exceptions | Not connected to current native dispatcher; domain public projection required |
| commercial-performance | روند مبلغ و تعداد فروش | finalized-sales-trend | Connected; data and permission dependent |
| commercial-performance | کانال فروش | sales-channel | Not connected to current native dispatcher; domain public projection required |
| commercial-performance | درآمد به تفکیک نوع خدمت | service-type | Connected; data and permission dependent |
| commercial-performance | قیف و عمر قراردادها | commercial-pipeline | Not connected to current native dispatcher; domain public projection required |
| revenue-collections | روند فروش و وصول | sales-collection-trend | Connected; data and permission dependent |
| revenue-collections | وضعیت تسویه قراردادها | collection-status | Not connected to current native dispatcher; domain public projection required |
| revenue-collections | مطالبات سررسیدگذشته | overdue-counterparties | Not connected to current native dispatcher; domain public projection required |
| revenue-collections | استرداد به تفکیک نوع خدمت | refund-by-service | Not connected to current native dispatcher; domain public projection required |
| travel-operations | قیف عملیات | issue-funnel | Not connected to current native dispatcher; domain public projection required |
| travel-operations | استثناهای صدور | issue-alerts | Not connected to current native dispatcher; domain public projection required |
| travel-operations | نرخ خطا به تفکیک Provider | provider-failure-rate | Not connected to current native dispatcher; domain public projection required |
| inventory-products | مصرف ظرفیت به تفکیک مسیر | inventory-capacity | Not connected to current native dispatcher; domain public projection required |
| inventory-products | ظرفیت تا تاریخ حرکت | inventory-departure-curve | Not connected to current native dispatcher; domain public projection required |
| inventory-products | عرضه‌های نیازمند اقدام | inventory-action-queue | Not connected to current native dispatcher; domain public projection required |
| procurement-suppliers | سهم خرید تأمین‌کنندگان | supplier-spend-share | Not connected to current native dispatcher; domain public projection required |
| procurement-suppliers | وضعیت پرداخت خریدها | supplier-payment-status | Not connected to current native dispatcher; domain public projection required |
| procurement-suppliers | صف تعهدات تأمین‌کننده | supplier-action-queue | Not connected to current native dispatcher; domain public projection required |
| procurement-suppliers | مقایسه نرخ خرید هتل | hotel-rate-comparison | Not connected to current native dispatcher; domain public projection required |
| finance-treasury | گردش خزانه | treasury-flow | Candidate: confirmed receipts / executed refunds; partial treasury |
| finance-treasury | روند درآمد و سود | finance-profit-trend | Connected, partial: no approved profit source |
| finance-treasury | ریسک طرف‌حساب‌ها | counterparty-exposure | Not connected to current native dispatcher; domain public projection required |
| finance-treasury | اولویت چک‌ها | due-checks-queue | Not connected to current native dispatcher; domain public projection required |
| customer-growth | روند جذب تا سفارش | customer-growth-overview | Connected; data and permission dependent |
| customer-growth | کیفیت منابع جذب | customer-source-quality | Not connected to current native dispatcher; domain public projection required |
| customer-growth | رضایت و کیفیت خدمت | customer-trust-guardrails | Not connected to current native dispatcher; domain public projection required |
| customer-crm | قیف CRM | crm-funnel | Not connected to current native dispatcher; domain public projection required |
| customer-crm | تبدیل به تفکیک منبع لید | lead-source-conversion | Not connected to current native dispatcher; domain public projection required |
| customer-crm | فرصت‌های نیازمند پیگیری | crm-followup-queue | Not connected to current native dispatcher; domain public projection required |
| support-service-quality | ترکیب حجم و SLA | support-breakdown | Not connected to current native dispatcher; domain public projection required |
| support-service-quality | روند زمان پاسخ و حل | support-time-trend | Not connected to current native dispatcher; domain public projection required |
| support-service-quality | اقدام‌های اصلاحی باز | support-recovery-queue | Not connected to current native dispatcher; domain public projection required |
| partners-b2b | فروش و سود شرکا | partner-performance | Not connected to current native dispatcher; domain public projection required |
| partners-b2b | ریسک قرارداد و اعتبار | partner-credit-risk | Not connected to current native dispatcher; domain public projection required |
| partners-b2b | قراردادهای نیازمند اقدام | partner-action-queue | Not connected to current native dispatcher; domain public projection required |
| marketing-growth | قیف تعامل کمپین | campaign-performance | Not connected to current native dispatcher; domain public projection required |
| marketing-growth | فروش منتسب و ROAS | campaign-value | Not connected to current native dispatcher; domain public projection required |
| marketing-growth | هزینه تبلیغات به تفکیک کانال | advertising-spend-by-channel | Not connected to current native dispatcher; domain public projection required |
| marketing-growth | پوشش رضایت به تفکیک کانال | consent-coverage-chart | Not connected to current native dispatcher; domain public projection required |
| workforce-hr | ظرفیت کارکرد واحدها | workforce-capacity | Not connected to current native dispatcher; domain public projection required |
| workforce-hr | روند عملکرد و فشار کاری | workforce-performance | Not connected to current native dispatcher; domain public projection required |
| employee-commercial-performance | تعداد فروش کارشناسان | employee-sales-count-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-commercial-performance | مبلغ فروش کارشناسان | employee-sales-amount-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-commercial-performance | نرخ تبدیل لید به فروش | employee-conversion-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-commercial-performance | مقایسه عملکرد کارشناسان | employee-performance-ranking | Not connected to current native dispatcher; domain public projection required |
| tasks-automation | صف وظایف و اجراها | task-automation-queue | Not connected to current native dispatcher; domain public projection required |
| documents-reports-data-quality | سلامت اسناد | document-quality-overview | Not connected to current native dispatcher; domain public projection required |
| documents-reports-data-quality | کیفیت گزارش و داده | report-data-quality-overview | Not connected to current native dispatcher; domain public projection required |
| executive-growth-risk | روند روزانه جذب لید | executive-lead-acquisition | Connected; data and permission dependent |
| executive-growth-risk | تبدیل لید به فروش | executive-lead-conversion | Not connected to current native dispatcher; domain public projection required |
| executive-growth-risk | روند و دلایل لغو رزرو | executive-reservation-cancellations | Not connected to current native dispatcher; domain public projection required |
| executive-growth-risk | ترکیب مطالبات و بدهی‌ها | executive-cash-exposure | Not connected to current native dispatcher; domain public projection required |
| sales-profitability-analysis | روند میانگین مبلغ فروش | average-sale-trend | Not connected to current native dispatcher; domain public projection required |
| sales-profitability-analysis | تخفیف به تفکیک کارشناس و خدمت | discount-analysis | Not connected to current native dispatcher; domain public projection required |
| sales-profitability-analysis | روند تخفیف داده‌شده | discount-trend | Connected; data and permission dependent |
| sales-profitability-analysis | سهم و رتبه خدمات از فروش | service-sales-portfolio | Connected; data and permission dependent |
| sales-profitability-analysis | عملکرد کارشناس | agent-ranking | Not connected to current native dispatcher; domain public projection required |
| sales-segment-analysis | مبلغ فروش روزهای هفته | sales-weekday-pattern | Connected; data and permission dependent |
| sales-segment-analysis | مقصدها و شهرهای پرفروش | sales-destination-ranking | Not connected to current native dispatcher; domain public projection required |
| sales-segment-analysis | فروش بر اساس کشور مقصد | sales-country-ranking | Not connected to current native dispatcher; domain public projection required |
| sales-segment-analysis | روند فروش کانال‌ها | sales-channel-trend | Not connected to current native dispatcher; domain public projection required |
| flight-route-analysis | فروش و سهم هر ایرلاین | airline-sales-performance | Not connected to current native dispatcher; domain public projection required |
| flight-route-analysis | فروش و تردد مسیرها | route-sales-performance | Not connected to current native dispatcher; domain public projection required |
| flight-route-analysis | روند متوسط قیمت بلیت | average-ticket-price-trend | Not connected to current native dispatcher; domain public projection required |
| flight-route-analysis | نرخ لغو بلیت به تفکیک ایرلاین | ticket-cancellation-analysis | Not connected to current native dispatcher; domain public projection required |
| tour-hotel-performance | فروش و رزرو تورها | tour-sales-ranking | Not connected to current native dispatcher; domain public projection required |
| tour-hotel-performance | ظرفیت تورها | tour-capacity-performance | Not connected to current native dispatcher; domain public projection required |
| tour-hotel-performance | فروش و رزرو هتل‌ها | hotel-sales-ranking | Not connected to current native dispatcher; domain public projection required |
| tour-hotel-performance | شهرهای محبوب اقامت | popular-hotel-cities | Not connected to current native dispatcher; domain public projection required |
| tour-hotel-performance | میانگین شب اقامت | average-stay-analysis | Not connected to current native dispatcher; domain public projection required |
| finance-profitability-costs | سود ناخالص به تفکیک خدمت | gross-profit-by-service | Not connected to current native dispatcher; domain public projection required |
| finance-profitability-costs | ساختار هزینه‌ها | expense-structure | Not connected to current native dispatcher; domain public projection required |
| finance-profitability-costs | روند مجموع هزینه‌ها | expense-trend | Not connected to current native dispatcher; domain public projection required |
| finance-profitability-costs | کمیسیون پرداختی به تفکیک ذی‌نفع | paid-commission-by-recipient | Not connected to current native dispatcher; domain public projection required |
| finance-profitability-costs | روند کمیسیون پرداختی | paid-commission-trend | Not connected to current native dispatcher; domain public projection required |
| finance-obligations-risk | اولویت چک‌ها | due-checks-queue | Not connected to current native dispatcher; domain public projection required |
| finance-obligations-risk | ریسک طرف‌حساب‌ها | counterparty-exposure | Not connected to current native dispatcher; domain public projection required |
| finance-obligations-risk | بدهی مشتریان و سررسید | customer-debt-aging | Not connected to current native dispatcher; domain public projection required |
| customer-behavior-analysis | علایق ثبت‌شده مشتریان | customer-interest-distribution | Not connected to current native dispatcher; domain public projection required |
| customer-behavior-analysis | مشتریان و تقاضا بر اساس مقصد | customer-destination-distribution | Not connected to current native dispatcher; domain public projection required |
| customer-behavior-analysis | مشتریان بر اساس نوع خدمت | customer-service-distribution | Not connected to current native dispatcher; domain public projection required |
| customer-behavior-analysis | ترکیب مشتریان بر اساس کانال جذب | customer-acquisition-channel-mix | Not connected to current native dispatcher; domain public projection required |
| customer-behavior-analysis | روند جذب مشتری به تفکیک کانال | customer-acquisition-channel-trend | Not connected to current native dispatcher; domain public projection required |
| hr-record-quality | سوابق پرسنلی نیازمند اقدام | workforce-compliance-queue | Not connected to current native dispatcher; domain public projection required |
| employee-crm-activity | لیدها به تفکیک کارشناس | employee-leads-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-crm-activity | تماس‌ها و تماس‌های موفق | employee-calls-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-crm-activity | پیگیری‌ها و موارد معوق | employee-followups-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-sales-quality | میانگین مبلغ فروش | employee-average-sale-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-sales-quality | قراردادهای ثبت‌شده و نهایی | employee-contracts-by-agent | Not connected to current native dispatcher; domain public projection required |
| employee-sales-quality | لغوها به تفکیک کارشناس و علت | employee-cancellations-by-agent | Not connected to current native dispatcher; domain public projection required |

Total registry chart slots: 93. Candidate-supported slots: 13.

Accepted architecture decisions 001/004 are removed from chart open-decision metadata. Raw decision IDs are replaced with Persian limitation explanations in chart details. Pending 008/009/012 remain as internal decision references. No fabricated balances, costs, zero profit or campaign returns are introduced.

## Live candidate reconciliation and remaining work

The candidate Treasury renderer was evaluated in memory against the production database in an explicit READ ONLY transaction. Its confirmed-receipt/refund series reconcile to the owner-public payment reader for the 2026 year-to-date interval, with one source-currency group. The probe returned flags only, no amounts or identities. It used a synthetic diagnostic actor and is not a browser-role acceptance test. Application/database writes: none.

No active affairs/sla setting exists. Operational code has fallback response windows (normal 240 minutes, urgent 30, critical 15); these fallbacks are not evidence of an approved working-hours calendar or Dashboard SLA definition. Credit policies and campaign/spend tables have no rows. Business decisions still required: whether/how agency credit is used; working calendar and approved response/resolution/escalation targets; attribution rule and authoritative campaign costs. No question about already accepted architecture decisions 001/004 is required.

Other absent charts require their owner-public measures, mappings and scoped reporting integration; source table existence alone does not authorize a financial formula. The matrix explicitly keeps these charts unconnected, rather than claiming the entire Dashboard is operational. No domain-private table reader, fabricated cost, pending receipt approval or production rollout is introduced.

Validation: 27 native Dashboard API tests and 42 Dashboard model Web tests pass; one pre-existing Web UI suite remains skipped. All 3 English coverage checks, scoped API/Web ESLint, API typecheck/build and offline catalogue synchronization pass. Final production Web build passes, including TypeScript and all 67 routes. Initial build errors were stale/unbuilt local contracts/config/database artifacts; package rebuilds corrected them without dependency or source changes. Three older translation entries are retained in overrides so catalogue regeneration preserves their effective translations.
