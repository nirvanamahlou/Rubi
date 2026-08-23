# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-23 — پایان Sprint اول و Handoff رسمی

## خلاصه

- مرحله جاری: **مرحله 2 — Foundation تکمیل‌شده**
- وضعیت بعدی: **برنامه‌ریزی Sprint دوم**
- Repository: `Rubi`، Remote با نام `origin`
- Baseline: Merge Commit `543f6e2b2f55833a2d1ae02440a9495f1510a112` از آخرین `origin/develop`
- شاخه فعال: `codex/pc-a-sprint-1-handoff`
- Work Item: `SPRINT1-HANDOFF-001`؛ بستن Sprint اول و آزادسازی رسمی Handoffها
- محیط مسئول: `COMPUTER_ID=PC-A`
- وضعیت اولیه محیط: Dev Server متوقف و Working Tree روی `develop` کاملاً تمیز بود.

## نتیجه نهایی Sprint اول

|  PR | Work Item     | Merge Commit                               | نتیجه                                             |
| --: | ------------- | ------------------------------------------ | ------------------------------------------------- |
|  #5 | `IAM-001`     | `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` | IAM Full-Stack و قرارداد عمومی ادغام شد           |
|  #6 | `MASTER-001`  | `cda0f9a67589974458a4261b753152a796fa1d0b` | Foundation بدون Persistence اطلاعات پایه ادغام شد |
|  #7 | `ARCH-001`    | `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` | معماری تاییدشده گردش سفر و منوی ۱۷ بخشی ادغام شد  |
|  #8 | `UI-ARCH-001` | `543f6e2b2f55833a2d1ae02440a9495f1510a112` | Frontend معماری و دسترسی عملی IAM ادغام شد        |

- منوی اصلی دقیقاً ۱۷ بخش دارد و «مدیریت سیستم» تنها آیتم اصلی IAM/Settings است.
- صفحه `/system` دسترسی عملی به رابط موجود `/users` و مسیر `/settings` فراهم می‌کند؛
  هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند.
- مرحله Foundation بسته شده است؛ Persistence واقعی Master Data قابلیت تکمیل‌شده محسوب
  نمی‌شود و در `MASTER-002` برنامه‌ریزی خواهد شد.

## برنامه Sprint اول

### `UI-ARCH-001` — PC-A — `DONE`

- Merge Commit: `543f6e2b2f55833a2d1ae02440a9495f1510a112` روی `origin/develop`

- منوی اصلی مطابق معماری ۱۷ بخشی تاییدشده بازچینی شد؛ Customer Affairs قبل/بعد،
  Reservation، Ticket Management، Sales و System Management مرز مستقل و روشن دارند.
- نمای معماری ماژول‌های فروش، رزرواسیون، خرید و مالی همراه زنجیره تحویل اطلاعات ایجاد شد.
- صفحات مستقل امور مشتریان، تعریف بلیت و مدیریت سیستم افزوده شدند؛ مسیر قدیمی خدمات مشتریان
  به Customer Affairs هدایت می‌شود.
- صفحه مدیریت سیستم اکنون ورودی عملی به رابط موجود IAM در `/users` و تنظیمات در
  `/settings` دارد؛ هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند و منوی اصلی ۱۷ بخشی
  بدون آیتم مستقل جدید حفظ شده است.
- تغییر فقط در Frontend و اسناد Task است؛ Prisma، Migration، Dependency/Lockfile، IAM و
  فایل‌های `MASTER-001` تغییر نمی‌کنند.
- نصب frozen، ESLint کل Web، Typecheck، نه فایل تست با ۲۶ تست و Production Build پاس شدند.
- خروجی Build شامل ۲۴ Route قابل اجرا است و Smoke احراز‌شده هر ده مسیر اصلی روی پورت ۳۱۰۰
  با HTTP 200 و محتوای مورد انتظار پاس شد؛ `git diff --check` نیز پاس است.

### `ARCH-001` — PC-A — `DONE`

- Merge Commit: `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` روی `origin/develop`
- ساختار ۱۷ بخشی شامل «مدیریت و تعریف بلیت‌ها» و «مدیریت سیستم» ثبت شده است.
- Customer Affairs مالک Lead/Support؛ Sales مالک قرارداد و تخصیص passenger/service؛
  Reservations مالک استعلام/Hold/صدور/Manifest؛ Procurement مالک خرید و Finance مالک
  financial release است.
- رزرواسیون Purchase Request را با قرارداد/service/supplier و قیمت/تخفیف کارگزار ایجاد
  می‌کند؛ Procurement approval/net purchase را مالک و margin از داده approved محاسبه می‌شود.
- مرجع جزئیات: `docs/TRAVEL_WORKFLOW_ARCHITECTURE.md`.
- این Work Item فقط اسناد است و هیچ Schema، Migration، Dependency یا Lockfile تغییر نمی‌دهد.
- Prettier، لینک‌های Markdown، تعادل fenceها، secret/scope scan و `git diff --check` پاس شدند.

### `IAM-001` — PC-A — `DONE`

