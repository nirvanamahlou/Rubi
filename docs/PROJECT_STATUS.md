# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-19 — PC-A HR Module Ownership

## خلاصه

- مرحله جاری: **مرحله 2 — Foundation / تثبیت مالکیت ماژول‌ها**
- وضعیت: **Technical Bootstrap روی develop؛ مستندات HR و مالکیت نهایی آماده Review**
- Repository: `Rubi`، Remote با نام `origin`
- Base: Commit `bdb5461` از `origin/develop`
- شاخه فعال: `codex/pc-a-hr-module-ownership`
- Work Item: `DOCS-002`؛ فقط مستندات و بدون تغییر کد/Dependency/Schema/Migration
- محیط مسئول: `COMPUTER_ID=PC-A`

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

## عمداً انجام نشده

- هیچ ماژول تجاری CRM، Authentication، user/role، Dashboard یا Design System ساخته نشده است.
- Prisma schema عمداً model ندارد؛ هیچ Migration یا Seed ایجاد نشده است.
- Nginx، CI و deployment محیط غیرمحلی هنوز ساخته نشده‌اند.
- هیچ قابلیت تجاری، Schema یا Migration در Work Item مستندی `DOCS-002` ایجاد نشده است.
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

## Handoff به PC-B

1. PR شاخه `codex/pc-a-hr-module-ownership` به `develop` را review کند.
2. پس از ادغام، Work Item مستقل PC-B برای HR یا سایر ماژول‌های تحت مالکیت خود رزرو کند.
3. پیش از هر Schema/Migration، Dependency/Lockfile یا فایل مرکزی، قفل فعال را ثبت کند.
4. قرارداد HR → Finance و هر API/Event مشترک پیش از پیاده‌سازی هماهنگ و version شود.
5. تصمیم‌های باز HR و P0 حدس زده نشوند و payroll قانونی کامل وارد نسخه اولیه نشود.

## ریسک‌ها و تصمیم‌های باز

- دامنه دقیق حسابداری عملیاتی و integration با حسابداری قانونی هنوز نهایی نیست.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست مالی ارز، rounding، مالیات و شماره‌گذاری اسناد باید قبل از Migration تایید شود.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.
