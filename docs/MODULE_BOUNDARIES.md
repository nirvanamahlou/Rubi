# مرز ماژول‌ها

## قواعد عمومی

1. هر table، invariant و state transition دقیقاً یک Owner دارد.
2. ماژول مصرف‌کننده شناسه ماژول مالک را نگه می‌دارد، اما داده مالک را duplicate و قابل
   ویرایش نمی‌کند؛ snapshot تجاری ضروری (قیمت/نام روی سند) استثنا و immutable است.
3. Command همزمان از public application service و notification غیرهمزمان از event/outbox.
4. read model ترکیبی فقط در Reporting یا query service تاییدشده ساخته می‌شود.
5. circular dependency با event یا orchestration service شکسته می‌شود.

## مالکیت دامنه

| ماژول             | مالک داده/Invariant                                                                                                                                                                | API عمومی نمونه                                                        | وابستگی مجاز                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| IAM               | user, session, role, permission, team                                                                                                                                              | authenticate, authorize, revoke                                        | Master Data(branch)                                                                |
| Legal Entities    | issuer company profile، user issuer context، immutable branding snapshot، issue metadata و audit                                                                                  | selectable/context/switch، validate issuer، branding snapshot، record issue | IAM permission/audit actor، Documents asset references                           |
| Master Data       | organization/role, provider profile, geography, service refs, channel                                                                                                              | resolve refs, activate/deactivate                                      | Documents برای metadata اختیاری                                                    |
| Settings          | tenant/company, numbering, pricing/SLA/approval config                                                                                                                             | get effective setting                                                  | IAM برای audit actor                                                               |
| Customers         | customer, contact, address, companion, identity ref, consent, merge                                                                                                                | create/update/merge, consent check                                     | Master Data, Documents                                                             |
| Customer Affairs  | request, lead, activity, qualification, support ticket, SLA/escalation, survey                                                                                                     | qualify/hand off lead, open/assign/escalate/close                      | Customers، Marketing refs و domain reference IDs                                  |
| Sales Contracts   | sales case, quotation, sales contract/version, contract party/passenger, contract service allocation, contract document intent                                                    | request availability, activate/amend contract, publish execution      | Customers, Ticket Catalog, Master Data, B2B terms                                  |
| Ticket Catalog    | ticket product, flight departure, fare version, inventory capacity and sale window                                                                                                 | search sellable ticket, hold-capacity command port, publish changes    | Master Data airline/airport refs, Settings pricing                                 |
| Reservations      | availability/hold, execution case, ticket issuance, hotel booking/voucher, insurance policy reference, manifest/version, operational status                                      | check/hold, execute, issue, manifest, change/cancel/refund             | Sales execution snapshot, Ticket Catalog, Integrations                             |
| Integrations      | connection, credential reference, provider mapping, webhook/sync record                                                                                                            | search/recheck/book/issue/refund                                       | Master Data, Reservations contract                                                 |
| Procurement       | purchase request/order/receipt/invoice, supplier quote/discount, net purchase version and payable source                                                                          | accept reservation request, approve/order/receive/cancel               | Sales service reference, Reservations operation, Master Data, Finance posting port |
| Finance           | financial case, invoice, payment, refund, settlement, account, journal, check, document release authorization                                                                     | verify/post/refund/settle/balance/release document                     | Sales/Procurement references, IAM approvals                                        |
| Documents         | file metadata/version، confidentiality، access history و archive فایل نهایی                                                                                                        | store/version/archive، authorized asset access                          | Object storage; domain references                                                  |
| Marketing         | campaign, segment definition, message run, attribution, discount                                                                                                                   | build consented audience, attribute                                    | Customers consent, Customer Affairs/Sales events                                   |
| B2B               | contract, org user, credit policy, agreed rate, account manager                                                                                                                    | validate terms/credit                                                  | Master Data org, Finance exposure                                                  |
| Human Resources   | employee/personnel record, contact/emergency contact, assignment, employment contract, attendance, shift, leave/mission, overtime, performance, training/certificate, issued asset | manage employment lifecycle, approve time/leave, publish payroll input | IAM user reference، Master Data branch refs، Documents، Finance payroll-input port |
| Tasks/Automation  | task, checklist, rule/run, approval task                                                                                                                                           | create urgent task, evaluate event                                     | IAM assignee، domain events                                                        |
| Reporting/Exports | approved views, report definition/run, export artifact                                                                                                                             | query/export/schedule                                                  | read-only از مالک‌ها، Documents                                                    |
| Notifications     | notification request/delivery/template rendering                                                                                                                                   | enqueue/send/status                                                    | Settings, external messaging adapters                                              |
| Audit             | audit event                                                                                                                                                                        | append/query authorized                                                | همه ماژول‌ها append می‌کنند                                                        |
| Dashboard         | فقط read model و saved filters                                                                                                                                                     | aggregate/drill-down                                                   | Reporting only                                                                     |

