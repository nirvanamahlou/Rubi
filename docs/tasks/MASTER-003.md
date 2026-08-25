# MASTER-003 — Advanced Master Data Management

- وضعیت: `IN_PROGRESS — DRAFT PR / PARTIAL VERTICAL SLICE`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-advanced`
- Base: `b6da5d6300716a189958bc37d31ca195f0304dc5`
- پیش‌نیاز: PR #24 با Source HEAD `6f475c0` و Merge Commit `b6da5d6` ادغام شده است.
- Dependency/Lockfile Owner: `RELEASED`؛ هیچ Dependency جدیدی اضافه نشد.

## انتقال اتمیک قفل‌ها

قفل‌های Migration، Legal Entity shared-contract و اسناد مرکزی متعلق به
`PC-A/LEGAL-ENTITY-CONTEXT-001` با دلیل `DONE/MERGED via PR #24` آزاد شدند.

قفل‌های فعال این Task:

- Migration Owner: `PC-B/MASTER-003`
- Master Data shared-contract/root export: `PC-B/MASTER-003`
- Central Sprint status docs: `PC-B/MASTER-003`

## مرزهای قطعی

- اطلاعات پایه میان هر دو Legal Entity و شعب مجاز مشترک است و با selector شرکت فیلتر نمی‌شود.
- Customer/Passenger، Sales، Reservations، Ticket Catalog، Procurement، Finance،
  Integrations، Documents و Human Resources مالک داده‌های عملیاتی خود باقی می‌مانند.
- حذف فیزیکی Reference مصرف‌شده، داده واقعی PII، Credential، کارت و CVV ممنوع است.
- نرخ Master Data با `isAuthoritative=false` مرجع داخلی است؛ نرخ Posting مالی فقط از Finance می‌آید.

## پیاده‌سازی این مرحله

### دیتابیس و Migration

Migration افزایشی `20260826143000_master_data_advanced_currency` اضافه شد:

- enum مستقل نوع نرخ: `BUY`، `SELL` و `REFERENCE`
- گردش وضعیت: `DRAFT`، `APPROVED`، `REJECTED` و `EXPIRED`
- `validFrom`، `validTo`، Maker/Checker، زمان و دلیل تصمیم، توضیح اصلاح و Version
- Check Constraint برای نرخ مثبت، جفت‌ارز متفاوت، بازه معتبر، non-authoritative بودن و سازگاری Approval
- Index واقعی برای جست‌وجوی نرخ جاری
- `entityVersion` و `reason` برای Audit اطلاعات پایه
- `englishName` مستقل برای ارز

Migration فاقد `DROP`، `TRUNCATE` و `DELETE` است و روی PostgreSQL 18 خالی با همه هشت Migration اجرا شد. Seed با دو کلید موقت مستقل و فقط در حافظه، دو بار بدون خطا اجرا شد. تعداد Seed نرخ ارز `0` است.

### Contract و Permission

- Master Data Contract نسخه `2`
- IAM Permission Contract نسخه `5`
- Permissionهای جدید در Contract و Seed:
  - `master_data.import`
  - `master_data.audit.read`
  - `master_data.currency_rate.create`
  - `master_data.currency_rate.approve`
  - `master_data.sensitive_contact.read`
  - `master_data.sensitive_contact.unmask`
  - `master_data.delete`

### API

- `GET /master-data/currency-rates`
- `GET /master-data/currency-rates/current`
- `PATCH /master-data/currency-rates/:id/approve`
- `PATCH /master-data/currency-rates/:id/reject`
- `GET /master-data/audit/:resource/:entityId`

نرخ جاری فقط از آخرین نرخ `APPROVED` و معتبر خوانده می‌شود. Maker نمی‌تواند نرخ خود را Approve/Reject کند. تصمیم با `id + expectedVersion + DRAFT` اتمیک است و تعارض با `409 CONCURRENT_MODIFICATION` رد می‌شود. نرخ تصمیم‌گیری‌شده immutable است و اصلاح باید رکورد جدید باشد.

### Web

- گروه مالی اولین گروه و ارزها اولین Resource صفحه `/master-data` است.
- فرم ارز شامل نام انگلیسی و تعداد رقم اعشار است.
- فرم نرخ شامل نوع، زمان مشاهده، شروع/پایان اعتبار و توضیح اصلاح است.
- عملیات تأیید/رد به Backend واقعی متصل است و دلیل تصمیم دریافت می‌شود.
- پیام UI صریحاً مرجع و non-authoritative بودن نرخ و انتظار Export برای Documents/Worker را نشان می‌دهد.

## وضعیت Export و Integration

Export موجود MASTER-002 حفظ شده و صادقانه در وضعیت `AWAITING_DOCUMENTS_WORKER` باقی می‌ماند. فایل ساختگی ساخته نمی‌شود. اتصال Finance، Documents، Reservations، Procurement یا Integrations در این مرحله جعل نشده است.

## کنترل کیفیت اجراشده

- `pnpm install --frozen-lockfile`: موفق، بدون تغییر Lockfile
- Prisma format/validate/generate: موفق
- هشت Migration روی PostgreSQL `18.1`: موفق و status به‌روز
- بررسی مستقیم پنج Check Constraint و Index: موفق
- Seed دوبار: موفق؛ نرخ Seed صفر
- Database tests: `17/17`
- Contracts tests: `14/14`
- API tests: `142/142`
- Web tests: `77/77`
- Web typecheck: موفق
- Full monorepo lint: موفق`r`n- Full monorepo typecheck: موفق`r`n- Full monorepo tests: موفق`r`n- Full monorepo production build: موفق؛ `/master-data` تولید شد

## باقی‌مانده و موارد مسدود

این Draft PR کل MASTER-003 را Complete اعلام نمی‌کند. موارد زیر هنوز پیاده‌سازی نشده‌اند و قفل‌ها آزاد نمی‌شوند:

- کاتالوگ‌های پیشرفته Airport/Terminal/Bank Branch، Supplier Contact/Service، Hotel Chain/Room/Meal/Facility/Composite، Aircraft/Class/Baggage/Manifest، Insurance Plan/Coverage، Tour/Transfer/Bus و Sales References مستقل
- رمزنگاری و Unmask مخاطبان Master Data با کلید مستقل از Customers
- Import امن `.xlsx`، Preview Token، Idempotency، Scanner Port و گزارش خطا
- نمودار تاریخچه واقعی و Audit Timeline کامل در UI
- Smoke احرازشده CRUD/Permission/Approval/Import
- Full monorepo lint/typecheck/test/build و اسکن نهایی پیش از Ready for Review

Dependency Excel تا انتخاب کتابخانه Pin‌شده و Security Review اضافه نمی‌شود؛ بنابراین Dependency/Lockfile Lock همچنان آزاد است. Antivirus و Documents Worker آماده‌نبودنشان به‌عنوان موفقیت جعلی گزارش نمی‌شود.

