# Work Assignments

آخرین به‌روزرسانی: 2026-08-24 — Handoff مستقل CUSTOMER-001 به FINANCE-001 آماده بازبینی

هر ردیف مالکیت یک واحد کار و فایل‌های آن را مشخص می‌کند. قبل از ویرایش، ردیف جدید
ثبت شود. وضعیت‌های مجاز: `PLANNED`، `IN_PROGRESS`، `BLOCKED`، `READY_FOR_REVIEW`،
`DONE`.

| Work ID                         | مالک         | Branch                                      | محدوده/فایل‌های اصلی                                                                                                     | وضعیت              | وابستگی یا Handoff                                                               |
| ------------------------------- | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------- |
| BOOT-001                        | PC-A         | `codex/pc-a-bootstrap-docs`                 | اسناد Bootstrap، معماری، ERD، workflow و backlog                                                                         | `READY_FOR_REVIEW` | PC-B باید همه اسناد و تصمیم‌های باز P0 را مرور کند                               |
| FOUNDATION-001                  | PC-A         | `codex/pc-a-technical-bootstrap`            | Technical Bootstrap: Monorepo، Web/API/Worker، Docker Compose و Prisma Client بدون مدل تجاری                             | `DONE`             | Commit `d9a9793` ادغام شد؛ مبنای Work Itemهای Full-Stack                         |
| FOUNDATION-002                  | تخصیص‌نیافته | TBD                                         | سخت‌سازی زیرساخت، CI و استقرار محیط‌های غیرمحلی                                                                          | `PLANNED`          | FOUNDATION-001 و تصمیم‌های میزبانی/RPO/RTO                                       |
| FOUNDATION-003                  | تخصیص‌نیافته | TBD                                         | IAM/Audit foundation، schema دامنه و Migration اولیه                                                                     | `PLANNED`          | با `IAM-001` جایگزین شده؛ برای جلوگیری از اجرای موازی رزرو جدید نگیرد            |
| FOUNDATION-004                  | PC-B         | `codex/pc-b-frontend-foundation`            | Frontend Foundation: `apps/web/**`، تست Frontend و `docs/tasks/PC-B.md`                                                  | `READY_FOR_REVIEW` | Base `b5b7c5d`؛ قفل Dependency/Lockfile آزاد شد                                  |
| DOCS-002                        | PC-A         | `codex/pc-a-hr-module-ownership`            | ثبت ماژول منابع انسانی، مالکیت نهایی ماژول‌ها و قرارداد همکاری Full-Stack                                                | `READY_FOR_REVIEW` | فقط مستندات؛ بدون کد، Dependency، Schema یا Migration                            |
| DOCS-003                        | PC-A         | `codex/pc-a-sprint-1-planning`              | ثبت برنامه Sprint اول، مرز کار و Handoff دو Task `IAM-001` و `MASTER-001`                                                | `READY_FOR_REVIEW` | Base `c4f8bde`؛ فقط اسناد برنامه‌ریزی                                            |
| ARCH-001                        | PC-A         | `codex/pc-a-approved-workflow-architecture` | معماری ۱۷ بخش، فروش/تخصیص، رزرواسیون/Manifest، تعریف بلیت، خرید/تخفیف و release مالی                                     | `DONE`             | Merge `99dd1cf`؛ مرجع قطعی UI-ARCH-001                                           |
| UI-ARCH-001                     | PC-A         | `codex/pc-a-approved-workflow-frontend`     | منوی ۱۷ بخشی، صفحات گردش فروش/رزرواسیون/خرید/مالی، تعریف بلیت و مدیریت سیستم در `apps/web/**`                            | `DONE`             | Merge `543f6e2`؛ دسترسی عملی IAM از مدیریت سیستم و منوی ۱۷ بخشی تثبیت شد         |
| IAM-001                         | PC-A         | `codex/pc-a-iam-foundation`                 | IAM Full-Stack: Database، API، Web، Test، امنیت، شعبه/دسترسی و Audit                                                     | `DONE`             | Merge `50eaccaf`؛ Handoff عمومی IAM ثبت و قفل‌های مشترک آزاد شد                  |
| MASTER-001                      | PC-B         | `codex/pc-b-master-data-foundation`         | Foundation بدون Persistence اطلاعات پایه، UI، قرارداد ماژول‌محلی و تست                                                   | `DONE`             | Merge `cda0f9a`؛ Persistence واقعی به `MASTER-002` منتقل شد                      |
| SPRINT1-HANDOFF-001             | PC-A         | `codex/pc-a-sprint-1-handoff`               | بستن Sprint اول، ثبت Mergeهای نهایی، آزادسازی قفل‌ها و برنامه اولیه Sprint دوم                                           | `DONE`             | Merge `9c69124`؛ چهار قفل Sprint اول آزاد شدند                                   |
| SPRINT2-PLANNING-001            | PC-A         | `codex/pc-a-sprint-2-planning`              | ترتیب اجرا، قفل‌ها، مرز فایل و Handoff سه Task آغاز Sprint دوم                                                           | `DONE`             | Merge `9efb37c`؛ فقط اسناد برنامه‌ریزی و وضعیت                                   |
| IAM-002                         | PC-A         | `codex/pc-a-iam-domain-permissions`         | انتشار Permission Codeهای Master Data و Customers، Seed تکرارپذیر و Handoff قرارداد عمومی                                | `DONE`             | Merge `d1f1133`؛ ۱۷ Permission و بدون Schema/Migration/Dependency                |
| IAM002-HANDOFF-001              | PC-A         | `codex/pc-a-iam-002-handoff`                | ثبت Merge، آزادسازی IAM contract lock و مجازکردن شروع دو Task مستقل Sprint دوم                                           | `DONE`             | Merge `0af31c2`؛ دو Task مستقل مجاز به شروع هستند                                |
| MASTER-002                      | PC-B         | `codex/pc-b-master-data-persistence`        | Database، Migration، Repository، Backend و اتصال واقعی Frontend اطلاعات پایه                                             | `DONE`             | Merge `ddfebb3`؛ چهار قفل با Handoff مستقل آزاد شدند                             |
| CUSTOMER-001                    | PC-A         | `codex/pc-a-customer-persistence`           | مشتریان، Persistence، رمزنگاری Contact، Audit redaction و Duplicate query                                                | `DONE`             | PR #19؛ Merge `7d0a4f4`؛ Migration و قرارداد Customer پایدار و تحویل‌شده         |
| CUSTOMER001-FINANCE-HANDOFF-001 | PC-A         | `codex/pc-a-customer-finance-handoff`       | آزادسازی چهار قفل CUSTOMER-001 و رزرو کنترل‌شده FINANCE-001؛ فقط اسناد مرکزی و سند Handoff                               | `READY_FOR_REVIEW` | Base `7d0a4f4`؛ بدون کد، Schema، Migration، Dependency یا Lockfile               |
| FINANCE-001                     | PC-A         | `codex/pc-a-finance-foundation`             | Foundation مالی، تصمیم‌های P0، مرز Sub-ledger، قراردادها و طراحی Domain/Application؛ Persistence فقط پس از Decision Gate | `PLANNED`          | شروع پس از Merge Handoff؛ `DEC-OPEN-001/004/005/016` مانع Schema/Migration هستند |
| CUSTOMER-AFFAIRS-001            | PC-B         | `codex/pc-b-customer-affairs-foundation`    | Foundation امور مشتریان: Lead، پیش‌فروش، Follow-up، پشتیبانی پس از فروش و Ticket                                         | `PLANNED`          | فاز A فقط Frontend، طراحی دامنه، قرارداد ماژول‌محلی و تست؛ بدون Persistence      |
| MASTER002-HANDOFF-001           | PC-A         | `codex/pc-a-master-002-handoff`             | ثبت Mergeهای MASTER-002/Customer Phase A، انتقال قفل‌ها و مرز فاز B                                                      | `READY_FOR_REVIEW` | فقط شش فایل مستنداتی؛ Draft PR به `develop`                                      |

