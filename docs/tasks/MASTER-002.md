# MASTER-002 — Master Data Persistence

- وضعیت: `IN_PROGRESS`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-persistence`
- Base: `f4381b5c842c962652f6fb168b3a6507177393e4`
- Migration Owner: `PC-B/MASTER-002`
- Dependency/Lockfile Owner: `PC-B/MASTER-002`
- Shared Contract Owner: `PC-B/MASTER-002`

## محدوده

Persistence، Repository، Application Service، REST API نسخه‌دار، قرارداد عمومی و اتصال
واقعی UI برای کشور، شهر، ارز، بانک، بیمه، ایرلاین، هتل، Organization/Role، کارگزار،
لیدر و نحوه آشنایی تکمیل می‌شود. نرخ ارز فقط Draft/Preview است و منبع محاسبه یا گزارش
مالی authoritative محسوب نمی‌شود.

## مرز IAM و شعبه

مصرف IAM فقط از `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` در
`@rubi/contracts` انجام می‌شود. هیچ جدول، Prisma model یا Repository داخلی IAM از Master
Data query یا import نمی‌شود. Permissionها deny-by-default و عملیات تغییر با actor، branch
scope و Audit ماژول ثبت می‌شوند.

## Migration و یکپارچگی

- Migration فقط افزایشی و غیرمخرب است؛ FK، Unique و Index واقعی دارد.
- رکورد reference حذف نمی‌شود و با `isActive/deactivatedAt` غیرفعال می‌شود.
- زمان‌ها UTC و نرخ Draft با Decimal و دو Currency FK ذخیره می‌شود.
- Organization profile واحد و Role چندگانه دارد؛ Agency/Corporate/Supplier duplicate نیست.
- Seed/Fixture فقط داده synthetic و تکرارپذیر توسعه ایجاد می‌کند.

## Export و محدودیت‌ها

درخواست async export شامل snapshot فیلتر، ستون‌ها، Permission، actor، branch، locale و
timezone پایدار می‌شود. تا قرارداد عمومی Documents/Worker، وضعیت درخواست صریحاً
`AWAITING_DOCUMENTS_WORKER` است و هیچ فایل Excel/PDF ساختگی یا artifact جعلی تولید نمی‌شود.

## معیار پذیرش

- Prisma format/validate/generate و migrate deploy/status روی PostgreSQL محلی
- Contract، Unit، Integration، Permission، Migration و Seed idempotency tests
- CRUD، activate/deactivate، search/filter/sort allowlist و pagination واقعی
- UI فارسی/RTL با Loading/Empty/Error/Permission/Success و عملیات واقعی
- lint، typecheck، affected/full tests، production build، diff/secret/scope scan
- Commitهای کوچک، Push معمولی و Draft PR به `develop` بدون Merge

## Handoff لازم

پس از Merge، قفل‌های Migration، Dependency/Lockfile، Master contract و اسناد مرکزی باید
در Handoff مستقل برای فاز B `CUSTOMER-001` آزاد و دوباره رزرو شوند؛ انتقال خودکار نیست.