## مرزهای حساس

### Sales Contracts در برابر Reservations

Sales Contracts مالک customer/payer/passengerهای قرارداد، service allocation، قیمت فروش،
quotation و contract version است. Reservations snapshot versioned و فقط‌خواندنی قرارداد را
اجرا می‌کند. Reservation اجازه ایجاد/تغییر رابطه passenger با ticket/hotel/room/insurance
ندارد؛ correction request به Sales برمی‌گردد.

### Ticket Catalog در برابر Reservations

Ticket Catalog برنامه، fare و ظرفیت قابل فروش را تعریف و version می‌کند و هیچ سندی برای
مسافر صادر نمی‌کند. Sales محصول بلیت را به passenger قرارداد تخصیص می‌دهد. Reservations
Hold/consume و صدور واقعی، PNR، تغییر/استرداد و Manifest را مالک است.

### Reservations در برابر Integrations

Reservations مالک intent و state داخلی رزرو/صدور است. Integrations مالک protocol، credential،
mapping و response خام redacted است. Adapter اجازه تغییر مستقیم جدول‌های Reservation را
ندارد؛ نتیجه normalized را برمی‌گرداند و Reservations transition را اعمال می‌کند.

### Reservations در برابر Procurement

Sales Contract Service Item تعهد فروش را مدل می‌کند. Reservations از public command یک
Purchase Request با reference قرارداد، service item، passenger، supplier و operation ایجاد
می‌کند و قیمت اولیه/تخفیف مذاکره‌شده را می‌فرستد. Procurement مالک approval، نسخه قیمت خالص،
Purchase Order/Invoice و payable source است. سود از sale snapshot منهای net purchase approved
محاسبه می‌شود و فیلد دستی نیست.

### Sales/Reservations/Procurement در برابر Finance

فروش/خرید سند تجاری و رزرواسیون سند عملیاتی را ایجاد می‌کنند؛ Finance invoice/payment/
journal و `financial_release` را مالک است. هیچ ماژولی journal line را مستقیم درج نمی‌کند.
صدور سند با تحویل آن یکی نیست؛ Sales فقط پس از release مالی اجازه مشاهده/ارسال فایل را دارد.

### Customers در برابر Marketing

Customers مالک identity و consent جاری/تاریخچه است. Marketing segment و campaign را مالک
است و هنگام materialize/send، consent را دوباره کنترل می‌کند. unsubscribe فوراً به Customers
اعمال می‌شود.

### Documents در برابر ماژول صادرکننده

ماژول دامنه اجازه، محتوای semantic، Render و Issue سند را مالک است. Documents فقط فایل
نهایی و assetهای Branding را نگهداری، version، محرمانه، قابل‌دسترسی و archive می‌کند و
مالک Render یا Issue نیست. ماژول صادرکننده issuer واقعی و Branding Snapshot immutable را
از قرارداد عمومی `legal-entities.v1` می‌گیرد و Metadata صدور را ثبت می‌کند؛ query مستقیم
جدول‌های Legal Entity ممنوع است. شماره رسمی بیرونی از Integrations/Reservations می‌آید و
template آن را تولید نمی‌کند.

### Legal Entity در برابر Branch و داده عملیاتی

Legal Entity فقط هویت شرکت صادرکننده است و Branch، Tenant، Agency یا Customer Organization
نیست. تغییر Context آن هیچ Customer، Contract، Reservation، Procurement یا Finance record
را فیلتر نمی‌کند و Branch Scope امنیتی موجود را تغییر نمی‌دهد. `ALL` فقط Context مجازی
گزارش‌گیری با Permission است، رکورد Legal Entity نیست و برای صدور رسمی معتبر نیست.