## Sprint 1 — مرز فایل و Handoff

### `IAM-001` — PC-A

- محدوده مالکیت پیاده‌سازی: مدل و Migrationهای IAM، Backend احراز هویت و authorization،
  Frontend ورود/خروج و مدیریت کاربران/نقش‌ها، تست‌های unit/integration/permission/E2E و
  Audit رخدادهای امنیتی.
- فایل‌های رزروشده: `apps/api/src/iam/**`، پیکربندی ضروری API، مسیرهای احراز هویت و
  مدیریت دسترسی در `apps/web/src/**`، `packages/contracts/src/iam/**`،
  `packages/database/prisma/schema.prisma` و Migration/Seed نخست IAM، manifestهای
  ضروری، `pnpm-lock.yaml` و اسناد وضعیت/امنیت/Handoff همین Task.
- قفل‌های **Migration Owner = PC-A**، **Dependency/Lockfile Owner = PC-A** و
  **IAM shared-contract Owner = PC-A** در طول Task رزرو بودند و پس از Merge
  `50eaccaf` و Handoff مورخ 2026-08-23 آزاد شدند.
- خروجی لازم برای PC-B: قرارداد عمومی branch/reference مورد استفاده Master Data، شکل
  actor/audit و روش مصرف permission بدون import داخلی از IAM.

