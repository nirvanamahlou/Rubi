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
| Master Data       | organization/role, provider profile, geography, service refs, channel                                                                                                              | resolve refs, activate/deactivate                                      | Documents برای metadata اختیاری                                                    |
| Settings          | tenant/company, numbering, pricing/SLA/approval config                                                                                                                             | get effective setting                                                  | IAM برای audit actor                                                               |
| Customers         | customer, contact, address, companion, identity ref, consent, merge                                                                                                                | create/update/merge, consent check                                     | Master Data, Documents                                                             |
| Sales             | lead, opportunity, activity, quotation, target                                                                                                                                     | convert lead, accept quotation                                         | Customers, Master Data                                                             |
| Orders            | travel order/item, passenger snapshot, reservation, segment, issue state                                                                                                           | create, price, reserve, issue transition                               | Customers, Master Data, Integrations                                               |
| Integrations      | connection, credential reference, provider mapping, webhook/sync record                                                                                                            | search/recheck/book/issue/refund                                       | Master Data, Orders contract                                                       |
| Procurement       | request/order/receipt/purchase invoice linkage                                                                                                                                     | create provider purchase, approve                                      | Orders, Master Data, Finance posting port                                          |
| Finance           | invoice, payment, refund, settlement, account, journal, check                                                                                                                      | verify/post/refund/settle/balance                                      | Orders/Procurement references, IAM approvals                                       |
| Documents         | file metadata, template/version, generated document, access/send history                                                                                                           | generate/archive/sign URL                                              | Object storage; domain references                                                  |
| Customer Service  | ticket, message, SLA/escalation, survey                                                                                                                                            | open/assign/escalate/close                                             | Customers و reference IDs                                                          |
| Marketing         | campaign, segment definition, message run, attribution, discount                                                                                                                   | build consented audience, attribute                                    | Customers consent, Sales/Orders events                                             |
| B2B               | contract, org user, credit policy, agreed rate, account manager                                                                                                                    | validate terms/credit                                                  | Master Data org, Finance exposure                                                  |
| Human Resources   | employee/personnel record, contact/emergency contact, assignment, employment contract, attendance, shift, leave/mission, overtime, performance, training/certificate, issued asset | manage employment lifecycle, approve time/leave, publish payroll input | IAM user reference، Master Data branch refs، Documents، Finance payroll-input port |
| Tasks/Automation  | task, checklist, rule/run, approval task                                                                                                                                           | create urgent task, evaluate event                                     | IAM assignee، domain events                                                        |
| Reporting/Exports | approved views, report definition/run, export artifact                                                                                                                             | query/export/schedule                                                  | read-only از مالک‌ها، Documents                                                    |
| Notifications     | notification request/delivery/template rendering                                                                                                                                   | enqueue/send/status                                                    | Settings, external messaging adapters                                              |
| Audit             | audit event                                                                                                                                                                        | append/query authorized                                                | همه ماژول‌ها append می‌کنند                                                        |
| Dashboard         | فقط read model و saved filters                                                                                                                                                     | aggregate/drill-down                                                   | Reporting only                                                                     |

## مرزهای حساس

### Orders در برابر Integrations

Orders مالک intent و state داخلی رزرو/صدور است. Integrations مالک protocol، credential،
mapping و response خام redacted است. Adapter اجازه تغییر مستقیم Order table ندارد؛ نتیجه
normalized را برمی‌گرداند و Orders transition را اعمال می‌کند.

### Orders در برابر Procurement

Order Item فروش را مدل می‌کند. Procurement purchase واقعی Provider را با FK به item ایجاد
می‌کند. purchase price snapshot می‌تواند در هر دو برای traceability باشد ولی رکورد مرجع
خرید Purchase Order/Invoice است.

### Orders/Procurement در برابر Finance

دامنه فروش/خرید سند تجاری را ایجاد می‌کند؛ Finance invoice/payment/journal و posted state
را مالک است. هیچ ماژولی journal line را مستقیم درج نمی‌کند و فقط posting command با source
reference یکتا می‌فرستد.

### Customers در برابر Marketing

Customers مالک identity و consent جاری/تاریخچه است. Marketing segment و campaign را مالک
است و هنگام materialize/send، consent را دوباره کنترل می‌کند. unsubscribe فوراً به Customers
اعمال می‌شود.

### Documents در برابر ماژول صادرکننده

ماژول دامنه اجازه و محتوای semantic سند را تعیین می‌کند؛ Documents render/version/archive
را انجام می‌دهد. شماره رسمی بیرونی از Integrations/Orders می‌آید و template آن را تولید نمی‌کند.

### Master Data در برابر B2B/Procurement

Organization و role در Master Data است. Contract/credit/agreed rates در B2B؛ خرید عملیاتی
و بدهی Provider در Procurement/Finance است. یک organization می‌تواند هم Agency و هم Supplier
باشد بدون duplicate profile.

### Human Resources در برابر Customers/Orders

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
| `lead.converted` / `quotation.accepted`                     | Sales            | Orders, Reporting                     |
| `order.created` / `order.cancelled`                         | Orders           | Finance, Tasks, Reporting             |
| `reservation.confirmed`                                     | Orders           | Procurement, Documents                |
| `payment.confirmed`                                         | Finance          | Orders, Tasks, Reporting              |
| `issue.requested` / `issue.succeeded` / `issue.failed`      | Orders           | Integrations worker, Documents, Tasks |
| `purchase.invoice_approved`                                 | Procurement      | Finance                               |
| `refund.requested` / `refund.completed`                     | Finance          | Orders, Customer Service              |
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
- تست معماری باید ادغام یا استفاده جایگزین Employee با Customer/Passenger و query مستقیم
  Finance روی داده حساس HR را رد کند.
- reporting queryها با fixture چند passenger/segment از عدم تکثیر مبلغ مطمئن شوند.
