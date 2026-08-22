# Work Assignments

آخرین به‌روزرسانی: 2026-08-22 — PC-A IAM-001

هر ردیف مالکیت یک واحد کار و فایل‌های آن را مشخص می‌کند. قبل از ویرایش، ردیف جدید
ثبت شود. وضعیت‌های مجاز: `PLANNED`، `IN_PROGRESS`، `BLOCKED`، `READY_FOR_REVIEW`،
`DONE`.

| Work ID        | مالک         | Branch                              | محدوده/فایل‌های اصلی                                                                         | وضعیت              | وابستگی یا Handoff                                                                 |
| -------------- | ------------ | ----------------------------------- | -------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| BOOT-001       | PC-A         | `codex/pc-a-bootstrap-docs`         | اسناد Bootstrap، معماری، ERD، workflow و backlog                                             | `READY_FOR_REVIEW` | PC-B باید همه اسناد و تصمیم‌های باز P0 را مرور کند                                 |
| FOUNDATION-001 | PC-A         | `codex/pc-a-technical-bootstrap`    | Technical Bootstrap: Monorepo، Web/API/Worker، Docker Compose و Prisma Client بدون مدل تجاری | `DONE`             | Commit `d9a9793` ادغام شد؛ مبنای Work Itemهای Full-Stack                           |
| FOUNDATION-002 | تخصیص‌نیافته | TBD                                 | سخت‌سازی زیرساخت، CI و استقرار محیط‌های غیرمحلی                                              | `PLANNED`          | FOUNDATION-001 و تصمیم‌های میزبانی/RPO/RTO                                         |
| FOUNDATION-003 | تخصیص‌نیافته | TBD                                 | IAM/Audit foundation، schema دامنه و Migration اولیه                                         | `PLANNED`          | با `IAM-001` جایگزین شده؛ برای جلوگیری از اجرای موازی رزرو جدید نگیرد              |
| FOUNDATION-004 | PC-B         | `codex/pc-b-frontend-foundation`    | Frontend Foundation: `apps/web/**`، تست Frontend و `docs/tasks/PC-B.md`                      | `READY_FOR_REVIEW` | Base `b5b7c5d`؛ قفل Dependency/Lockfile آزاد شد                                    |
| DOCS-002       | PC-A         | `codex/pc-a-hr-module-ownership`    | ثبت ماژول منابع انسانی، مالکیت نهایی ماژول‌ها و قرارداد همکاری Full-Stack                    | `READY_FOR_REVIEW` | فقط مستندات؛ بدون کد، Dependency، Schema یا Migration                              |
| DOCS-003       | PC-A         | `codex/pc-a-sprint-1-planning`      | ثبت برنامه Sprint اول، مرز کار و Handoff دو Task `IAM-001` و `MASTER-001`                    | `READY_FOR_REVIEW` | Base `c4f8bde`؛ فقط اسناد برنامه‌ریزی                                              |
| IAM-001        | PC-A         | `codex/pc-a-iam-foundation`         | IAM Full-Stack: Database، API، Web، Test، امنیت، شعبه/دسترسی و Audit                         | `IN_PROGRESS`      | Base `4342a91`؛ مالک انحصاری Migration، Dependency/Lockfile و قرارداد مشترک IAM    |
| MASTER-001     | PC-B         | `codex/pc-b-master-data-foundation` | Master Data: Frontend، API Contract، Test، جست‌وجو/فیلتر و Excel/PDF                         | `PLANNED`          | تا آزادشدن قفل PC-A بدون Prisma Migration و بدون تغییر Dependency/Lockfile پیش رود |

## Sprint 1 — مرز فایل و Handoff

### `IAM-001` — PC-A

- محدوده مالکیت پیاده‌سازی: مدل و Migrationهای IAM، Backend احراز هویت و authorization،
  Frontend ورود/خروج و مدیریت کاربران/نقش‌ها، تست‌های unit/integration/permission/E2E و
  Audit رخدادهای امنیتی.
- فایل‌های رزروشده: `apps/api/src/iam/**`، پیکربندی ضروری API، مسیرهای احراز هویت و
  مدیریت دسترسی در `apps/web/src/**`، `packages/contracts/src/iam/**`،
  `packages/database/prisma/schema.prisma` و Migration/Seed نخست IAM، manifestهای
  ضروری، `pnpm-lock.yaml` و اسناد وضعیت/امنیت/Handoff همین Task.
- قفل رزروشده: **Migration Owner = PC-A**، **Dependency/Lockfile Owner = PC-A** و
  **IAM shared-contract Owner = PC-A**. هیچ Task دیگر تا آزادسازی صریح این قفل‌ها مجاز
  به تغییر همان محدوده نیست.
- خروجی لازم برای PC-B: قرارداد عمومی branch/reference مورد استفاده Master Data، شکل
  actor/audit و روش مصرف permission بدون import داخلی از IAM.

### `MASTER-001` — PC-B

- محدوده مالکیت پیاده‌سازی: کشور/شهر، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل،
  organizationهای آژانس/شرکت، کارگزار، لیدر، نحوه آشنایی، وضعیت فعال/غیرفعال،
  جست‌وجو/فیلتر، Excel/PDF، Frontend، API Contract و Test.
- تا Handoff آزادسازی از `IAM-001`، PC-B فقط بخش‌های بدون Migration را روی Branch خود
  توسعه می‌دهد؛ ایجاد/ویرایش Prisma Migration و تغییر هر manifest یا `pnpm-lock.yaml`
  ممنوع است.
- قرارداد Master Data نباید ساختار داخلی IAM را تکرار کند. نیاز به branch access، actor
  یا permission ابتدا به‌صورت consumer requirement برای PC-A ثبت و از قرارداد عمومی IAM
  مصرف می‌شود.
- پس از آزادسازی، PC-B آخرین `origin/develop` را دریافت، نبود Migration/Dependency Owner
  دیگر را تأیید و قفل لازم را پیش از هر تغییر Schema یا Dependency رسماً رزرو می‌کند.

## قفل‌های فعال Sprint 1

| قفل                       | مالک/Task    | محدوده                                                       | شرط آزادسازی                                                   |
| ------------------------- | ------------ | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Migration Owner           | PC-A/IAM-001 | Prisma schema و Migrationهای نخست IAM/Branch                 | ادغام IAM baseline، ثبت نتیجه Migration و Handoff صریح         |
| Dependency/Lockfile Owner | PC-A/IAM-001 | manifestهای workspace و `pnpm-lock.yaml`                     | تثبیت Dependencyهای IAM، Push/Review و ثبت آزادسازی            |
| IAM shared-contract Owner | PC-A/IAM-001 | DTO/Event/permission و قرارداد branch access/audit مرتبط IAM | انتشار قرارداد versioned و اعلام compatibility به مصرف‌کنندگان |

## قرارداد مالکیت

- یک فایل یا Migration هم‌زمان فقط یک مالک فعال دارد.
- تغییر محدود و ناگزیر در فایل مشترک باید در توضیح ردیف و Commit اعلام شود.
- وضعیت `DONE` یعنی Commit و Push شده و گزارش تست/ریسک در Project Status ثبت شده
  است؛ ادغام‌شدن را تضمین نمی‌کند.
- آزادکردن کار بدون تکمیل با تغییر مالک به `تخصیص‌نیافته` و ثبت دلیل انجام می‌شود.