### `MASTER-001` — PC-B

- محدوده مالکیت پیاده‌سازی: کشور/شهر، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل،
  organizationهای آژانس/شرکت، کارگزار، لیدر، نحوه آشنایی، وضعیت فعال/غیرفعال،
  جست‌وجو/فیلتر، Excel/PDF، Frontend، API Contract و Test.
- در طول `MASTER-001` و تا Handoff از `IAM-001`، PC-B فقط بخش‌های بدون Migration را
  توسعه داد؛ Persistence واقعی اکنون به `MASTER-002` منتقل شده و پیش از شروع آن باید
  قفل مستقل Prisma/Migration و Dependency رزرو شود.
- قرارداد Master Data نباید ساختار داخلی IAM را تکرار کند. نیاز به branch access، actor
  یا permission ابتدا به‌صورت consumer requirement برای PC-A ثبت و از قرارداد عمومی IAM
  مصرف می‌شود.
- در شروع `MASTER-002`، PC-B باید آخرین `origin/develop` را دریافت، نبود
  Migration/Dependency Owner دیگر را تأیید و قفل لازم را پیش از هر تغییر Schema یا
  Dependency رسماً رزرو کند.
- قراردادهای این مرحله فقط داخل ماژول Web و سند Task تعریف می‌شوند و proposal هستند؛
  انتقال آن‌ها به `packages/contracts/**` یا پیاده‌سازی Backend نیازمند رزرو مستقل فایل
  مشترک و Handoff ثبت‌شده با producer/consumer است.
- Consumer requirementهای IAM شامل permission code، branch scope و actor/audit در
  `docs/tasks/MASTER-001.md` ثبت می‌شوند؛ هیچ فایل IAM در این Task تغییر نمی‌کند.

## قفل‌های آزادشده Sprint اول

| قفل                       | مالک پیشین/Task | وضعیت      | تاریخ و مبنای آزادسازی                                                           |
| ------------------------- | --------------- | ---------- | -------------------------------------------------------------------------------- |
| Migration Owner           | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ IAM baseline با Merge `50eaccaf` ادغام و Handoff عمومی ثبت شد        |
| Dependency/Lockfile Owner | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ Dependencyهای IAM با Merge `50eaccaf` تثبیت و Sprint اول بسته شد     |
| IAM shared-contract Owner | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ قرارداد عمومی IAM با Merge `50eaccaf` در `@rubi/contracts` منتشر شد  |
| Central architecture docs | PC-A/ARCH-001   | `RELEASED` | 2026-08-23؛ معماری تاییدشده با Merge `99dd1cf` وارد `develop` و به PC-B تحویل شد |

آزادشدن این قفل‌ها به معنی مجوز هم‌زمان برای دو Task نبود. وضعیت تاریخی این بخش با
برنامه Sprint دوم پایین تکمیل می‌شود: `MASTER-002` قفل‌های جدید را پس از Merge برنامه
رزرو می‌کند و `CUSTOMER-001` تا Handoff بعدی از آن‌ها استفاده نمی‌کند. در هر لحظه همچنان
فقط یک Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## Handoff رسمی IAM به PC-B

