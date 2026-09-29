# SPRINT2-PLANNING-001 — Master Data Persistence و Customer Foundation

- وضعیت: `READY_FOR_REVIEW`
- مالک برنامه‌ریزی: `PC-A`
- Branch: `codex/pc-a-sprint-2-planning`
- Base: `9c69124798af43ef2a9f8147576135cd86a8515d`
- نوع Task: فقط مستندات؛ بدون کد، Schema، Migration، Dependency یا Lockfile

## هدف

Sprint دوم Persistence واقعی Master Data و Foundation دامنه Customers را شروع می‌کند،
اما فایل‌های مرکزی و Migration را هم‌زمان بین دو کامپیوتر تقسیم نمی‌کند. یک Task کوچک
IAM ابتدا Permission Contract مورد نیاز هر دو مصرف‌کننده را منتشر می‌کند.

## موج صفر — `IAM-002` روی PC-A

خروجی لازم:

- Permission Codeهای versioned برای Master Data و Customers
- Seed تکرارپذیر permissionها و انتساب آن‌ها به نقش administrator
- تست Contract، Seed idempotency و سازگاری Guard/actor
- Handoff عمومی به `MASTER-002` و `CUSTOMER-001`

محدودیت: تغییر Prisma Schema، Migration، Dependency و Lockfile ممنوع است. این Task فقط
قرارداد IAM و Seed موجود را در محدوده رزروشده گسترش می‌دهد.

## موج اول — توسعه موازی

### `MASTER-002` روی PC-B

پس از Merge IAM-002، PC-B Full-Stack Persistence دوازده Catalog موجود را تکمیل می‌کند:

- کشور و شهر
- ارز؛ نرخ ارز authoritative تا حل `DEC-OPEN-004` مسدود است
- بانک و بیمه
- ایرلاین و هتل
- Organization با نقش‌های آژانس/شرکت و بدون پروفایل تکراری
- کارگزار و لیدر
- نحوه آشنایی

الزامات: FK واقعی، deactivate به‌جای حذف reference مصرف‌شده، UTC، actor/audit، branch
scope، REST versioned، allowlist filter/sort، pagination، status action، contract/integration
test و اتصال UI موجود. Export واقعی باید permission snapshot داشته باشد؛ افزودن Worker یا
Dependency جدید فقط در قفل همین Task و با توجیه ثبت‌شده مجاز است. تا ایجاد قرارداد عمومی
Documents/Worker، فقط قرارداد async export و snapshot فیلتر/permission پایدار می‌شود و
هیچ artifact یا فایل نمایشی ساختگی تولید نمی‌شود.

### `CUSTOMER-001` فاز A روی PC-A

فاز A بدون Persistence موارد زیر را تثبیت می‌کند:

- Customer/Passenger identity غیرحساس و Customer 360
- contact، address، consent و relationship/companion
- UI فارسی/RTL، search/filter، create/view/edit و stateهای استاندارد
- DTO/application contract ماژول‌محلی و تست validation/permission/boundary
- Duplicate candidate detection و review state بدون auto-merge

ممنوع: Prisma، Migration، manifest، lockfile، قرارداد root مشترک، فایل IAM/Master، ذخیره
مقدار یا فایل حساس هویتی و auto-merge.

## موج دوم — Handoff و تکمیل Customer

پس از Merge MASTER-002:

1. PC-B نتیجه Migration، Dependency و Master contract را ثبت و قفل‌ها را آزاد می‌کند.
2. یک PR/Handoff مستقل، Migration Owner و فایل‌های مرکزی لازم را به PC-A/CUSTOMER-001
   فاز B اختصاص می‌دهد.
3. PC-A مدل، Migration، Repository، قرارداد عمومی، Backend واقعی و اتصال UI را تکمیل می‌کند.
4. Customer فقط پس از migration/permission/audit/integration/E2E tests به `DONE` می‌رسد.

## مرز داده و تصمیم‌های باز

- Customers مالک identity، contact، address، consent، relationship و merge history است.
- Master Data فقط referenceهای geography/organization را با port عمومی عرضه می‌کند.
- Sales در آینده customer/passenger ID را reference می‌کند و تخصیص قراردادی را مالک است.
- `DEC-OPEN-006`: تا تصمیم retention/residency/key management، PII حساس و فایل مدارک ذخیره نمی‌شود.
- `DEC-OPEN-011`: تا تصمیم authority/threshold، ادغام خودکار مشتری ممنوع است.
- `DEC-OPEN-004`: نرخ ارز authoritative و مصرف مالی آن خارج از Migration قطعی Master است.

## Quality Gate مشترک

- frozen install و supply-chain policy
- Prisma format/validate/generate و migrate deploy/status برای Task دارای Migration
- lint، typecheck، unit/contract/integration/permission tests و affected build
- Seed idempotency، FK/integrity، deactivate/reference و duplicate behavior tests
- `git diff --check`، Secret/PII scan، scope check و مستند Handoff
- هیچ Merge خودکار، Force Push یا تغییر مستقیم `main`/`develop`

## Definition of Ready پس از Merge این برنامه

- `IAM-002` فوراً Ready است.
- `MASTER-002` از نظر مالکیت Ready و از نظر اجرا منتظر Merge/Handoff `IAM-002` است.
- `CUSTOMER-001` فاز A از نظر Scope Ready و شروع آن پس از IAM-002 انجام می‌شود؛ فاز B
  تا Handoff Migration از Master Blocked است.
