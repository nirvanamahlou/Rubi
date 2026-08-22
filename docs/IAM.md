# قرارداد IAM-001

## مرز عمومی

IAM تنها مالک هویت کاربر، نشست، نقش، مجوز، نگاشت کاربر به شعبه و Audit امنیتی است.
مصرف‌کننده‌ها فقط از `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` در
`@rubi/contracts` و Guardهای عمومی API استفاده می‌کنند؛ import از repository، Prisma model
یا جدول داخلی IAM ممنوع است.

`Branch` در Migration نخست فقط reference پایه با `id`، `code`، `name` و `isActive` است.
چرخه عمر و داده‌های تجاری شعبه متعلق به Master Data می‌ماند. `MASTER-001` برای توسعه
Schema جدید تا ادغام IAM و آزادسازی صریح Migration Lock منتظر می‌ماند.

## احراز هویت و نشست

- `POST /api/v1/iam/auth/login` access JWT کوتاه‌عمر و refresh token opaque را فقط در
  Cookieهای `HttpOnly`، `SameSite=Lax` و در Production با `Secure` صادر می‌کند.
- فقط SHA-256 بخش secret refresh token ذخیره می‌شود. هر refresh، نشست قبلی را `ROTATED`
  و token یک‌بارمصرف جدید صادر می‌کند؛ reuse کل family را revoke می‌کند.
- رمز با Argon2id و پارامترهای صریح Hash می‌شود. پنج تلاش ناموفق، حساب را ۱۵ دقیقه قفل
  می‌کند و پاسخ login برای حساب موجود/ناموجود یکسان است.
- logout و غیرفعال‌سازی کاربر نشست فعال را revoke می‌کند. فهرست و لغو نشست‌های خود کاربر
  در `GET/DELETE /api/v1/iam/auth/sessions` ارائه می‌شود.

## Authorization و Audit

Guard احراز هویت وضعیت کاربر و نشست را از DB دوباره بررسی می‌کند. `RequirePermissions`
deny-by-default است و use caseهای تغییر کاربر نیز actor و Audit ثبت می‌کنند. عملیات login،
logout، refresh reuse، ساخت کاربر/نقش، تغییر access/status و لغو نشست Audit می‌شوند؛ هیچ
password یا token خامی در metadata ثبت نمی‌شود.

## راه‌اندازی امن

1. Migration را deploy و `pnpm --filter @rubi/database db:seed` را اجرا کنید؛ Seed قابل
   تکرار فقط permission، نقش سیستمی و reference شعبه مرکزی را می‌سازد.
2. سه مقدار `IAM_BOOTSTRAP_ADMIN_EMAIL`، `IAM_BOOTSTRAP_ADMIN_PASSWORD` و
   `IAM_BOOTSTRAP_ADMIN_NAME` و یک `IAM_ACCESS_TOKEN_SECRET` تصادفی حداقل ۳۲ نویسه‌ای را
   فقط در Environment تنظیم کنید.
3. `pnpm --filter @rubi/api iam:bootstrap-admin` را یک‌بار اجرا و بلافاصله مقادیر bootstrap
   را از Environment حذف کنید. فرمان idempotent است و هیچ رمز پیش‌فرضی در Git ندارد.

## Handoff به PC-B

- Contract عمومی version فعلی: `@rubi/contracts` در همین PR؛ actor شامل `userId`،
  `sessionId`، `permissions` و `branchIds` است.
- PC-B می‌تواند `BranchReference` و permission codeهای منتشرشده را مصرف کند، اما جدول‌های
  `iam_*` را مستقیم query نمی‌کند.
- Migration، Dependency/Lockfile و shared-contract lock تا ادغام این PR فعال می‌ماند؛
  آزادسازی آن پس از Merge در `WORK_ASSIGNMENTS.md` ثبت می‌شود.
