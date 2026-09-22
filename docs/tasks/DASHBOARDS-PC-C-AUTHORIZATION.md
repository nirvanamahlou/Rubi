# DASHBOARDS PC C AUTHORIZATION

## هدف و اختیار

در 2026-09-13، `COMPUTER_ID=PC-A` به عنوان سیستم مرجع هماهنگی و با دستور صریح
مالک محصول، اجرای `DASHBOARDS-001` را به `COMPUTER_ID=PC-C` واگذار کرد. PC-C
مالک اجرای این واحد است؛ این واگذاری مالکیت داده، سیاست یا محاسبه دامنه‌های دیگر را
منتقل نمی‌کند.

## محیط مقصد

- Workspace: `F:/Projects/Nora`
- Worktree: `F:/Projects/Nora/.worktrees/dashboards-001`
- Runtime: `http://localhost:3000/dashboard`
- Branch pattern: `codex/pc-c-dashboards-<task>`

PC-C پیش از تغییر باید Workspace، Terminal، GitHub authentication، Remote، وضعیت
Working Tree و مالک Listener پورت 3000 را روی دستگاه خودش تایید کند. Process ناشناس
یا متعلق به Worktree دیگر نباید متوقف شود.

## Scope انحصاری

- `apps/web/src/modules/dashboard/**`
- `apps/web/src/app/(crm)/dashboard/**`
- Aggregationهای Dashboard در `apps/api/src/reporting/**`
- `docs/tasks/DASHBOARDS-*.md`
- ورودی محدود همین Task در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`
- test، lint، typecheck، build و Preview محلی Dashboard

تغییر AppShell، Navigation، Design System مشترک، Public Contract/root export، Prisma،
Migration، Seed، manifest، Dependency یا Lockfile بدون Handoff و رزرو مستقل ممنوع است.

## مرز داده و شاخص

- Dashboard فقط Approved View، Public Projection یا Public Contract نسخه‌دار مصرف
  می‌کند.
- Query مستقیم جدول عملیاتی یا Repository خصوصی ماژول‌ها ممنوع است.
- تعریف grain، measure، currency، timezone و وضعیت کسب‌وکار باید از ماژول مالک دریافت
  شود؛ Frontend حق بازسازی مانده مالی، فروش، ظرفیت، SLA یا وضعیت رزرو را ندارد.
- Widget فاقد Projection واقعی باید Empty یا Unavailable شفاف نشان دهد و داده Preview
  را به عنوان داده واقعی نمایش ندهد.
- Permission، Branch scope، Legal Entity context، masking و export audit در Backend
  enforce شوند؛ مخفی کردن Widget در UI کنترل امنیتی محسوب نمی‌شود.
- خروجی بزرگ queue-based است و فایل نهایی از مرز Documents عبور می‌کند.
- Secret، Credential، PII و داده واقعی مسافر در Git، fixture، log یا telemetry قرار
  نمی‌گیرد.

## هماهنگی مالکیت

- PC-C مالک اجرای `DASHBOARDS-001` و فایل‌های Scope همین سند است.
- PC-C برای Projectionهای Reporting با مجوز موجود Reporting هماهنگ عمل می‌کند.
- Finance، Sales، Reservations، Customers، Customer Affairs، HR، Marketing،
  Organizations، Documents و Master Data مالک داده و تعریف KPI خود باقی می‌مانند.
- تغییر producer یا قرارداد مشترک نیازمند موافقت مالک ماژول، نسخه‌گذاری و برنامه سازگاری
  است.

## قفل‌ها

- Dashboard implementation owner: `PC-C/DASHBOARDS-001`
- Migration Owner: `NOT_RESERVED`
- Dependency/Lockfile Owner: `NOT_RESERVED`
- Dashboard shared-contract/root export: `NOT_RESERVED`
- Central UI/Navigation: `NOT_RESERVED`
- Central docs: فقط ورودی محدود همین مجوز؛ بدون قفل گسترده

## تحویل اجباری

PC-C باید از آخرین `origin/develop` Branch مستقل بسازد، Commitهای کوچک و Push معمولی
انجام دهد و Draft PR به `develop` باز کند. گزارش پایان باید Base و HEAD کامل، فایل‌های
تغییرکرده، Projectionهای مصرف‌شده، Widgetهای واقعی و Blocked، نتایج test، lint،
typecheck و build، وضعیت پورت 3000 و Working Tree را اعلام کند. Merge، Force Push،
حذف Source Branch و تغییر مستقیم `main`/`develop` مجاز نیست.
