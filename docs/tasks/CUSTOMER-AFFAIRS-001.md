# CUSTOMER-AFFAIRS-001 — Foundation امور مشتریان Phase A

- وضعیت: `READY_FOR_REVIEW`
- مالک: `PC-B`
- Branch: `codex/pc-b-customer-affairs-foundation`
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

- `LeadListQuery`, `LeadSummary`, `LeadDraft`, `LeadStage`, `LeadActivity`
- `QualificationResult`
- `SupportTicketSummary`, `SupportTicketDraft`, `TicketStatus`, `TicketPriority`
- `SLAState`, `Escalation`, `Satisfaction`
- `CustomerReference` و `SalesRequestReference` فقط به‌صورت proposal
- `CustomerAffairsApplicationPort` و `CustomerAffairsActorContext`

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

انتشار این Permissionها در IAM/shared contract خارج از Scope Phase A است و به Handoff و
هماهنگی producer/consumer نیاز دارد.

## تست‌ها

- Domain validation برای Lead و Ticket
- transitionهای مجاز/غیرمجاز Lead و Ticket
- Qualification امتیازی و disqualification
- Follow-up overdue و Lead aging
- SLA شامل on-track، at-risk، breached، paused و met
- Permission Matrix واقعی با deny-by-default
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
- تست API: ۳۷ تست در ۱۲ فایل
- تست Web: ۴۶ تست در ۱۴ فایل
- تست کامل Monorepo: ۹۷ تست در ۳۴ فایل
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

این Branch Merge نشده و Source Branch حذف نمی‌شود.
