# CUSTOMER-AFFAIRS-001 — Foundation امور مشتریان Phase A

- وضعیت: `INTEGRATION_READINESS_IMPLEMENTED`
- مالک: `PC-B`
- Branch اولیه: `codex/pc-b-customer-affairs-foundation`
- Base: `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb`
- تخصیص رسمی: PR شماره ۱۷
- نوع: Frontend، Domain Design، Application Port، قرارداد ماژول‌محلی و Test

## نتیجه

Foundation مستقل Customer Affairs برای دو جریان «قبل از فروش» و «بعد از فروش» آماده
شد. تمام داده‌های UI synthetic و دارای شناسه `preview-*` هستند. هیچ endpoint فعال،
Controller، Repository، Persistence، mutation بین‌ماژولی یا اطلاعات واقعی مشتری ایجاد
نشده است.

## محدوده تکمیل‌شده

### قبل از فروش

- درخواست مشتری و Lead با منبع آشنایی، کانال ورودی، نیاز سفر، مقصد، بازه تقریبی، تعداد
  مسافر، بودجه اولیه Decimal همراه کد ارز، اولویت و مسئول پیگیری
- مراحل Lead، Qualification امتیازی، Follow-up، اقدام بعدی، overdue و Lead aging
- فعالیت‌های تماس، پیام، جلسه و یادداشت در Timeline
- Pipeline/Kanban نمایشی، جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی
- proposal تحویل Lead واجد شرایط به Sales؛ بدون ایجاد Customer، Sales Request، قرارداد
  یا رزرو واقعی

### بعد از فروش

- Ticket با دسته‌بندی شکایت، اصلاح مشخصات، کنسلی، استرداد، مشکل بلیت، هتل/واچر، بیمه
  و خدمات تکمیلی
- اولویت، وضعیت، مسئول، اولین پاسخ، موعد حل، SLA، Escalation و overdue
- یادداشت داخلی جدا از پاسخ پیشنهادی قابل ارسال
- Satisfaction، دلیل بستن و تاریخچه وضعیت در سطح طراحی
- reference پیشنهادی به Customer، Sales Request، قرارداد، Reservation و Service؛ بدون
  import یا mutation داخلی ماژول‌های مالک

### UI

- Route `/customer-affairs` با طراحی فارسی، RTL، Responsive و هماهنگ با سیستم آبی Rubi
- Dashboard خلاصه Lead/Ticket، دو تب قبل/بعد فروش، Pipeline، فهرست‌ها و Timeline
- فرم Create/View/Edit با validation محلی و پیام صریح عدم ذخیره
- stateهای `Preview`، `Loading`، `Empty`، `Error`، `Forbidden` و Success validation
- هشدار Follow-up و SLA عقب‌افتاده؛ Retry و عملیات شبکه‌ای عمداً غیرفعال‌اند

## قرارداد ماژول‌محلی

فایل‌های `apps/api/src/customer-affairs/**` موارد زیر را بدون Nest/Prisma تعریف می‌کنند:

- `LeadListQuery`, `TicketListQuery` و `PaginatedResult<T>` برای search/filter/sort و
  pagination سمت سرور
- `LeadSummary`, `LeadDraft`, `LeadStage`, `LeadActivity`
- `QualificationResult`
- `SupportTicketSummary`, `SupportTicketDraft`, `TicketStatus`, `TicketPriority`
- `SLAState`, `Escalation`, `Satisfaction`
- `CustomerReference` و `SalesRequestReference` فقط به‌صورت proposal
- `CustomerAffairsApplicationPort` و `CustomerAffairsActorContext`؛ فهرست Lead و Ticket
  هر دو نتیجه صفحه‌بندی‌شده برمی‌گردانند و Ticket query کامل دریافت می‌کند

هیچ export در `packages/contracts` ایجاد نشده است. مسیرهای REST فقط proposal ماژول‌محلی
هستند و Controller فعال ندارند.

## Permission Matrix پیشنهادی

تمام تصمیم‌ها deny-by-default هستند و داشتن Permission نامرتبط دسترسی ایجاد نمی‌کند.

| Action | Permission پیشنهادی |
| --- | --- |
| مشاهده Lead | `customer_affairs.lead.read` |
| ایجاد Lead | `customer_affairs.lead.create` |
| ویرایش Lead | `customer_affairs.lead.update` |
| Qualification | `customer_affairs.lead.qualify` |
| پیشنهاد Handoff | `customer_affairs.lead.handoff.propose` |
| مشاهده Ticket | `customer_affairs.ticket.read` |
| ایجاد Ticket | `customer_affairs.ticket.create` |
| ویرایش Ticket | `customer_affairs.ticket.update` |
| تخصیص Ticket | `customer_affairs.ticket.assign` |
| Escalation | `customer_affairs.ticket.escalate` |
| بستن Ticket | `customer_affairs.ticket.close` |
| مدیریت SLA | `customer_affairs.sla.manage` |
| مشاهده Satisfaction | `customer_affairs.satisfaction.read` |
| ثبت Satisfaction | `customer_affairs.satisfaction.record` |