- Merge Commit: `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` روی `origin/develop`
- ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend/Frontend و Audit امنیتی را Full-Stack پوشش می‌دهد.
- PC-A در طول `IAM-001` مالک انحصاری Migration، Dependency/Lockfile و قراردادهای مشترک IAM بود.
- معیار تحویل شامل Database، API، Frontend، تست‌های permission/security و Handoff
  قرارداد عمومی IAM به مصرف‌کنندگان است.
- Migration `20260822120000_iam_foundation` روی PostgreSQL توسعه اعمال شد؛ Seed دو بار
  متوالی بدون duplicate پاس شد و `prisma migrate status` دیتابیس را up-to-date اعلام کرد.
- Migration غیرمخرب `20260822150000_username_login` ورود case-insensitive با نام کاربری
  اختصاص‌یافته مدیر و ایمیل اختیاری را اضافه کرد و روی PostgreSQL لوکال پاس شد.
- Merge انجام شده و قفل‌های Migration، Dependency/Lockfile و IAM shared-contract در
  2026-08-23 با `SPRINT1-HANDOFF-001` رسماً آزاد شدند.

### `MASTER-001` — PC-B — `DONE`

- Branch: `codex/pc-b-master-data-foundation`
- Merge Commit: `cda0f9a67589974458a4261b753152a796fa1d0b` روی `origin/develop`
- Catalog دوازده‌گانه، UI فارسی/RTL responsive، فرم‌های Create/View/Edit، search/filter/
  sort/pagination و Stateهای Loading/Empty/Error/Permission/Preview تکمیل شد.
- Contractهای ماژول‌محلی list/detail/mutation/status و async Excel/PDF همراه validation،
  error envelope، Permission Matrix و ۲۰ تست پاس‌شده در `develop` قرار دارند.
- Prisma schema/Migration/repository، Backend پایدار، mutation واقعی، نرخ ارز authoritative
  و export artifact تکمیل نشده‌اند و در `MASTER-002` برنامه‌ریزی شده‌اند؛ هنوز هیچ قفل
  Migration یا Dependency به آن Task تخصیص ندارد.
- هیچ manifest، lockfile، Prisma، Migration یا فایل IAM تغییر نکرده است.
- Consumer requirementهای IAM در `docs/tasks/MASTER-001.md` ثبت شده‌اند؛ مصرف
  `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` اکنون از قرارداد عمومی
  `@rubi/contracts` انجام می‌شود.

## وضعیت Baseline مشترک

- Technical Bootstrap با Merge Commit `bdb5461` روی `develop` قرار دارد.
- مالکیت Full-Stack ماژول‌ها و Human Resources با Merge Commit `b5b7c5d` ثبت شده است.
- Frontend Foundation و طراحی Dashboard با Merge Commit `c4f8bde` روی `develop` قرار دارد.
- Prisma baseline شامل مدل‌های IAM، branch reference، Session و Audit و دو Migration غیرمخرب
  با Merge Commit `50eacca` وارد `develop` شده است.
- Master Data Foundation بدون persistence با Merge Commit `cda0f9a` وارد `develop` شده است.

## تکمیل‌شده در DOCS-002

- مدل همکاری به Full-Stack برای هر دو PC تغییر کرد؛ تقسیم ثابت Backend/Frontend حذف شد.
- مالکیت نهایی ماژول‌ها و تفکیک Backend/UI گزارش‌ها در `MODULE_OWNERSHIP.md` ثبت شد.
- قفل هم‌زمان Migration Owner، Dependency/Lockfile Owner، فایل مرکزی و API/Event Contract ثبت شد.
- منابع انسانی به منوی اصلی ۱۷ بخشی اضافه و دامنه، مرز، مدل مفهومی، امنیت و گزارش آن مستند شد.
- Employee از Customer/Passenger مستقل و ارتباط HR → Finance به payroll input تاییدشده محدود شد.
- حقوق و دستمزد قانونی و کامل در نسخه اولیه خارج از محدوده باقی ماند.

## تکمیل‌شده در Technical Bootstrap

- pnpm 11 workspace و Turborepo با Node 24، TypeScript strict، ESLint flat config و Prettier
- `apps/web`: Next.js App Router، Tailwind، فارسی/RTL، صفحه اجرا و `/status`
- `apps/api`: NestJS REST، prefix `/api/v1`، Swagger، ValidationPipe، error envelope، request ID،
  CORS قابل تنظیم، logging و graceful shutdown
- endpoint پایه `GET /api/v1/health` با قرارداد مشترک `packages/contracts`
- `apps/worker`: Nest standalone، BullMQ/ioredis، startup Redis health و graceful shutdown
- `packages/database`: Prisma 7، PostgreSQL datasource، Client factory و scriptهای
  format/validate/generate بدون model مصنوعی
- Compose محلی PostgreSQL 18، Redis 8 و MinIO با health check، volume نام‌دار و ساخت bucket
- lockfile pin‌شده و scriptهای root برای dev/build/lint/typecheck/test/database/infrastructure

## وضعیت تاریخی هنگام `DOCS-003`

