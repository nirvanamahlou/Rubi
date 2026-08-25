# قرارداد IAM

نسخه عمومی جاری Permission Contract برابر `4` است. کدهای IAM، Master Data، Customers و
Legal Entity از `@rubi/contracts` منتشر می‌شوند. فهرست قطعی در `IAM_PERMISSION_CODES` و
گروه‌های دامنه قرار دارد؛ `LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES` فقط
`legal-entity.read/switch` را برای هر کاربر فعال دارای نشست معتبر baseline می‌کند.

## مرز عمومی

IAM تنها مالک هویت کاربر، نشست، نقش، مجوز، نگاشت کاربر به شعبه و Audit امنیتی است.
مصرف‌کننده‌ها فقط از `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` در
`@rubi/contracts` و Guardهای عمومی API استفاده می‌کنند؛ import از repository، Prisma model
یا جدول داخلی IAM ممنوع است.

`Branch` در Migration نخست فقط reference پایه با `id`، `code`، `name` و `isActive` است.
چرخه عمر و داده‌های تجاری شعبه متعلق به Master Data می‌ماند. `MASTER-001` برای توسعه
Schema جدید تا ادغام IAM و آزادسازی صریح Migration Lock منتظر می‌ماند.

## احراز هویت و نشست

- `POST /api/v1/iam/auth/login` با نام کاربری اختصاص‌یافته توسط مدیر، access JWT کوتاه‌عمر و refresh token opaque را فقط در
  Cookieهای `HttpOnly`، `SameSite=Lax` و در Production با `Secure` صادر می‌کند.
- فقط SHA-256 بخش secret refresh token ذخیره می‌شود. هر refresh، نشست قبلی را `ROTATED`
  و token یک‌بارمصرف جدید صادر می‌کند؛ reuse کل family را revoke می‌کند.
- رمز با Argon2id و پارامترهای صریح Hash می‌شود. پنج تلاش ناموفق، حساب را ۱۵ دقیقه قفل
  می‌کند و پاسخ login برای حساب موجود/ناموجود یکسان است.
- logout و غیرفعال‌سازی کاربر نشست فعال را revoke می‌کند. فهرست و لغو نشست‌های خود کاربر
  در `GET/DELETE /api/v1/iam/auth/sessions` ارائه می‌شود.

## Authorization و Audit

Guard احراز هویت وضعیت کاربر و نشست را از DB دوباره بررسی می‌کند. کاربر بدون نشست یا
غیرفعال baseline دریافت نمی‌کند؛ Branch scope بدون تغییر می‌ماند و aggregate/manage/branding/
audit/document permissions همچنان deny-by-default هستند. `RequirePermissions` نیز
use caseهای دیگر را deny-by-default نگه می‌دارد و تغییر کاربر actor و Audit ثبت می‌کند. عملیات login،
logout، refresh reuse، ساخت کاربر/نقش، تغییر access/status و لغو نشست Audit می‌شوند؛ هیچ
password یا token خامی در metadata ثبت نمی‌شود.

## راه‌اندازی امن

1. Migration را deploy و `pnpm --filter @rubi/database db:seed` را اجرا کنید؛ Seed قابل
   تکرار فقط permission، نقش سیستمی و reference شعبه مرکزی را می‌سازد.
2. سه مقدار `IAM_BOOTSTRAP_ADMIN_USERNAME`، `IAM_BOOTSTRAP_ADMIN_PASSWORD` و
   `IAM_BOOTSTRAP_ADMIN_NAME`، ایمیل اختیاری و یک `IAM_ACCESS_TOKEN_SECRET` تصادفی حداقل ۳۲ نویسه‌ای را
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

### Handoff IAM-002

- `MASTER-002` مجوزهای `master_data.read/create/update/status.manage/export` را فقط از
  قرارداد عمومی مصرف می‌کند.
- `CUSTOMER-001` مجوزهای `customers.read/create/update/merge/consent.manage/sensitive.read`
  را فقط از قرارداد عمومی مصرف می‌کند.
- Seed همه ۱۷ Permission را به‌صورت upsert ایجاد و به نقش `administrator` متصل می‌کند؛
  این Handoff هیچ دسترسی مستقیمی به مدل یا Repository داخلی IAM نمی‌دهد.
- IAM-002 با Merge Commit `d1f1133` وارد `develop` شد و قفل قرارداد عمومی آن آزاد است.
  از این مبنا، `MASTER-002` و فاز A `CUSTOMER-001` می‌توانند روی Branchهای مستقل شروع شوند.