انتشار این Permissionها در IAM/shared contract خارج از Scope Phase A است و به Handoff و
هماهنگی producer/consumer نیاز دارد.

## تست‌ها

- Domain validation برای Lead و Ticket
- transitionهای مجاز/غیرمجاز Lead و Ticket
- Qualification امتیازی و disqualification
- Follow-up overdue و Lead aging
- SLA شامل on-track، at-risk، breached، paused و met
- Permission Matrix واقعی با deny-by-default؛ مجوزهای Satisfaction read/record مستقل‌اند
  و هیچ‌کدام دسترسی دیگری را ایجاد نمی‌کند
- Contract test برای normalization محدوده page/pageSize، فیلترهای مجاز Ticket، allowlist
  فیلد sort و metadata نتیجه `PaginatedResult<T>`
- Query normalization، filter، sort و pagination داده‌های Preview
- فرم و Success validation بدون Persistence
- UI contract برای تب‌ها، Pipeline، Timeline، stateها و Create/View/Edit
- Boundary test برای نبود Database، Prisma، Nest Controller، Repository، قرارداد مشترک،
  IAM internal، Customers internal و Master Data internal import

## کنترل کیفیت

- `pnpm install --frozen-lockfile`: پاس؛ manifest و Lockfile بدون تغییر
- Prettier: فقط فایل‌های همین Task
- lint کل Monorepo: ۶ Task موفق
- typecheck کل Monorepo: ۹ Task موفق
- تست API: ۴۱ تست در ۱۳ فایل
- تست Web: ۴۶ تست در ۱۴ فایل
- تست کامل Monorepo: ۱۰۱ تست در ۳۵ فایل
- Production Build: ۶ Task موفق؛ ۲۵ Route شامل `/customer-affairs`
- Prisma Generate فقط برای typecheck/build با URL synthetic اجرا شد؛ هیچ Migration یا
  اتصال/نوشتن Database انجام نشد.

## محدودیت‌های قطعی و Handoff آینده

موارد زیر عمداً `Blocked by Persistence/Shared Lock Handoff` هستند:

1. Prisma model، Migration، Seed و Fixture پایدار Customer Affairs
2. Repository، Controller، REST فعال، Audit و transaction واقعی
3. انتشار Permissionها و DTOها در `@rubi/contracts`
4. resolve واقعی CustomerReference از Customers و SalesRequestReference از Sales
5. mutation تبدیل Lead به Customer/Sales Request یا ایجاد قرارداد/رزرو
6. SLA config واقعی از Settings و Task/Notification خودکار برای breach
7. ارسال پاسخ به مشتری، attachment و ارتباط Documents/Worker
8. نگهداری PII یا مدارک حساس؛ نیازمند تصمیم retention/encryption و مجوز مستقل

Migration Owner، Dependency/Lockfile Owner، Customer shared-contract/root export و اسناد
مرکزی Sprint در اختیار PC-A/`CUSTOMER-001 Phase B` باقی می‌مانند. Phase بعدی فقط پس از
Merge این PR و Handoff صریح قفل‌های لازم آغاز می‌شود.

## Commitهای پیاده‌سازی

- `29030c5` — Domain، Application Port، قرارداد ماژول‌محلی و تست‌ها
- `ded122a` — Workspace فارسی/RTL، Preview stateها و تست‌های Frontend
- `a1a78ac` — فرم‌های تخصصی Lead/Ticket و contract test فیلدهای عملیاتی
- `d628302` — تفکیک Permission ثبت رضایت و قراردادهای list/pagination سمت سرور
- `c4778eb` — هم‌راستایی پیشنهاد Permission محلی Web

PR شماره ۱۸ در ادامه در `origin/develop` Merge شد؛ Source Branch این ادامه نیز حذف نمی‌شود.


## ادامه Integration Readiness — ۱۴۰۵/۰۶/۰۲

- وضعیت: `INTEGRATION_READINESS_IMPLEMENTED`
- مالک: `PC-B`
- Branch: `codex/pc-b-customer-affairs-integration`
- Base: `origin/develop@a1659238b4357bf9fe676f83aceb61aa311ba98b`
- پیش‌نیازها: Merge شدن PRهای ۱۸، ۱۹ و ۲۰ در `origin/develop` تأیید شد.

### اتصال مجاز Customers

Customer Affairs فقط typeها، version و endpointهای قرارداد عمومی Customers از
`@rubi/contracts` را مصرف می‌کند. نسخه جاری Repository برابر
`CUSTOMERS_CONTRACT_VERSION = 2` و prefix عمومی برابر `/api/v1/customers` است؛
هیچ فایل مشترک یا فایل داخلی Customers تغییر نکرد.

