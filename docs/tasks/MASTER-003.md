# MASTER-003 — Advanced Master Data Management

- وضعیت: `PHASE A DONE / READY_FOR_REVIEW — کل Master Data تکمیل نشده است`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-advanced`
- Base: `b6da5d6300716a189958bc37d31ca195f0304dc5`
- Draft PR: [#25](https://github.com/nirvanamahlou/Rubi/pull/25)
- پیش‌نیاز: PR #24 با Source HEAD `6f475c0` و Merge Commit `b6da5d6` ادغام شده است.
- Dependency/Lockfile Owner: `RELEASED`؛ `fflate@0.8.3` پس از Security Review و آزمون فایل واقعی تثبیت شد.

## انتقال اتمیک قفل‌ها

قفل‌های Migration، Legal Entity shared-contract و اسناد مرکزی متعلق به
`PC-A/LEGAL-ENTITY-CONTEXT-001` با دلیل `DONE/MERGED via PR #24` آزاد شدند.

قفل‌های فعال این Task تا Merge PR #25:

- Migration Owner: `PC-B/MASTER-003`
- Master Data shared-contract/root export: `PC-B/MASTER-003`
- Central Sprint status docs: `PC-B/MASTER-003`

Handoff بعدی انتقال زودهنگام نیست: Migration Owner و Central Docs برای
`PC-A/CUSTOMER-002B` رزرو شده‌اند، اما فقط پس از Merge ترتیبی PR #25، سپس #26 و
سپس #27 و ثبت Handoff نهایی فعال می‌شوند. Customer shared-contract/root export نیز
با همین Gate رزرو است. Master Data shared-contract/root export پس از Merge #25
پایدار و `RELEASED` می‌شود و Dependency/Lockfile برابر `RELEASED` باقی می‌ماند.

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

Migration فاقد `DROP`، `TRUNCATE` و `DELETE` است و روی PostgreSQL 18 خالی با هر نه Migration اجرا شد. Seed با دو کلید موقت مستقل و فقط در حافظه، دو بار بدون خطا اجرا شد. تعداد Seed نرخ ارز `0` است.

### Contract و Permission

- Master Data Contract نسخه `3`
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
- پیام UI صریحاً مرجع و non-authoritative بودن نرخ را نشان می‌دهد؛ Excel مستقیم دانلود می‌شود و PDF منتظر Documents/Worker می‌ماند.

## وضعیت Export و Integration

خروجی XLSX طبق ADR-022 به‌صورت گذرا، فیلترشده و مستقیم تا سقف ۱۰٬۰۰۰ ردیف تولید می‌شود و Permission/Audit دارد. خروجی PDF و هر Artifact پایدار یا آرشیوی صادقانه در وضعیت `AWAITING_DOCUMENTS_WORKER` باقی می‌ماند. اتصال Finance، Documents، Reservations، Procurement یا Integrations جعل نشده است.

## Import واقعی هتل — HOTEL_IMPORT_V1

- دو Endpoint واقعی `POST /master-data/hotel-imports/preview` و
  `POST /master-data/hotel-imports/:sessionId/commit` اضافه شدند.
- قالب دقیق ۱۸ ستونی فایل بدروم پذیرفته می‌شود؛ پسوند، MIME، File Signature،
  Headerها، Scope شهر و سقف ردیف/ستون/سلول کنترل می‌شوند.
- ZIP Bomb، Path Traversal، Macro/ActiveX/Embedding، External Link، Formula،
  Hyperlink و DDE رد می‌شوند.
- فایل Staging نام تصادفی و دسترسی محدود دارد؛ Preview Token فقط HMAC می‌شود و
  ۱۵ دقیقه اعتبار دارد. Commit با Idempotency Key و یک تراکنش اتمیک انجام می‌شود.
- تکراری‌ها با `SKIP` یا `UPDATE` مدیریت می‌شوند؛ `CREATE_NEW` بدون Mapping
  کد جدید مجاز نیست.
- Meal Service، Room Type و Facility گمشده فقط با انتخاب صریح کاربر ساخته می‌شوند.
- قوانین استرداد، تصاویر و پرفروش به مالکیت Procurement، Documents و
  Marketing/Sales احترام می‌گذارند و در Master Data ذخیره نمی‌شوند.
- پنل Upload، انتخاب کشور/شهر، Preview، گزارش خطا/هشدار و Commit در Catalog هتل‌ها
  به Backend واقعی متصل شد.
