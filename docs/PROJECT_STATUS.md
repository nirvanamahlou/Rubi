# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-22 — PC-A Sprint 1 Planning

## خلاصه

- مرحله جاری: **مرحله 2 — Foundation / اجرای Sprint اول**
- وضعیت: **IAM-001 در حال پیاده‌سازی Full-Stack توسط PC-A**
- Repository: `Rubi`، Remote با نام `origin`
- Base: Commit `4342a91f11c042a97b9553a509c9b585bb48596e` از `origin/develop`
- شاخه فعال: `codex/pc-a-iam-foundation`
- Work Item: `IAM-001`؛ IAM، branch access و Audit امنیتی
- محیط مسئول: `COMPUTER_ID=PC-A`

## برنامه Sprint اول

### `IAM-001` — PC-A — `IN_PROGRESS`

- Branch آینده: `codex/pc-a-iam-foundation`
- ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend/Frontend و Audit امنیتی را Full-Stack پوشش می‌دهد.
- PC-A مالک انحصاری Migration، Dependency/Lockfile و قراردادهای مشترک IAM است.
- معیار تحویل شامل Database، API، Frontend، تست‌های permission/security و Handoff
  قرارداد عمومی IAM به مصرف‌کنندگان است.

### `MASTER-001` — PC-B — `PLANNED`

- Branch آینده: `codex/pc-b-master-data-foundation`
- جغرافیا، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل، آژانس/شرکت، کارگزار، لیدر،
  نحوه آشنایی، active/inactive، جست‌وجو/فیلتر، Excel/PDF، Frontend، API Contract و Test
  را پوشش می‌دهد.
- PC-B تا آزادشدن Migration و Dependency/Lockfile lock توسط PC-A هیچ Prisma Migration
  یا تغییر Dependency/Lockfile ایجاد نمی‌کند؛ بخش‌های بدون Migration می‌توانند موازی
  توسعه یابند.
- نیاز Master Data به branch access، actor/audit یا permission از قرارداد عمومی IAM
  مصرف می‌شود و دسترسی مستقیم به داده داخلی IAM ممنوع است.

## وضعیت Baseline مشترک

- Technical Bootstrap با Merge Commit `bdb5461` روی `develop` قرار دارد.
- مالکیت Full-Stack ماژول‌ها و Human Resources با Merge Commit `b5b7c5d` ثبت شده است.
- Frontend Foundation و طراحی Dashboard با Merge Commit `c4f8bde` روی `develop` قرار دارد.
- Prisma schema همچنان بدون Business Model است و هیچ Migration ایجاد نشده است.

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

## عمداً انجام نشده در `DOCS-003`

- هیچ قابلیت IAM یا Master Data پیاده‌سازی نشده و وضعیت هر دو Task `PLANNED` است.
- هیچ فایل نرم‌افزاری، Prisma schema، Migration، Seed، Dependency یا Lockfile تغییر نکرده است.
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

## Handoff Sprint اول

1. Draft PR شاخه `codex/pc-a-sprint-1-planning` به `develop` Review و پس از تایید ادغام شود.
2. PC-A پس از ادغام برنامه، `IAM-001` را از آخرین `origin/develop` شروع و وضعیت آن را
   `IN_PROGRESS` کند؛ قفل‌های سه‌گانه تا Handoff صریح در مالکیت PC-A باقی می‌مانند.
3. PC-B پس از ادغام برنامه، `MASTER-001` را از آخرین `origin/develop` شروع کند و فقط
   محدوده بدون Migration و بدون تغییر Dependency/Lockfile را موازی پیش ببرد.
4. PC-A قرارداد عمومی IAM مورد نیاز Master Data را version و همراه consumer requirement
   ثبت کند؛ PC-B به repository/table داخلی IAM دسترسی مستقیم نداشته باشد.
5. پس از ادغام IAM baseline، PC-A نتیجه Migration و Dependency را ثبت و قفل‌ها را صریح
   آزاد کند؛ سپس PC-B پیش از Schema/Dependency احتمالی قفل لازم را جداگانه رزرو کند.

## ریسک‌ها و تصمیم‌های باز

- دامنه دقیق حسابداری عملیاتی و integration با حسابداری قانونی هنوز نهایی نیست.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست مالی ارز، rounding، مالیات و شماره‌گذاری اسناد باید قبل از Migration تایید شود.
- `MASTER-001` می‌تواند UI و قرارداد نرخ ارز را طراحی کند، اما schema/محاسبه authoritative
  نرخ ارز تا حل `DEC-OPEN-004` و دریافت Migration lock نهایی نمی‌شود.
- اجرای موازی دو Task بدون رعایت قفل‌ها ریسک تعارض Prisma و lockfile دارد؛ ترتیب Handoff
  ثبت‌شده در `WORK_ASSIGNMENTS.md` الزام‌آور است.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.
