# MASTER-003 — Advanced Master Data Management

- وضعیت: `IN_PROGRESS — DRAFT PR / PARTIAL VERTICAL SLICE`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-advanced`
- Base: `b6da5d6300716a189958bc37d31ca195f0304dc5`
- Draft PR: [#25](https://github.com/nirvanamahlou/Rubi/pull/25)
- پیش‌نیاز: PR #24 با Source HEAD `6f475c0` و Merge Commit `b6da5d6` ادغام شده است.
- Dependency/Lockfile Owner: `RELEASED`؛ `fflate@0.8.3` پس از Security Review و آزمون فایل واقعی تثبیت شد.

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

Migration فاقد `DROP`، `TRUNCATE` و `DELETE` است و روی PostgreSQL 18 خالی با هر نه Migration اجرا شد. Seed با دو کلید موقت مستقل و فقط در حافظه، دو بار بدون خطا اجرا شد. تعداد Seed نرخ ارز `0` است.

### Contract و Permission

- Master Data Contract نسخه `10` در بالاترین Slice پشته (`MASTER-003I`)؛ Parent PR #25
  مستقل و دست‌نخورده باقی می‌ماند.
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

- گروه مالی از صفحه اصلی `/master-data` به Workspace اختصاصی
  `/master-data/finance` باز می‌شود.
- فرم ارز شامل نام انگلیسی و تعداد رقم اعشار است.
- فرم نرخ شامل نوع، زمان مشاهده، شروع/پایان اعتبار و توضیح اصلاح است.
- عملیات تأیید/رد به Backend واقعی متصل است و دلیل تصمیم دریافت می‌شود.
- پیام UI صریحاً مرجع و non-authoritative بودن نرخ را نشان می‌دهد؛ Excel مستقیم دانلود می‌شود و PDF منتظر Documents/Worker می‌ماند.

## وضعیت Export و Integration

خروجی XLSX طبق ADR-022 به‌صورت گذرا، فیلترشده و مستقیم تا سقف ۱۰٬۰۰۰ ردیف تولید می‌شود و Permission/Audit دارد. خروجی PDF و هر Artifact پایدار یا آرشیوی صادقانه در وضعیت `AWAITING_DOCUMENTS_WORKER` باقی می‌ماند. اتصال Finance، Documents، Reservations، Procurement یا Integrations جعل نشده است.

## Slice پشته‌ای اقامت — MASTER-003F

- Migration افزایشی `20260829150000_master_data_accommodation` مدل‌های Hotel Chain،
  روابط نرمال Meal/Room/Facility و Composite Hotel را بدون عملیات مخرب اضافه می‌کند.
- مسیر `/master-data/accommodation` هفت تب کاتالوگ، پروفایل Popup از فهرست هتل‌ها،
  KPI واقعی، فیلترهای رابطه‌ای، Search/Sort/Pagination، Create/View/Edit،
  Active/Inactive، Export و Import موجود `HOTEL_IMPORT_V1` را ارائه می‌کند.
- اطلاعات اقامت global است و Legal Entity selector آن را فیلتر نمی‌کند. Branch فقط
  در Audit عملیات ثبت می‌شود و مالکیت رکورد را محدود نمی‌کند.
- Contract/Rate/Inventory/Voucher/Passenger Assignment و فایل Documents وارد این
  Aggregate نشده‌اند و فقط از قرارداد عمومی ماژول مالک قابل مصرف خواهند بود.
- شاخه `codex/pc-b-master-data-accommodation` روی PR #31 پشته شده و پیش از والدهای
  #31 ← #30 ← #29 ← #28 ← #25 نباید Merge شود.

## Slice پشته‌ای تجمیع رابط — MASTER-003G

- برچسب داخلی Work Item از Header صفحه اصلی حذف شد و کارت‌های Hub فقط
  زیرمجموعه‌های قابل مشاهده را گزارش می‌کنند.
- تاریخچه و نمودار نرخ از تب مستقل به پنجره جزئیات ارز منتقل شد؛ انتخاب ارز و سپس
  جفت/نوع نرخ، داده واقعی Backend را برای بازه ۳۰/۹۰/۳۶۵ روزه نمایش می‌دهد.
- شهر و استان/ناحیه یک تب بالادستی دارند؛ تفکیک مدل داده و FKها بدون Migration حفظ شد.
- پروفایل هتل، تأمین‌کننده و کارگزار از فهرست اصلی در Dialog مشترک باز می‌شود و
  تب‌های مستقل پروفایل حذف شدند.
- نمای مستقل اطلاعات تماس سازمان‌ها و تأمین‌کنندگان حذف شد؛ داده یا Schema مخاطب
  حذف نشده است.
- Draft PR #33 از شاخه `codex/pc-b-master-data-ux-consolidation` روی PR #32 پشته
  شده و پیش از والدهای #32 ← #31 ← #30 ← #29 ← #28 ← #25 نباید Merge شود.

## Slice پشته‌ای حمل‌ونقل — MASTER-003H

- ۹ کاتالوگ ایرلاین، نوع هواپیما، کلاس پروازی، قاعده بار، قالب Manifest، شرکت و نوع
  قطار و شرکت و نوع اتوبوس با Migration افزایشی، API واقعی و Workspace مطابق ماکاپ
  ارائه شدند؛ پروفایل فقط Popup است.
- اتصال‌های عملیاتی Provider، Inventory، Reservation، Settlement و Manifest مسافر
  خارج از Master Data باقی مانده و فقط از Public Contract قابل اتصال است.
- Draft PR #35 روی PR #33 پشته شده و پیش از زنجیره والد Merge نمی‌شود.

## Slice پشته‌ای مراجع فروش — MASTER-003I

- هفت کاتالوگ مستقل نحوه آشنایی، منبع سرنخ، کانال فروش، دلیل از دست رفتن، نوع مشتری،
  Tag و نوع کمپین با Migration افزایشی، Contract v10، Backend و Workspace واقعی
  فارسی/RTL/Responsive پیاده‌سازی شدند.
- پروفایل هر مرجع فقط از داخل فهرست در Popup باز می‌شود و تب یا سکشن مستقل پروفایل
  وجود ندارد. چهار KPI دقیق ماکاپ عبارت‌اند از کل موارد، فعال، استفاده‌شده و نیازمند
  بازبینی.
- شمارش استفاده در مالکیت Aggregate مصرف‌کننده است؛ تا انتشار قرارداد عمومی آن مقدار
  `—` نمایش داده می‌شود و هیچ Query مستقیم به Customers یا Sales وجود ندارد.
- Branch `codex/pc-b-master-data-sales-references` روی PR #35 پشته می‌شود و پیش از
  همه والدهای خود Merge نمی‌شود.

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

## باقی‌مانده و موارد مسدود

این Draft PR کل MASTER-003 را Complete اعلام نمی‌کند. موارد زیر هنوز پیاده‌سازی نشده‌اند و قفل‌ها آزاد نمی‌شوند:

- کاتالوگ‌های Insurance Plan/Coverage و Tour/Transfer مستقل
- اتصال Scanner مستقل آنتی‌ویروس و Documents برای تصاویر هتل
- اتصال لوگوی بانک به Documents Worker و قرارداد واقعی فایل

Parser ZIP با `fflate@0.8.3` دقیق Pin و Lock آن پس از تثبیت آزاد شد. Scanner مستقل آنتی‌ویروس و Documents Worker هنوز آماده نیستند و به‌عنوان موفقیت گزارش نمی‌شوند.
