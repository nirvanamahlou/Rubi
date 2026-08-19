# وظایف PC-A

## FOUNDATION-001 — Technical Bootstrap

- مالک: `PC-A`
- Branch: `codex/pc-a-technical-bootstrap`
- Base: Commit `cc0d411` از `codex/pc-a-bootstrap`
- وضعیت: `DONE` — implementation commit `d9a9793` روی `origin` Push شد.

### محدوده تکمیل‌شده

- pnpm/Turborepo monorepo و TypeScript strict presets
- Next.js Web App فارسی/RTL با صفحه‌های `/` و `/status`
- NestJS API با `/api/v1/health`، Swagger، validation، CORS، error envelope و shutdown hook
- NestJS standalone Worker با BullMQ/ioredis، Redis startup health و shutdown hook
- Prisma 7 PostgreSQL datasource/Client بدون model، Migration یا Seed
- Compose محلی PostgreSQL، Redis، MinIO و bucket initialization
- ESLint، Prettier، Vitest، build scripts و lockfile

### کنترل پذیرش

- Prisma format/validate/generate: پاس
- ESLint، TypeScript typecheck، unit tests و production build: پاس
- Compose config و health سرویس‌ها: پاس
- API health، Swagger، Web RTL/status، MinIO و Worker/Redis smoke: پاس
- Migration تجاری: ایجاد نشده

### Handoff

PC-B پس از دریافت مبنای ادغام‌شده می‌تواند Work Itemهای Full-Stack ماژول‌های تحت مالکیت
خود را آغاز کند. پیش از ساخت Design System یا صفحات CRM، Work ID و branch جدا رزرو شود.
قرارداد health مشترک در `packages/contracts` آماده است؛ قراردادهای تجاری هنوز نباید حدس
زده شوند.

## DOCS-002 — HR Module Ownership

- مالک: `PC-A`
- Branch: `codex/pc-a-hr-module-ownership`
- Base: Commit `bdb5461` از `origin/develop`
- وضعیت: `READY_FOR_REVIEW`

### محدوده تکمیل‌شده

- افزودن منابع انسانی به منوی اصلی و ثبت دامنه و محدودیت نسخه اولیه
- ثبت مالکیت نهایی ماژول‌های PC-A و PC-B با مسئولیت Full-Stack
- ثبت قفل Migration، Dependency/Lockfile، فایل مرکزی و قرارداد مشترک
- ثبت جداسازی Employee از Customer/Passenger و مرز کنترل‌شده HR با IAM/Finance/Documents
- فقط مستندات؛ بدون تغییر کد، Dependency، Prisma Schema یا Migration

### Handoff

PC-B باید PR را review و پس از ادغام، توسعه HR را در Work Item و Branch مستقل آغاز کند.
هر قرارداد HR → Finance یا تغییر فایل مرکزی پیش از اجرا نیازمند ثبت و هماهنگی است.
