# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-19 — PC-A Technical Bootstrap

## خلاصه

- مرحله جاری: **مرحله 2 — Foundation / Technical Bootstrap**
- وضعیت: **اسکلت فنی و زیرساخت Local آماده Review؛ بدون قابلیت یا Migration تجاری**
- Repository: `Rubi`، Remote با نام `origin`
- Base: Commit `cc0d411` از `codex/pc-a-bootstrap`
- شاخه فعال: `codex/pc-a-technical-bootstrap`
- Implementation Commit: `d9a9793`، Push موفق به `origin/codex/pc-a-technical-bootstrap`
- محیط مسئول: `COMPUTER_ID=PC-A`

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
- `develop` ایجاد نشده و هیچ merge/deploy انجام نشده است.
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

1. `git fetch --prune origin` اجرا و شاخه `codex/pc-a-technical-bootstrap` را review کند.
2. پس از تأیید/ادغام مبنا، Work ID و شاخه مستقل `codex/pc-b-<task>` رزرو کند.
3. کار UI پایه می‌تواند از `apps/web` شروع شود؛ API health و env اتصال Backend آماده‌اند.
4. Design System کامل، صفحات CRM و قراردادهای تجاری باید در Work Itemهای بعدی ساخته شوند.
5. تصمیم‌های P0 مالی/Provider حدس زده نشوند و هیچ schema تجاری در این branch اضافه نشود.

## ریسک‌ها و تصمیم‌های باز

- دامنه دقیق حسابداری عملیاتی و integration با حسابداری قانونی هنوز نهایی نیست.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست مالی ارز، rounding، مالیات و شماره‌گذاری اسناد باید قبل از Migration تایید شود.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.
