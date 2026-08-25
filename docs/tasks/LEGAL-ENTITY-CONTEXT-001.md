# LEGAL-ENTITY-CONTEXT-001 — Issuer Company Context

- **Computer:** PC-A
- **Branch:** `codex/pc-a-legal-entity-context`
- **Base:** `0ba85d4604f6eb4d792bee4c3059a32bcf858738`
- **Draft PR:** #24 → `develop`
- **Status:** READY_FOR_REVIEW
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

## خروجی پیاده‌سازی

- مدل‌ها: `LegalEntity`، `UserLegalEntityContext`، `LegalEntityBrandingVersion`، `LegalEntityAuditEvent` و `LegalEntityDocumentIssue` با FK، Index، Constraint و Version خوش‌بینانه.
- APIها: list/selectable، context/switch، issue targets، issue/reissue، branding، audit، detail/update و status؛ همگی Authenticated و Deny-by-default.
- UI: `LegalEntityProvider` سراسری، selector RTL/Responsive با stateهای loading/error/success، sync میان tabها و صفحه مدیریتی `/system/legal-entities`.
- خروجی رسمی: `ALL` سربرگ ترکیبی ندارد؛ prompt انتخاب issuer یا دو target مستقل ارائه می‌شود و metadata/snapshot immutable ثبت می‌شود.
- سربرگ اجباری: `requiresLetterhead=true` نبود asset را با `LEGAL_ENTITY_LETTERHEAD_REQUIRED` در Backend رد می‌کند.

## وضعیت Branding

- نیایش سیر سحر: لوگوی موجود `/brand/niyayesh.png` بدون تغییر حفظ شده است؛ referenceهای Documents و مشخصات حقوقی نامعلوم عمداً nullable هستند.
- جهان باستان: لوگو/سربرگ واقعی موجود نبود؛ Placeholderهای «لوگو تکمیل نشده» و «سربرگ تکمیل نشده» نمایش داده می‌شوند و مقدار ساختگی Seed نشده است.
- Public Upload Adapter اجرایی Documents هنوز در Repository وجود ندارد؛ کنترل‌های انتخاب فایل برای مدیر آماده اما غیرفعال‌اند تا قرارداد واقعی storage/access/audit فراهم شود. مهر و امضا URL عمومی ندارند و برای کاربر فاقد Permission redacted می‌شوند.

## Quality Gate

- `pnpm install --frozen-lockfile`، Prisma format/validate/generate و Production Build کل Monorepo پاس شدند.
- هر ۶ migration روی PostgreSQL خالی اجرا و status به‌روز شد؛ Seed دوبار بدون Duplicate و با شمارش `2 legal entities / 2 branding snapshots / 8 permissions` پاس شد.
- lint و typecheck کل Monorepo و ۲۲۲ تست در ۶۲ فایل پاس شدند؛ route `/system/legal-entities` در Build تولید شد.
- Smoke واقعی با Cookie session: Login، Login page، Dashboard و System Legal Entities، Switch به جهان باستان و حفظ پس از Refresh، `ALL`، prompt، دو target مستقل، Issue/Reissue Metadata و Audit پاس شد.
- in-app Browser به‌علت reset داخلی runtime در دو تلاش قابل اتصال نبود؛ visual-only interaction جایگزین نشد. HTTP runtime، component/model tests، RTL/Responsive markup و Radix keyboard contract بررسی شدند.
- `git diff --check`، Scope، Dependency/Lockfile، Secret/PII و Markdown link scan پاس شدند؛ دیتابیس‌ها و processهای موقت پاک شدند.

## تصمیم‌ها و Handoff باز

- `DEC-OPEN-010`: Prefix و Sequence اتمیک هر document type در scope issuer باید در Task مستقل پس از تصمیم مالی/حقوقی اجرا شود؛ `ALL` هرگز prefix نیست.
- Documents Public Upload Adapter باید assetهای لوگو/سربرگ/پابرگ/مهر/امضا را version و authorize کند؛ Legal Entity فقط reference را از Contract عمومی می‌پذیرد.
- قفل Migration، Legal Entity Contract و اسناد مرکزی تا Merge/Handoff فعال می‌مانند؛ Dependency/Lockfile آزاد است.