- Scanner مستقل آنتی‌ویروس هنوز متصل نیست و UI/API صریحاً وضعیت `UNAVAILABLE`
  را نمایش می‌دهند.

آزمون انتها‌به‌انتها با فایل واقعی `hotel-data-بدروم.xlsx` روی PostgreSQL 18.1:
۲۲ ردیف، صفر خطا، صفر تکراری و ۲۲ هتل ایجادشده. دیتابیس موقت پس از آزمون حذف شد.

### نتیجه Review رسمی PR #25

- DTOهای Nest به‌صورت runtime import و با ValidationPipe واقعی برای payload معتبر، unknown،
  missing، enum نامعتبر و nested DTO آزموده شدند.
- همه فایل‌های `.rels` و اجزای externalLinks/connections/queryTables پیش از Preview بررسی و
  با کد پایدار `HOTEL_IMPORT_EXTERNAL_RELATIONSHIP_FORBIDDEN` رد می‌شوند.
- update/status عمومی نرخ ارز در Controller و Service با کد پایدار
  `CURRENCY_RATE_STATUS_TRANSITION_FORBIDDEN` بسته شد؛ approve/reject اختصاصی حفظ شد.
- پذیرش production-like: ۲۲ ایجاد، Commit تکراری بدون افزایش، فایل دوم ۲۲ Skip،
  rollback اتمیک، Commit هم‌زمان ۲۰۱/۴۰۹، login/cookie واقعی و `/master-data` با پاسخ ۲۰۰.
- `no-control-regex` در تولید XLSX بدون Suppress و با پیمایش code point رفع شد؛ تست
  Regression حذف `U+0000`، `U+0008` و `U+001F` و حفظ Policy قبلی برای TAB، CR، LF و
  `U+007F` را کنترل می‌کند.

## کنترل کیفیت اجراشده

- `pnpm install --frozen-lockfile`: موفق، بدون تغییر Lockfile
- Prisma format/validate/generate: موفق
- نه Migration روی PostgreSQL `18.1`: موفق؛ اجرای دوم بدون Migration معوق
- بررسی مستقیم پنج Check Constraint و Index: موفق
- Seed دوبار: موفق؛ نرخ Seed صفر
- Database tests: `20/20`
- Contracts tests: `14/14`
- API tests: `172/172`
- Web tests: `77/77`
- Web typecheck: موفق
- Full monorepo lint: موفق
- Full monorepo typecheck: موفق
- Full monorepo tests: موفق
- Full monorepo production build: موفق؛ `/master-data` تولید شد

## باقی‌مانده منتقل‌شده به MASTER-004

این Draft PR فقط MASTER-003 Phase A را می‌بندد و کل اطلاعات پایه را Complete اعلام
نمی‌کند. موارد زیر هنوز پیاده‌سازی نشده‌اند و در `MASTER-004` برابر `PLANNED` هستند:

- کاتالوگ‌های پیشرفته Airport/Terminal/Bank Branch، Supplier Contact/Service، Hotel Chain/Room/Meal/Facility/Composite، Aircraft/Class/Baggage/Manifest، Insurance Plan/Coverage، Tour/Transfer/Bus و Sales References مستقل
- رمزنگاری و Unmask مخاطبان Master Data با کلید مستقل از Customers
- اتصال Scanner مستقل آنتی‌ویروس و Documents برای تصاویر هتل
- نمودار تاریخچه واقعی و Audit Timeline کامل در UI

Parser ZIP با `fflate@0.8.3` دقیق Pin و Lock آن پس از تثبیت آزاد شد. Scanner مستقل آنتی‌ویروس و Documents Worker هنوز آماده نیستند و به‌عنوان موفقیت گزارش نمی‌شوند.

`MASTER-003E-SUPPLIERS` روی Branch مستقل وارد این PR نمی‌شود و برابر
`PAUSED_FOR_CUSTOMER_002B_MIGRATION_HANDOFF` است. آن Branch و `MASTER-004` تا Handoff
بعدی حق Prisma Schema، Migration، Seed، Root Contract، Dependency/Lockfile یا تغییر
اسناد مرکزی ندارند. جزئیات در [MASTER-003-HANDOFF.md](MASTER-003-HANDOFF.md) و
[MASTER-004.md](MASTER-004.md) ثبت شده است.