- قرارداد عمومی IAM فقط از `@rubi/contracts` مصرف می‌شود.
- `BranchReference`، `AuthenticatedActor` و `IamPermissionCode` (از جمله
  `iam.audit.read`) قراردادهای عمومی قابل مصرف برای `MASTER-002` هستند؛ Audit فقط با
  actor context عمومی ثبت می‌شود و مدل یا Repository داخلی Audit عمومی نیست.
- دسترسی مستقیم Master Data به جدول‌ها، Prisma modelها یا Repository داخلی IAM ممنوع
  است؛ ارتباط فقط از قرارداد یا سرویس عمومی versioned انجام می‌شود.
- این Handoff قفل‌های Sprint اول را آزاد می‌کند، اما به PC-B یا PC-A قفل Migration یا
  Dependency جدید نمی‌دهد؛ تخصیص بعدی فقط در PR برنامه‌ریزی Sprint دوم انجام می‌شود.

## Sprint 2 — ترتیب اجرا، مرز فایل و Handoff

مرجع جزئیات این Sprint در `docs/tasks/SPRINT-2-PLANNING.md` است. ترتیب الزامی:

1. `IAM-002` روی آخرین `origin/develop` قرارداد Permission عمومی Master Data و Customers
   را منتشر و Seed تکرارپذیر را بدون تغییر Schema/Migration تکمیل می‌کند.
2. پس از Merge و Handoff `IAM-002`، `MASTER-002` وارد فاز Full-Stack می‌شود و تنها مالک
   Migration و Dependency/Lockfile خواهد بود.
3. `CUSTOMER-001` می‌تواند هم‌زمان فقط فاز A بدون Persistence را پیش ببرد؛ تغییر Prisma،
   Migration، manifest، lockfile، root export قرارداد مشترک یا فایل IAM ممنوع است.
4. پس از Merge `MASTER-002` و آزادسازی صریح قفل‌ها، یک Handoff مستقل قفل Migration را
   برای فاز B `CUSTOMER-001` رزرو می‌کند؛ مالکیت خودکار منتقل نمی‌شود.

### `IAM-002` — PC-A

- فایل‌های رزروشده: `packages/contracts/src/iam/**`، export ضروری
  `packages/contracts/src/index.ts`، بخش permission در `packages/database/prisma/seed.ts`،
  تست‌های قرارداد/Seed و اسناد همان Task.
- خروجی: Permission Codeهای versioned حداقل برای read/create/update/status/export در
  Master Data و read/create/update/merge/consent/sensitive-read در Customers.
- این Task مجاز به تغییر `schema.prisma`، Migration، Dependency یا Lockfile نیست.

### `MASTER-002` — PC-B

- فایل‌های رزروشده پس از Handoff IAM-002: مدل‌های Master Data در
  `packages/database/prisma/schema.prisma`، Migration جدید همان Task،
  `apps/api/src/master-data/**`، `apps/web/src/modules/master-data/**`، route موجود،
  `packages/contracts/src/master-data/**`، export هماهنگ‌شده قرارداد و تست/اسناد Task.
- دسترسی مستقیم به `iam_*` یا Repository داخلی IAM ممنوع است؛ actor، branch و permission
  فقط از قرارداد عمومی IAM مصرف می‌شوند. جدول reference مشترک `branches` فقط در محدوده
  lifecycle تاییدشده Master و همراه contract test تغییر می‌کند.
- نرخ ارز authoritative تا حل `DEC-OPEN-004` خارج از Migration قطعی است؛ Currency و سایر
  Catalogها می‌توانند کامل شوند، اما نرخ Draft/Preview منبع گزارش مالی نیست.
- تولید واقعی artifactهای Excel/PDF تا قرارداد Documents/Worker مسدود است؛ MASTER-002
  فقط permission، فیلتر snapshot و قرارداد async export را پایدار می‌کند و فایل ساختگی
  تولید نمی‌کند.
- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` وارد
  `develop` شد؛ Task `DONE` است و مالکیت چهار قفل آن در Handoff مستقل پایان یافت.

### `CUSTOMER-001` — PC-A

- فاز A: `docs/tasks/CUSTOMER-001.md`، UI و stateهای Customers در `apps/web/**`، طراحی
  application/API در `apps/api/src/customers/**` و تست‌های دامنه بدون Persistence واقعی.
- فاز A حق تغییر Prisma، Migration، Dependency/Lockfile، `packages/contracts/src/index.ts`،
  فایل‌های Master Data یا IAM را ندارد و وضعیت Task تا Handoff `IN_PROGRESS` می‌ماند.
- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  ادغام و `DONE/MERGED` شد؛ وضعیت کلی Task تا پایان فاز B `IN_PROGRESS` می‌ماند.
- فاز B با این Handoff فقط در دامنه Customers مجاز است: مدل/Repository/Migration، قرارداد
  عمومی، اتصال واقعی UI، permission/audit و تست Migration را تکمیل می‌کند و حق تغییر فایل
  داخلی IAM یا Master Data را ندارد.
- Master Data فقط از قرارداد عمومی `@rubi/contracts` مصرف می‌شود؛ import یا query مستقیم
  از ساختار داخلی Master Data ممنوع است.
- ذخیره فایل یا مقدار حساس مدارک هویتی تا حل `DEC-OPEN-006` ممنوع است؛ فقط metadata/reference
  غیرحساس طراحی می‌شود. Duplicate auto-merge تا حل `DEC-OPEN-011` ممنوع و فقط candidate
  detection و review دستی طراحی می‌شود.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده: `codex/pc-b-customer-affairs-foundation`.
- هدف فاز A: Foundation امور مشتریان شامل درخواست مشتری، Lead و منبع آشنایی،
  مرحله‌بندی و Qualification قبل از فروش، نیاز سفر و بودجه اولیه، تماس‌ها،
  فعالیت‌ها و Follow-up و پشتیبانی پس از فروش.
- محدوده پشتیبانی شامل Ticket، دسته‌بندی، اولویت، وضعیت، SLA، مسئول، Escalation،
  یادآوری، شکایت، درخواست اصلاح، کنسلی/استرداد، رضایت‌سنجی و بستن Ticket است.
- تبدیل Lead به Customer یا Sales Request و ارتباط Ticket با مشتری، قرارداد، رزرو و
  خدمت فقط Contract پیشنهادی ماژول‌محلی است و هیچ mutation بین‌ماژولی اجرا نمی‌کند.
- مرز فایل آینده PC-B فقط `apps/web/src/modules/customer-affairs/**`، route موجود
  `apps/web/src/app/(crm)/customer-affairs/**`،
  `apps/api/src/customer-affairs/**` برای Domain/Application Port و Contract
  ماژول‌محلی بدون Controller فعال/Repository واقعی،
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` و تست‌های هدفمند همین محدوده است.
- UI فاز A فارسی، RTL، Responsive و هماهنگ با طراحی آبی Rubi است و Loading، Empty،
  Error، Forbidden، Preview، جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی را پوشش می‌دهد.
- Persistence، Prisma، Migration، Seed، Dependency، manifest، Lockfile، قرارداد
  مشترک/root export و داده واقعی مشتری یا PII در فاز A ممنوع است.
- PC-B حق تغییر `packages/database/**`، IAM، Master Data، فایل‌های داخلی Customers
  یا اسناد مرکزی Sprint را ندارد. Backend Persistence فقط پس از Handoff آینده
  Migration مجاز می‌شود.

#### مرز تداخل پس از Merge `CUSTOMER-001` فاز B

- قفل‌های Customer با Merge `7d0a4f4` و این Handoff آزاد می‌شوند؛ PC-B هیچ مالکیتی بر
  Migration، Finance contract یا اسناد مرکزی دریافت نمی‌کند.
- Migration Owner، Finance shared-contract/root export و Central Sprint docs برای
  PC-A/`FINANCE-001` رزرو می‌شوند؛ فعال‌سازی Schema تا عبور از Decision Gate ممنوع است.
- قرارداد اتصال Customer Affairs به Customers/Sales در فاز A فقط proposal داخل
  ماژول و سند Task است؛ انتشار Contract مشترک یا Persistence به Handoff صریح بعدی
  نیاز دارد.

## قفل‌های فعال Sprint دوم پس از Handoff CUSTOMER-001 → FINANCE-001

| قفل                            | مالک/Task        | محدوده                                                               | شرط فعال‌سازی/آزادسازی                                            |
| ------------------------------ | ---------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Migration Owner                | PC-A/FINANCE-001 | Prisma و Migrationهای دامنه Finance فقط پس از Decision Gate          | حل و ثبت `DEC-OPEN-001/004/005/016`؛ سپس Migration gate و Handoff |
| Dependency/Lockfile Owner      | PC-A/FINANCE-001 | فقط dependency ضروری با ثبت نام، فایل و دلیل؛ `pnpm-lock.yaml` مشروط | نیاز واقعی ثبت‌شده یا اعلام عدم نیاز و Handoff                    |
| Finance shared-contract/export | PC-A/FINANCE-001 | `packages/contracts/src/finance/**` و root export هماهنگ‌شده         | تصمیم‌های P0، version و consumer handoff                          |
| Central Sprint status docs     | PC-A/FINANCE-001 | `WORK_ASSIGNMENTS.md`، `PLANS.md` و `docs/PROJECT_STATUS.md`         | Merge FINANCE-001 و Handoff بعدی                                  |

قفل‌ها به Finance منتقل می‌شوند، اما رزرو Migration مجوز ساخت Schema نیست. تا ثبت
تصمیم‌های P0 در `docs/DECISIONS.md`، فقط Foundation، تحلیل، طراحی و قراردادهای پیشنهادی
مجاز است و هیچ manifest یا lockfile بدون نیاز دقیق تغییر نمی‌کند.

## قفل‌های آزادشده Sprint دوم

| قفل                             | مالک پیشین                | مبنای آزادسازی                                         |
| ------------------------------- | ------------------------- | ------------------------------------------------------ |
| IAM shared-contract             | PC-A/IAM-002              | Merge `d1f1133`، تست Contract/Seed و Handoff عمومی     |
| Central Sprint planning docs    | PC-A/SPRINT2-PLANNING-001 | Merge `9efb37c` برنامه Sprint دوم                      |
| Migration Owner                 | PC-B/MASTER-002           | Merge `ddfebb3` و Handoff مستقل به CUSTOMER-001        |
| Dependency/Lockfile Owner       | PC-B/MASTER-002           | Merge `ddfebb3` و تثبیت dependency/lockfile            |
| Master shared-contract/export   | PC-B/MASTER-002           | Merge `ddfebb3` و تحویل قرارداد عمومی Master Data      |
| Central Sprint status docs      | PC-B/MASTER-002           | Merge `ddfebb3` و Handoff اسناد مرکزی به PC-A          |
| Migration Owner                 | PC-A/CUSTOMER-001 Phase B | Merge PR #19 با Commit `7d0a4f4` و migration gate موفق |
| Dependency/Lockfile Owner       | PC-A/CUSTOMER-001 Phase B | Merge PR #19 بدون تغییر dependency/lockfile            |
| Customer shared-contract/export | PC-A/CUSTOMER-001 Phase B | `customers.v2`، contract tests و Merge PR #19          |
| Central Sprint status docs      | PC-A/CUSTOMER-001 Phase B | Merge PR #19 و Handoff مستقل به FINANCE-001            |

## قرارداد مالکیت

- یک فایل یا Migration هم‌زمان فقط یک مالک فعال دارد.
- تغییر محدود و ناگزیر در فایل مشترک باید در توضیح ردیف و Commit اعلام شود.
- وضعیت `DONE` یعنی Commit و Push شده و گزارش تست/ریسک در Project Status ثبت شده
  است؛ ادغام‌شدن را تضمین نمی‌کند.
- آزادکردن کار بدون تکمیل با تغییر مالک به `تخصیص‌نیافته` و ثبت دلیل انجام می‌شود.