- در زمان آن Task، قابلیت IAM یا Master Data هنوز پیاده‌سازی نشده و وضعیت هر دو `PLANNED` بود؛
  وضعیت جاری آن‌ها در بخش Sprint اول ثبت شده است.
- خود Commit مستنداتی `DOCS-003` هیچ فایل نرم‌افزاری، Prisma schema، Migration، Seed،
  Dependency یا Lockfile را تغییر نداد.
- Nginx، CI و deployment محیط غیرمحلی هنوز ساخته نشده‌اند.
- تصمیم‌های P0 بازِ `docs/DECISIONS.md` همچنان مانع schema دامنه/مالی و adapter واقعی هستند.

## کنترل کیفیت Technical Bootstrap

- نصب dependency و lockfile supply-chain policy: پاس
- Prisma format، validate و generate روی schema بدون model: پاس
- peer dependency check، ESLint، TypeScript typecheck و Prettier check: پاس
- Vitest: ۷ تست در ۶ suite، همگی پاس
- production build: Web، API، Worker و packageهای buildable پاس؛ routeهای `/` و `/status` static
- Compose config: پاس؛ PostgreSQL/Redis/MinIO healthy و MinIO init با exit 0
- smoke: API health، Swagger JSON، Web status/RTL، MinIO live و Worker→Redis/BullMQ پاس
- `git diff --check` و secret scan در gate نهایی پیش از commit تکرار می‌شوند.

## کنترل کیفیت IAM-001

- Prisma format/validate/generate پاس؛ Migration deploy و status روی PostgreSQL 18 پاس.
- Seed فقط permission، نقش سیستمی و شعبه مرکزی را می‌سازد و اجرای تکراری آن پاس است.
- lint کل Monorepo پاس؛ typecheck کل Monorepo پاس.
- Vitest: ۱۸ تست در ۱۱ suite شامل login HTTP contract، refresh cookie، validation،
  password policy و permission guard همگی پاس.
- Build تولیدی API، Worker، Web و packageهای مشترک پاس؛ `/login` و `/users` در خروجی Web هستند.
- `git diff --check`، بررسی Secret و Markdown links در gate نهایی تکرار می‌شوند.

## Handoff نهایی Sprint اول

1. PR شماره ۵ با Merge Commit `50eacca` وارد `develop` شده و قرارداد عمومی IAM در دسترس است.
2. قرارداد `@rubi/contracts` و جزئیات مصرف در `docs/IAM.md` مبنای PC-B است؛ دسترسی مستقیم
   به جدول‌ها یا repository داخلی IAM ممنوع می‌ماند.
3. PR شماره ۶ با Merge Commit `cda0f9a` وارد `develop` شده است؛ Foundation بدون
   Persistence تکمیل و Persistence واقعی به `MASTER-002` منتقل شده است.
4. PRهای شماره ۷ و ۸ با Merge Commitهای `99dd1cf` و `543f6e2` معماری تاییدشده و
   Frontend منوی ۱۷ بخشی را وارد `develop` کرده‌اند.
5. قفل‌های Migration، Dependency/Lockfile و shared-contract متعلق به `IAM-001` و قفل
   اسناد مرکزی متعلق به `ARCH-001` در 2026-08-23 آزاد شدند.
6. قرارداد عمومی IAM از `@rubi/contracts` مصرف می‌شود؛ `BranchReference`،
   `AuthenticatedActor` و `IamPermissionCode` (از جمله `iam.audit.read`) عمومی‌اند و
   Audit با actor context عمومی ثبت می‌شود. مدل/Repository داخلی IAM یا Audit قابل
   دسترسی مستقیم برای Master Data نیست.
7. آزادشدن قفل‌ها مجوز اجرای هم‌زمان نیست. `MASTER-002` و `CUSTOMER-001` پیش از هر
   تغییر Prisma، Migration یا Dependency باید قفل مستقل رزرو کنند و در هر لحظه فقط یک
   Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## برنامه اولیه Sprint دوم

- `MASTER-002` — PC-B — `PLANNED`: Database، Migration، Repository، Backend و اتصال
  واقعی Frontend اطلاعات پایه؛ بدون قفل Migration/Dependency تا PR برنامه‌ریزی بعدی.
- `CUSTOMER-001` — PC-A — `PLANNED`: مشتریان و مسافران، Customer 360، مدارک، همراهان
  و Duplicate Control؛ بدون قفل Migration/Dependency تا PR برنامه‌ریزی بعدی.

## ریسک‌ها و تصمیم‌های باز

- دامنه دقیق حسابداری عملیاتی و integration با حسابداری قانونی هنوز نهایی نیست.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست مالی ارز، rounding، مالیات و شماره‌گذاری اسناد باید قبل از Migration تایید شود.
- `MASTER-002` مسئول Persistence واقعی است، اما schema/محاسبه authoritative نرخ ارز تا
  حل `DEC-OPEN-004` و رزرو مستقل Migration lock نهایی نمی‌شود.
- اجرای موازی دو Task بدون رعایت قفل‌ها ریسک تعارض Prisma و lockfile دارد؛ ترتیب Handoff
  ثبت‌شده در `WORK_ASSIGNMENTS.md` الزام‌آور است.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.
