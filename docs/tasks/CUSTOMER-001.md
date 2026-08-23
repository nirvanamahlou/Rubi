# CUSTOMER-001 — Foundation مشتریان و مسافران

- **Computer:** PC-A
- **Branch:** `codex/pc-a-customer-foundation`
- **Baseline:** `f4381b5c842c962652f6fb168b3a6507177393e4`
- **Owner:** PC-A
- **Overall status:** IN_PROGRESS
- **Phase A status:** DONE/MERGED — Merge `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
- **Phase B status:** IN_PROGRESS — قفل‌های لازم با `MASTER002-HANDOFF-001` رزرو شدند
- **Persistence:** در فاز A عمداً پیاده‌سازی نشد؛ در فاز B برنامه‌ریزی شده است
- **Phase B baseline:** `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`

## هدف فاز A

ایجاد Foundation رابط فارسی، RTL و Responsive برای مشتریان و مسافران، طراحی
Application/API ماژول‌محلی و منطق قابل‌تست دامنه، بدون تغییر Database یا قرارداد
مشترک. این فاز هیچ رکورد authoritative تولید نمی‌کند.

## تحویل‌های تکمیل‌شده

- رابط فهرست مشتریان و مسافران با جست‌وجو، فیلتر وضعیت، مرتب‌سازی و صفحه‌بندی
- فرم‌های ایجاد، مشاهده و ویرایش با Validation و Submit مسدود
- پیش‌نمایش Customer 360 برای هویت غیرحساس، ارتباط، نشانی، رضایت‌نامه و همراهان
- حالت‌های Loading، Empty، Error، Permission و Preview
- Duplicate Candidate Detection با امتیاز و دلیل
- صفحه بررسی دستی موارد مشابه؛ بدون Auto-merge
- DTOها، Application Port و مسیرهای پیشنهادی API در مرز ماژول Customers
- نگاشت عملیات به Permissionهای عمومی `customers.*` از `@rubi/contracts`
- تست‌های Domain، Permission، UI contract و Boundary

## مرز امنیت و داده

- داده‌های UI ساختگی، دارای شناسه `preview-*` و تماس ماسک‌شده هستند.
- ذخیره مقدار یا فایل مدرک هویتی و PII حساس تا تصمیم قطعی PII ممنوع است.
- `customers.sensitive.read` فقط در طراحی Permission دیده می‌شود و هیچ داده
  حساس در فاز A ارائه نمی‌شود.
- Duplicate auto-merge ممنوع است. Candidate Detection فقط پیشنهاد می‌دهد و Review دستی
  با `customers.merge` و Audit تنها مسیر مجاز تصمیم‌گیری است.
- دسترسی پیش‌فرض deny است و عملیات با Permissionهای
  `customers.read`، `customers.create`، `customers.update`،
  `customers.consent.manage` و `customers.merge` طراحی شده‌اند.

## API و Application Design

نسخه پیشنهادی `customers.v1-draft` و پیشوند `/api/v1/customers` است.
`CustomerApplicationPort` فقط قرارداد use caseها را تعریف می‌کند. در این Task
هیچ Controller فعال، Repository implementation، Prisma client یا دسترسی مستقیم
به IAM و Master Data ایجاد نشده است.

## موارد عمداً خارج از فاز A

- Prisma Schema، Migration، Seed و FKهای واقعی
- Repository و Persistence واقعی
- Endpoint اجرایی و اتصال شبکه Frontend
- ذخیره مدارک هویتی یا فایل‌ها
- Auto-merge موارد مشابه
- تغییر Dependency، Lockfile یا `packages/contracts/src/index.ts`
- تغییر فایل‌های مرکزی قفل‌شده توسط PC-B

## Handoff فاز B

MASTER-002 با Merge `ddfebb3` ادغام و Handoff مستقل انجام شد. فاز B فقط دامنه
Customers را پوشش می‌دهد و حق تغییر فایل‌های داخلی IAM یا Master Data را ندارد.
قفل Migration، Customer shared-contract/root export و اسناد مرکزی Sprint برای PC-A رزرو
هستند. قفل Dependency/Lockfile فقط هنگام نیاز واقعی و پس از ثبت فایل دقیق فعال می‌شود.
هیچ Volume، داده یا تاریخچه Migration محلی حذف یا دستی دست‌کاری نمی‌شود و Migrationهای
بعدی روی PostgreSQL ایزوله و تازه تست می‌شوند. فاز B باید:

1. مدل و FKهای واقعی را با قواعد [مدل داده](../DATA_MODEL.md) طراحی کند.
2. Master Data را فقط از قرارداد عمومی `@rubi/contracts` مصرف کند.
3. Repository و API واقعی را پشت `CustomerApplicationPort` بسازد.
4. ثبت Consent، Duplicate Review و هر عملیات Merge را Audit کند.
5. سیاست نگهداری/رمزنگاری مدارک حساس را پس از بسته‌شدن تصمیم باز PII اجرا کند.
6. تست Integration و Authorization واقعی را اضافه کند.
7. نرخ ارز authoritative یا تولید واقعی Excel/PDF را در این Handoff پیاده‌سازی نکند.


## کنترل‌های تحویل

نتایج نهایی lint، typecheck، تست، build، Prettier، `git diff --check`،
Secret/PII scan و Scope scan در Draft PR ثبت می‌شوند.
