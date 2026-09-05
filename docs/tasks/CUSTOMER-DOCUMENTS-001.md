# CUSTOMER-DOCUMENTS-001 — اتصال مدارک به Customer 360

## وضعیت و محدوده

- مالک: `PC-A`
- Branch: `codex/pc-a-customer-documents-integration`
- Base: `origin/develop@9608607`
- وضعیت: `READY_FOR_REVIEW`
- Migration، Schema، Seed، Dependency و Lockfile: بدون تغییر

این Slice وضعیت نمایشی «در انتظار زیرساخت مدارک» را در تب پرونده Customer 360 با اتصال واقعی به آرشیو Documents جایگزین می‌کند. مالکیت فایل، metadata، نسخه، محرمانگی، اسکن و تاریخچه دسترسی همچنان نزد Documents است.

## جریان عملیاتی

1. با بازشدن تب پرونده، Web فقط از قرارداد عمومی `documents.v1` استفاده می‌کند.
2. درخواست با `domain=CUSTOMER_IDENTITY`، شعبه مالک مشتری و مرجع canonical کامل `customers / Customer / customerId` ارسال می‌شود.
3. Backend فیلتر منبع را all-or-none اعتبارسنجی، trim و سپس همراه Branch و Domain scope روی Relation نوع `PRIMARY_CASE` اعمال می‌کند.
4. پنل تعداد، عنوان، کد آرشیو، نوع، نسخه، تاریخ اعتبار و وضعیت اسکن هر فایل را نشان می‌دهد.
5. بارگذاری از داخل پرونده، Branch و source را از مشتری جاری می‌گیرد؛ نوع فایل، اندازه، نوع مدرک، تاریخ انقضا، Permission و Domain دوباره در Documents Backend کنترل می‌شوند.
6. فایل در فضای خصوصی/قرنطینه ذخیره می‌شود و فقط نتیجه اسکن `CLEAN` قابل دریافت است. اگر Antivirus Adapter فعال نباشد، UI و Backend fail-closed باقی می‌مانند.

## قرارداد عمومی افزایشی

`DocumentListQueryV1` سه فیلد اختیاری و backward-compatible دارد:

- `sourceModule`
- `sourceEntityType`
- `sourceEntityId`

هر سه باید هم‌زمان ارائه شوند؛ ورودی ناقص یا whitespace با `DOCUMENT_SOURCE_FILTER_INCOMPLETE` رد می‌شود. پاسخ فهرست همچنان شناسه خام source را برنمی‌گرداند.

## مرز امنیت و دامنه

- Customers هیچ Query مستقیم به جدول Documents و هیچ import از کد داخلی Web آن ماژول ندارد.
- دسترسی اسناد بر اساس Session، Permission، Domain، Branch و confidentiality فعلی Documents باقی می‌ماند.
- داده واقعی یا Secret وارد Git نشده است.
- این Slice ذخیره ساخت‌یافته شماره پاسپورت، کشور صادرکننده، نام لاتین روی مدرک یا شماره ویزا را فعال نمی‌کند.
- `DEC-OPEN-006` برای retention، residency، KMS/key rotation، حذف و legal hold همچنان باز است؛ بنابراین آن داده‌های semantic تا تصمیم مستقل مسدود می‌مانند.
- Adapter فعلی ذخیره فایل برای محیط توسعه/آزمایش است. S3/MinIO تولیدی، Antivirus Worker پایدار و retention نهایی در `DOCUMENTS-003/004` باقی می‌مانند.

## کنترل کیفیت

- تست هدفمند Contracts: `3/3`
- تست هدفمند Documents API/Repository/Boundary: `25/25`
- تست هدفمند Customers Web: `45/45`
- Regression کامل Monorepo: `1470` تست پاس؛ `70` تست اختیاری PostgreSQL طبق Suite رد شدند.
- lint کامل: `6/6` Task پاس
- typecheck کامل: `9/9` Task پاس
- Production Build: `6/6` Task و `34` Route پاس
- `git diff --check`، Scope و عدم تغییر Migration/Dependency/Lockfile: پاس

## Handoff

- برای Merge باید Delta قرارداد عمومی Documents، فیلتر Repository و UI Customer 360 بازبینی شود.
- پس از Merge، PC-B می‌تواند فیلتر منبع را در رابط مرکزی Documents نیز مصرف کند؛ این PR فایل‌های UI باز PR #80 را تغییر نمی‌دهد.
- قفل `Documents public list-filter contract` و `Central Docs` تا Merge/Handoff این PR نزد `PC-A/CUSTOMER-DOCUMENTS-001` باقی می‌ماند؛ سپس آزاد می‌شود.
