# MASTER-003C-FINANCIAL — Financial Reference Data

- مالک: `PC-B`
- Computer: `PC-B`
- Branch: `codex/pc-b-master-data-financial`
- Base: `codex/pc-b-master-data-next@e0e3a5f`
- مسیر محصول: `/master-data/finance`
- والد: `MASTER-003` / Draft PR #25
- قفل‌ها: Migration، Master Data shared-contract و Central docs همان قفل‌های فعال
  `PC-B/MASTER-003` هستند؛ Dependency/Lockfile آزاد است.

## مرز دامنه

این Slice «مالی و پولی» را به‌عنوان زیرمجموعه اطلاعات پایه پیاده‌سازی می‌کند. Master
Data مالک تعریف Currency، تاریخچه نرخ دستی، گردش Maker/Checker، Bank، Bank Branch و
Payment Method مرجع است. Finance مالک Account، IBAN، Card، CVV، Balance، Settlement،
Transaction، Gateway Configuration و نرخ قطعی اسناد مالی باقی می‌ماند.

هیچ Query مستقیمی به جدول Finance وجود ندارد. Legal Entity Selector داده‌های مرجع این
Workspace را فیلتر نمی‌کند. نرخ جاری فقط از آخرین نرخ دستی `APPROVED` در قرارداد Master
Data خوانده می‌شود و همواره `isAuthoritative=false` است.

## Database و Migration

Migration افزایشی `20260829100000_master_data_financial_reference`:

- `MasterCurrency.displayPolicy` برای نمایش نماد/کد قبل یا بعد از مبلغ
- `MasterBank.englishName` و SWIFT اختیاری uppercase با Constraint هشت/یازده نویسه
- `MasterBankBranch` مستقل با FK محدودکننده به Bank و City و کد یکتا در هر بانک
- `MasterPaymentMethod` مرجع با Channel، Direction، Approval Flag و Display Order
- Check Constraint کدها و Display Order و Indexهای متناسب با Search/Filter/Sort

Migration فاقد `DROP`، `TRUNCATE` یا `DELETE` است. همه ۱۱ Migration روی PostgreSQL
18.1 خالی اجرا و Seed دو بار تکرار شد. Seed هیچ نرخ، بانک، شعبه یا روش پرداخت عملیاتی
نمی‌سازد و فقط Currencyهای استاندارد موجود را idempotent تکمیل می‌کند.

## API و Permission

دو Resource جدید `bank-branches` و `payment-methods` به Contract نسخه ۶ اضافه شدند.
Search، Filter، Sort، Pagination، Create/View/Edit، Active/Inactive، Optimistic Lock،
Audit و Export Excel از قرارداد عمومی Master Data استفاده می‌کنند. تاریخچه نرخ فیلتر
متن، وضعیت و بازه UTC دارد؛ Approve/Reject فقط از Endpoint اختصاصی و Permissionهای
`master_data.currency_rate.create` و `master_data.currency_rate.approve` انجام می‌شود.

## Web

Workspace فارسی، RTL و responsive شش Tab مطابق ماکاپ دارد:

1. ارزها
2. نرخ و تاریخچه ارز با نمودار واقعی Backend و بازه ۳۰/۹۰/۳۶۵ روزه
3. گردش تأیید نرخ و Audit Timeline
4. بانک‌ها
5. شعب بانک
6. روش‌های پرداخت مرجع

KPIها از پاسخ واقعی Backend محاسبه می‌شوند. در نبود نرخ تأییدشده، نمودار Empty State
نشان می‌دهد و هیچ عدد نمونه یا نرخ ساختگی نمایش داده نمی‌شود.

## موارد عمداً خارج از Scope

- Account/IBAN/Card/CVV و هر داده حساس مالی
- Legal Entity-specific authoritative rate و Finance Snapshot
- تنظیم درگاه، حساب مقصد، کارمزد عملیاتی و شمار تراکنش
- آپلود لوگوی بانک تا آماده‌شدن قرارداد واقعی Documents/Worker

## پذیرش اجراشده

- Frozen install قبلی Workspace بدون تغییر Lockfile حفظ شد.
- Prisma format/validate/generate و Migration deploy روی دیتابیس محلی موفق است.
- همه ۱۱ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و آزمون Constraint موفق‌اند.
- Database `28/28`، Contracts `14/14`، API `188/188`، Web `97/97`، Worker
  `1/1` و Config `2/2`؛ جمعاً `330/330` تست پاس شد.
- Full typecheck و Production Build کل Monorepo موفق است و route
  `/master-data/finance` به‌صورت SSG ساخته شد.
- Lint کامل Database و API و lint همه فایل‌های Web این Slice موفق است. Lint کامل Web
  فقط روی خطای Parent در `date-picker.tsx` متوقف می‌شود و این Slice آن فایل را تغییر
  نداده است.
- Smoke احراز‌شده Login، پنج Endpoint مالی Master Data، `/master-data` و
  `/master-data/finance` همگی HTTP 200؛ Logout برابر 204 است.
