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

PC-B پس از fetch این branch می‌تواند کار Frontend مستقل را از `apps/web` آغاز کند. پیش از
ساخت Design System یا صفحات CRM، Work ID و branch جدا رزرو شود. قرارداد health مشترک در
`packages/contracts` آماده است؛ قراردادهای تجاری هنوز نباید حدس زده شوند.