- جست‌وجوی واقعی مشتری فعال و انتخاب CustomerReference با درخواست credentialed و read-only
- نمایش Customer 360 از endpoint جزئیات عمومی و لینک مستقیم از فرم Lead/Ticket
- پوشش واقعی Loading، Empty، Error، Unauthorized (401) و Forbidden (403)
- نمایش فقط contact ماسک‌شده و خلاصه عمومی؛ بدون PII synthetic شبیه داده واقعی
- بررسی موارد مشابه از مسیر Customer 360؛ duplicate mutation عمداً فراخوانی نمی‌شود
- Adapter Backend فقط interface است و به Prisma، Repository یا جدول Customers وابسته نیست

### تکمیل تجربه قبل و بعد از فروش

- Dashboard به چهار شاخص Leadهای جدید، پیگیری‌های امروز، Ticketهای باز و SLAهای نزدیک
  نقض هم‌راستا شد.
- Pipeline بدون اسکرول افقی و به‌صورت grid واکنش‌گرا ارائه می‌شود.
- انتخاب مشتری، tracking number، دسته‌های سؤال و مشکل خدمات، رضایت‌سنجی، نتیجه نهایی،
  علت بسته‌شدن و توضیح بازگشایی کنترل‌شده به فرم‌های Create/View/Edit اضافه شد.
- Timeline شامل تماس، پیام، یادداشت، تخصیص، تغییر وضعیت، Escalation و رضایت است.
- Handoff واجدشرایط Sales در UI فقط preview ذخیره‌نشده می‌سازد و هیچ درخواست شبکه،
  mutation یا event واقعی اجرا نمی‌کند.

### Contractهای integration ماژول‌محلی

Contract پیشنهادی `customer-affairs.integration.v1-proposal` با envelope نسخه ۱ و
`persisted: false` برای مرزهای زیر تعریف شد:

- `LeadQualified`
- `SalesHandoffRequested`
- `CustomerSupportTicketOpened`
- `ReservationIssueReported`
- `RefundAssistanceRequested`
- `CustomerSatisfactionRecorded`

این نام‌ها و mappingها فقط proposal ماژول‌محلی‌اند. انتشار، outbox، EventEmitter،
Controller یا فراخوانی Sales/Reservations وجود ندارد. پذیرش producer/consumer و
سازگاری با قراردادهای آینده Sales و Reservations همچنان نیازمند Handoff مالک آن
ماژول‌هاست.

### Policy و کنترل دامنه

- Permission مستقل `customer_affairs.ticket.reopen` به matrix محلی افزوده شد.
- بازگشایی فقط از وضعیت terminal، با Permission، optimistic version، علت و یادداشت audit
  و سقف دفعات مجاز می‌شود.
- policy پیشنهادی SLA، موعد اولین پاسخ و حل، حالت at-risk/breached و سطح Escalation را
  بدون persistence محاسبه می‌کند.
- Timeline interaction، closure، outcome و referenceهای پیشنهادی Ticket/Voucher/Insurance
  در Contract محلی تکمیل شد.
- normalization جداگانه Lead برای search/sort/pagination با allowlist و محدودیت page size
  اضافه شد.

### کنترل‌های این ادامه

- API Customer Affairs: ۶ فایل تست و ۲۲ تست هدفمند پاس
- Web Customer Affairs: ۳ فایل تست و ۱۴ تست هدفمند پاس
- typecheck API و Web: پاس پس از build قرارداد عمومی و Prisma Generate با URL synthetic
- lint API و Web: پاس
- تست کامل Monorepo: ۹ Task و ۱۵۶ تست پاس
- Production Build: ۶ Task پاس؛ ۲۵ Route شامل Customer Affairs و Customer 360
- هیچ Migration، Seed، Controller، Repository، Persistence، manifest، lockfile یا فایل
  مرکزی تغییر نکرد.
- هدف عملکرد UI داخلی: LCP حداکثر ۲۵۰۰ms، INP حداکثر ۲۰۰ms، CLS حداکثر ۰٫۱ در p75؛
  بودجه افزوده JavaScript حداکثر ۸۰KB gzip و امتیاز accessibility حداقل ۹۰.

### موارد مسدود برای Persistence

Persistence همچنان به مدل/قفل Migration، تصمیم Audit/Retention، انتشار Permission در
IAM، پذیرش Contract مشترک، پیاده‌سازی Controller/Repository و هماهنگی صریح با مالکان
Customers، Sales و Reservations وابسته است. تا آن زمان هیچ Lead، Ticket، Handoff،
Satisfaction یا Event واقعی ذخیره یا منتشر نمی‌شود.
