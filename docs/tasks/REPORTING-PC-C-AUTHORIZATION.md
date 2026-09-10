# REPORTING-PC-C-AUTHORIZATION

## هدف و اختیار

در 2026-09-10، `COMPUTER_ID=PC-A` به‌عنوان سیستم مرجع هماهنگی و با دستور صریح مالک
پروژه، اجرای ادامه برنامه Reporting را به `COMPUTER_ID=PC-C` واگذار کرد. این Handoff
مجوز تغییر مستقیم `main` یا `develop`، Merge، Force Push یا تصاحب قفل‌های مشترک نیست.

## محیط اعلام‌شده PC-C

- Workspace: `F:/Projects/Rubi`
- Reporting worktree: `F:/Projects/Rubi/.worktrees/reporting`
- Runtime: `localhost:3000`
- Branch pattern: `codex/pc-c-reporting-<task>`

این مسیرها از PC-A قابل مشاهده یا آزمون نیستند. PC-C پیش از تغییر باید Writable بودن
Workspace، دسترسی Terminal، Remote صحیح، وضعیت پاک Worktree و مالک Listener پورت 3000
را روی دستگاه خودش تأیید کند. فقط Process متعلق به همین Worktree قابل توقف است.

## Scope مجاز

- `apps/web/src/modules/reports/**`
- `apps/web/src/app/(crm)/reports/**`
- `apps/api/src/reporting/**`
- `docs/tasks/REPORTING-*.md`
- ورودی Task Reporting در `WORK_ASSIGNMENTS.md` و `docs/PROJECT_STATUS.md`
- test، lint، typecheck، build و اجرای محلی Reporting
- Commit کوچک و Push معمولی به Branch مستقل PC-C، در صورت احراز هویت GitHub

ویرایش فایل‌های دیگر، قرارداد عمومی یا root export، Prisma، Migration، Seed، manifest،
Dependency و Lockfile فقط پس از Handoff و رزرو مستقل مجاز است.

## مبنا و Gate ادامه

مبنای اعلام‌شده دستگاه مقصد:

1. `REPORTING-P0-01` — `dcf2b2e`
2. `REPORTING-P0-02` — `b429b94`
3. `REPORTING-P0-03` — `f4f85bc`
4. ادامه بعدی — `REPORTING-P0-04`

در fetch مرجع PC-A روی `origin/develop@4717b130865e0094adb246ce0caa2ee56a935abd`،
هیچ‌یک از سه Commit کوتاه و هیچ Branch ریموت `codex/pc-c-reporting-*` قابل resolve نبود.
این وضعیت مجوز PC-C را لغو نمی‌کند، ولی ادعای انتشار GitHub یا Base قابل بازیابی را
مجاز نمی‌سازد. PC-C باید پیش از P0-04 این کنترل‌ها را انجام دهد:

1. `git status --short --branch` پاک یا تغییرات موجود کاملاً متعلق به Reporting باشد.
2. هر سه Commit با `git cat-file -t <sha>` محلی قابل resolve و ترتیب ancestry آن‌ها
   تأیید شود.
3. `origin` همان Repository مشترک Rubi باشد و `git fetch --prune origin` موفق شود.
4. شاخه مستقل PC-C با Push معمولی منتشر شود؛ Rebase اجباری و Force Push ممنوع است.
5. اگر Commitها محلی موجود نیستند، P0-04 متوقف و Branch/Commit کامل از PC-C گزارش شود؛
   بازسازی یا حدس محتوا ممنوع است.

## مرز معماری و امنیت

- Reporting فقط Approved View یا Public Projection تأییدشده و نسخه‌دار مصرف می‌کند.
- Query مستقیم جداول عملیاتی، Repository خصوصی ماژول‌ها و دورزدن Public Contract ممنوع
  است.
- هر Report باید grain، measure، timezone، currency، filter snapshot و provenance مشخص
  داشته باشد تا join مسافر/segment مبلغ قرارداد یا پرداخت را چندبرابر نکند.
- Permission، Branch scope، Legal Entity context، masking و export audit باید در Backend
  enforce شوند؛ مخفی‌کردن UI کنترل امنیتی محسوب نمی‌شود.
- Export بزرگ باید queue-based باشد و فایل نهایی از مرز Documents عبور کند؛ Artifact
  ساختگی یا ادعای اتصال تکمیل‌نشده ممنوع است.
- Secret، Credential، داده واقعی مسافر و اطلاعات حساس در Git یا fixture قرار نمی‌گیرد.

## مالکیت و قفل‌ها

- PC-A مالک دائمی Reporting Backend و صحت grain باقی می‌ماند.
- PC-B مالک دائمی رابط مرکزی Reports باقی می‌ماند.
- PC-C مجری تفویض‌شده واحدهای P0 است و Scope هر مرحله را جدا رزرو می‌کند.
- Migration Owner: `NOT_RESERVED`
- Dependency/Lockfile Owner: `NOT_RESERVED`
- Reporting shared-contract/root export: `NOT_RESERVED`
- Central docs: فقط ورودی‌های همین Task، بدون قفل گسترده

نیاز به هر قفل یا Contract مشترک جدید باید قبل از تغییر، با producer/consumer و برنامه
سازگاری ثبت شود.

## خروجی اجباری P0-04

گزارش پایان PC-C باید Branch و Commit کامل، Base واقعی، فایل‌های تغییرکرده، وضعیت Push،
نتیجه تست/lint/typecheck/build، مالک Listener پورت 3000، منابع داده مصرف‌شده و هر Blocker
قفل/Contract را اعلام کند. Merge و تغییر مستقیم `develop/main` در این مرحله انجام نمی‌شود.
