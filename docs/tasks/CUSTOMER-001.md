# CUSTOMER-001 — مشتریان و مسافران

- **Computer:** PC-A
- **Branch:** `codex/pc-a-customer-persistence`
- **Phase B baseline:** `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb`
- **Owner:** PC-A
- **Overall status:** READY_FOR_REVIEW
- **Phase A status:** DONE/MERGED — Merge `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
- **Phase B status:** READY_FOR_REVIEW
- **Implementation commits:** `55686a1` و `a8cd0be`
- **Migration:** `20260824093000_customer_persistence`

## نتیجه فاز B

Persistence و قرارداد عمومی Customers، API واقعی، کنترل Permission و Audit و
Customer 360 متصل به Backend تکمیل شد. مدل‌های Customer، Contact، Address، Consent،
Relationship، Status History، Duplicate Candidate و Customer Audit Event با FKهای واقعی،
زمان UTC و optimistic versioning ایجاد شدند. حذف فیزیکی مشتری وجود ندارد و غیرفعال‌سازی
به‌صورت status transition ثبت می‌شود.

Frontend فارسی، RTL و Responsive اکنون مسیر واقعی API را برای فهرست، جست‌وجو، فیلتر،
مرتب‌سازی، صفحه‌بندی، ایجاد/ویرایش، مشاهده Customer 360، تغییر وضعیت، تماس‌ها، نشانی‌ها،
رضایت‌نامه‌ها، همراهان و بررسی موارد مشابه مصرف می‌کند. حالت‌های loading، empty، error،
forbidden، success و conflict پوشش داده شده‌اند.

## مرز امنیت و داده

- مقدار خام تلفن یا ایمیل ذخیره نمی‌شود؛ فقط fingerprint مبتنی بر SHA-256 و مقدار
  ماسک‌شده برای نمایش نگهداری می‌شود.
- هیچ مقدار یا فایل مدرک هویتی و هیچ داده واقعی مسافر وارد Schema، Seed یا Git نشده است.
- تاریخ تولد بدون `customers.sensitive.read` به‌صورت ماسک‌شده بازگردانده می‌شود.
- تمام query و mutationها branch-scoped هستند و Guardهای واقعی احراز هویت و Permission
  روی Controller اعمال شده‌اند.
- Consent، تغییر وضعیت، تغییرات اصلی Customer، Contact/Address/Relationship و تصمیم
  Duplicate Review در Customer Audit Event ثبت می‌شوند.
- `DEC-OPEN-006` باز است؛ نگهداری مدارک هویتی حساس همچنان ممنوع می‌ماند.
- `DEC-OPEN-011` باز است؛ Duplicate Candidate Detection و Review دستی پیاده‌سازی شده،
  اما merge واقعی و auto-merge مسدود است. Review فقط `DISTINCT` یا
  `MERGE_PROPOSED` را ثبت می‌کند و merge پیشنهادی نتیجه `BLOCKED` دارد.

## قرارداد و API

قرارداد versioned عمومی `customers.v1` از `@rubi/contracts` منتشر شده است. مسیرهای
فعال زیر پشت `/api/v1/customers` قرار دارند:

- فهرست و ایجاد Customer
- مشاهده و ویرایش Customer با کنترل version
- تغییر وضعیت فعال/غیرفعال
- فهرست و افزودن Contact، Address و Companion
- ثبت Consent و مشاهده تاریخچه آن
- تولید Duplicate Candidate و ثبت Review دستی

Master Data فقط از قرارداد عمومی و FKهای تعریف‌شده مصرف می‌شود؛ هیچ import یا query
مستقیم به Repository داخلی IAM یا Master Data ایجاد نشده است.

## Migration و Fixture

Migration افزایشی روی PostgreSQL 18 ایزوله و تازه از صفر deploy شد و
`prisma migrate status` آن را up-to-date گزارش کرد. Migration شامل DROP، TRUNCATE یا
DELETE نیست. Seed فقط fixtureهای ساختگی و non-login ایجاد می‌کند و دو اجرای متوالی آن
idempotent بود؛ شمارش پایدار Customer/Contact/Address/Relationship برابر
`2/1/1/1` باقی ماند. هیچ Volume یا داده موجود Rubi تغییر یا حذف نشد.

## کنترل‌های تحویل

- نصب frozen بدون تغییر dependency یا lockfile پاس شد.
- Prisma format، validate، generate، migration deploy/status و seed دوگانه پاس شدند.
- lint، typecheck و build کل Monorepo پاس شدند.
- ۱۰۴ تست در Contracts، Database، API، Web، Worker و Config پاس شدند.
- تست‌های contract، migration، repository، service، HTTP validation،
  authorization/permission و frontend API client اضافه شدند.
- `git diff --check`، Scope scan و Secret/PII scan پاس شدند.
- فایل manifest یا lockfile تغییر نکرده است.

## ریسک و Handoff بازبینی

Reviewer باید Migration، branch scoping، optimistic conflict، Audit و عدم ذخیره PII خام
را بازبینی کند. ادغام PR به `develop` مجاز به اجرای merge واقعی مشتری نیست و هیچ
تصمیم باز محصول/امنیت را نمی‌بندد. فعال‌سازی نگهداری مدارک حساس یا merge واقعی فقط پس
از تصمیم قطعی، ثبت در `docs/DECISIONS.md` و Work Item مستقل مجاز است. نرخ ارز
authoritative و تولید واقعی Excel/PDF خارج از Scope این Task باقی می‌مانند.
