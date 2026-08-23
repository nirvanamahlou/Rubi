# CUSTOMER-001 — Foundation مشتریان و مسافران

- **Computer:** PC-A
- **Branch:** `codex/pc-a-customer-foundation`
- **Baseline:** `f4381b5c842c962652f6fb168b3a6507177393e4`
- **Owner:** PC-A
- **Overall status:** IN_PROGRESS
- **Phase A status:** READY_FOR_REVIEW
- **Phase B status:** BLOCKED — منتظر Merge و Handoff مستقل MASTER-002
- **Persistence:** عمداً پیاده‌سازی نشده

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
- مقدار یا فایل مدرک هویتی، داده واقعی مشتری/مسافر یا PII حساس نگهداری نمی‌شود.
- `customers.sensitive.read` فقط در طراحی Permission دیده می‌شود و هیچ داده
  حساس در فاز A ارائه نمی‌شود.
- Candidate Detection تصمیم ادغام نمی‌گیرد. Review دستی به
  `customers.merge` و Audit نیاز دارد.
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

شروع فاز B فقط پس از Merge و Handoff مستقل MASTER-002 مجاز است. Task بعدی باید
پیش از تغییر Prisma، Migration یا Dependency قفل مستقل رزرو کند. فاز B باید:

1. مدل و FKهای واقعی را با قواعد [مدل داده](../DATA_MODEL.md) طراحی کند.
2. Master Data را فقط از Contract عمومی MASTER-002 مصرف کند.
3. Repository و API واقعی را پشت `CustomerApplicationPort` بسازد.
4. ثبت Consent، Duplicate Review و هر عملیات Merge را Audit کند.
5. سیاست نگهداری/رمزنگاری مدارک حساس را پس از بسته‌شدن تصمیم باز PII اجرا کند.
6. تست Integration و Authorization واقعی را اضافه کند.

## کنترل‌های تحویل

نتایج نهایی lint، typecheck، تست، build، Prettier، `git diff --check`،
Secret/PII scan و Scope scan در Draft PR ثبت می‌شوند.
