# LEGAL-ENTITY-CONTEXT-001 — Issuer Company Context

- **Computer:** PC-A
- **Branch:** `codex/pc-a-legal-entity-context`
- **Base:** `0ba85d4604f6eb4d792bee4c3059a32bcf858738`
- **Status:** IN_PROGRESS
- **Dependency/Lockfile:** RELEASED؛ dependency جدیدی اثبات نشده است

## Gate و انتقال قفل

- PR #21 با Merge `45c107e471d53d1c724303de02ba01a5e0e16b2a` در `origin/develop` است.
- PR #23 با Merge `0ba85d4604f6eb4d792bee4c3059a32bcf858738` در `origin/develop` است.
- هیچ PR باز، `FINANCE-002`، Branch فعال Finance Persistence یا مالک جدید قفل یافت نشد.
- دلیل انتقال: `FINANCE-001 merged via PR #21 and no active FINANCE-002 task exists`.
- Migration Owner و اسناد مرکزی از FINANCE-001 آزاد و برای این Task رزرو شدند.
- Dependency/Lockfile آزاد ماند و manifest/lockfile خارج از Scope است.

## محدوده قطعی

- Legal Entity هویت صادرکننده داخلی است؛ Branch، Tenant، Agency یا Customer Organization نیست.
- تغییر Context هیچ مشتری، قرارداد، رزرو، خرید، رکورد مالی یا داده عملیاتی را فیلتر نمی‌کند.
- دو رکورد واقعی: `NIYAYESH_SEIR_SAHAR` و `JAHAN_BASTAN`؛ Context مجازی `ALL` ذخیره نمی‌شود.
- تمام کاربران مجاز دو شرکت واقعی را می‌بینند؛ `ALL` فقط با `legal-entity.aggregate.read`.
- سند رسمی در `ALL` صادر نمی‌شود و Backend issuer واقعی را دوباره اعتبارسنجی می‌کند.
- Branding و اطلاعات حقوقی نامشخص nullable هستند؛ لوگو یا مشخصات ساختگی ایجاد نمی‌شود.

## قرارداد عمومی و سازگاری

`legal-entities.v1` producer ماژول Legal Entities و مصرف‌کنندگان آن App Shell، Dashboard،
Reporting و ماژول‌های صادرکننده Sales، Reservations، Finance، Procurement و HR هستند.
قرارداد افزایشی است و هیچ قرارداد Branch/IAM موجود را جایگزین نمی‌کند. مصرف‌کنندگان فقط
service عمومی را مصرف می‌کنند و query مستقیم جدول Legal Entity ممنوع است.

حداقل عملیات: فهرست قابل انتخاب، Context کاربر، Switch، Branding Snapshot، اعتبارسنجی
Aggregate، اعتبارسنجی issuer در Issue/Reissue و ثبت Metadata خروجی.

## قفل‌ها

- Migration: `packages/database/prisma/schema.prisma`، Migration و Seed Legal Entity
- Contract: `packages/contracts/src/legal-entities/**` و root export لازم
- Backend: `apps/api/src/legal-entities/**` و registration لازم
- Frontend: `apps/web/src/modules/legal-entities/**`، App Shell و `/system/legal-entities`
- Central docs: `WORK_ASSIGNMENTS.md`، `PLANS.md`، `docs/PROJECT_STATUS.md` و اسناد مرتبط

تا Merge و Handoff این Task، MASTER-003، FINANCE-002 یا Task دیگر مجاز به ایجاد Prisma/
Migration یا تغییر فایل‌های مرکزی رزروشده نیست.

## تصمیم باز شماره‌گذاری

شماره‌گذاری مستقل بر مبنای Legal Entity و document type در قرارداد قابل توسعه می‌ماند،
اما Sequence فعلی بدون سیاست مصوب تغییر نمی‌کند. `ALL` هرگز issuer یا prefix نیست.

## Quality Gate

Prisma format/validate/generate، migration روی PostgreSQL خالی، status، Seed دوبار، lint،
typecheck، test، build، smoke Login/Dashboard/System/Switch، `git diff --check`، scope،
secret/PII و Markdown links پیش از تحویل اجرا می‌شوند.