### Master Data در برابر B2B/Procurement

Organization و role در Master Data است. Contract/credit/agreed rates در B2B؛ خرید عملیاتی
و بدهی Provider در Procurement/Finance است. یک organization می‌تواند هم Agency و هم Supplier
باشد بدون duplicate profile.

### Human Resources در برابر Customers/Sales Contracts

Employee موجودیت و aggregate مستقل Human Resources است. Customer و Passenger برای چرخه
فروش/سفر هستند و هیچ‌کدام جایگزین پرونده کارمند نمی‌شوند. اگر یک شخص هم‌زمان کارمند و
مشتری باشد، دو شناسه دامنه مستقل با link محدود و مجاز نگهداری می‌شود؛ داده یک دامنه در
دامنه دیگر قابل ویرایش نیست.

### Human Resources در برابر IAM/Finance/Documents

IAM مالک User، credential، role و permission است؛ HR مالک وضعیت استخدام، سمت و مدیر.
`employee.user_id` اختیاری است و غیرفعال‌شدن استخدام از طریق قرارداد عمومی درخواست
بازبینی/غیرفعال‌سازی دسترسی را به IAM می‌دهد. HR فقط ورودی حداقلی و تاییدشده پرداخت
حقوق را به Finance منتشر می‌کند؛ Finance اجازه query مستقیم حضور، ارزیابی یا قرارداد
پرسنلی را ندارد. Documents فایل باینری و access history را نگه می‌دارد، اما HR مالک
classification، retention intent و مجوز semantic سند پرسنلی است.

## Eventهای دامنه پیشنهادی

| Event v1                                                    | Publisher        | مصرف‌کنندگان اصلی                     |
| ----------------------------------------------------------- | ---------------- | ------------------------------------- |
| `customer.created` / `customer.consent_changed`             | Customers        | Marketing, Audit                      |
| `customer_request.qualified`                                | Customer Affairs | Sales Contracts, Reporting            |
| `sales.availability_requested` / `reservation.hold_created` | Sales/Reservations | Sales Contracts, Tasks              |
| `sales_contract.activated` / `sales_contract.amended`       | Sales Contracts  | Reservations, Finance, Reporting      |
| `reservation.purchase_requested`                            | Reservations     | Procurement, Audit                    |
| `reservation.confirmed` / `travel_document.issued`          | Reservations     | Finance, Documents, Tasks             |
| `manifest.generated` / `manifest.sent`                      | Reservations     | Documents, Notifications, Audit       |
| `payment.confirmed`                                         | Finance          | Reservations, Tasks, Reporting        |
| `financial_release.authorized` / `financial_release.blocked` | Finance         | Sales Contracts, Documents, Tasks     |
| `travel_document.delivered`                                 | Sales Contracts  | Documents, Customer Affairs, Audit    |
| `purchase.invoice_approved`                                 | Procurement      | Finance                               |
| `refund.requested` / `refund.completed`                     | Finance          | Reservations, Customer Affairs        |
| `ticket.sla_breached`                                       | Customer Service | Tasks, Notifications                  |
| `check.due_soon`                                            | Finance          | Tasks, Notifications                  |
| `employee.contract_expiring` / `employee.document_expiring` | Human Resources  | Tasks, Notifications                  |
| `employee.payroll_input_approved`                           | Human Resources  | Finance                               |

Event envelope شامل `eventId`, `eventType`, `version`, `occurredAt`, `traceId`, `actor`,
`aggregateId` و payload حداقلی بدون PII غیرضروری است.

## تست مرز

- architecture test باید importهای ممنوع و دسترسی infrastructure cross-module را رد کند.
- contract test بین public service/event producer-consumer اجرا شود.
- permission و transaction test برای transitionهای حساس لازم است.
- تست مرز باید تغییر contract passenger/service توسط Reservations و صدور passenger document
  توسط Ticket Catalog را رد کند.
- تست Procurement باید وجود reference قرارداد/service/supplier و محاسبه net purchase
  versioned را enforce کند؛ margin دستی مجاز نیست.
- تست معماری باید ادغام یا استفاده جایگزین Employee با Customer/Passenger و query مستقیم
  Finance روی داده حساس HR را رد کند.
- reporting queryها با fixture چند passenger/segment از عدم تکثیر مبلغ مطمئن شوند.
