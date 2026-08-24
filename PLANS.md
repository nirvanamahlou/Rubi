# برنامه اجرای Rubi

این برنامه backlog سطح محصول را نگهداری می‌کند. اولویت‌ها: `P0` الزامی برای
foundation یا یکپارچگی مالی، `P1` الزامی برای نسخه عملیاتی، `P2` بهبود بعدی.

## دروازه‌های تصمیم پیش از Foundation

- [ ] `DEC-OPEN-001`: دامنه Sub-ledger و مرز اتصال حسابداری قانونی تایید شود.
- [ ] `DEC-OPEN-002`: دو دامنه سایت، برندها، درگاه‌ها و ارزهای قابل فروش مشخص شوند.
- [ ] `DEC-OPEN-003`: Providerهای موج اول و قابلیت واقعی هر API تعیین شوند.
- [ ] `DEC-OPEN-004`: قواعد نگهداری/رمزنگاری مدارک هویتی و محل میزبانی تصویب شود.
- [ ] `DEC-OPEN-005`: تقویم کاری، SLA و نقش‌های تایید مالی اولیه مشخص شوند.
- [ ] `DEC-OPEN-013`: سیاست HR، تقویم/شیفت، payroll input و retention پرسنلی مشخص شوند.

## مراحل

### مرحله 1 — Bootstrap و طراحی (`P0`)

- [x] بررسی Repository و اتصال به `rubi`
- [x] PRD و محدوده محصول
- [x] معماری، مرز ماژول‌ها و تصمیم‌های اولیه
- [x] ERD و Data Dictionary اولیه
- [x] KPI Dictionary و قواعد گزارش‌گیری
- [x] API conventions، مدل امنیت و integration contracts
- [x] قرارداد همکاری PC-A/PC-B و backlog
- [ ] بازبینی و تایید اسناد توسط PC-B/مالک محصول
- [x] `ARCH-001`: معماری تاییدشده فروش/رزرواسیون/بلیت/خرید/مالی با Merge `99dd1cf`
      در اسناد مرجع ادغام شد

### مرحله 2 — Foundation (`P0`) — تکمیل‌شده در Sprint اول

- [x] Monorepo با `apps/web`، `apps/api`، `apps/worker` و packages مشترک
- [x] نسخه‌های Node/package manager، lockfile، lint، format، typecheck و test
- [x] Docker Compose برای PostgreSQL، Redis و MinIO؛ health checks
- [x] Prisma Client/PostgreSQL datasource بدون مدل یا Migration تجاری
- [x] Prisma schema baseline مربوط به IAM، migration و seed ایمن محیط توسعه
- [x] `IAM-001`: Auth، refresh rotation، 2FA-ready sessions، users، roles، permissions،
      branch access و Audit رخدادهای امنیتی
- [x] `MASTER-001`: Foundation بدون Persistence اطلاعات پایه، UI، قرارداد ماژول‌محلی و
      تست‌های Sprint اول با Merge `cda0f9a`
- [ ] CI برای lint/typecheck/test/build و migration check

CI و سخت‌سازی محیط غیرمحلی قابلیت تکمیل‌شده Sprint اول محسوب نمی‌شوند و در
`FOUNDATION-002` باقی می‌مانند. Persistence واقعی Master Data نیز در `MASTER-002`
انجام خواهد شد.

## Sprint اول — Foundation (`P0`) — تکمیل‌شده

Baseline نهایی Sprint اول: `origin/develop` در Commit
`543f6e2b2f55833a2d1ae02440a9495f1510a112`. بسته‌شدن این Sprint فقط وضعیت کارهای
واقعاً ادغام‌شده را ثبت می‌کند و هیچ قابلیت تجاری آینده را تکمیل‌شده اعلام نمی‌کند.

### `IAM-001` — PC-A — `DONE`

- Merge Commit: `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac`
- خروجی: ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend و Frontend، Audit امنیتی، API، Database، Frontend و Test کامل.
- قفل‌های Migration Owner، Dependency/Lockfile Owner و قراردادهای مشترک IAM در طول
  Task متعلق به PC-A بودند و در 2026-08-23 پس از Merge و Handoff رسمی آزاد شدند.
- مرز فایل: مسیرهای IAM در API/Web، قراردادهای IAM، Prisma schema/migrations تاییدشده،
  تست و اسناد همان Task. فهرست دقیق فایل‌های مرکزی پیش از اولین تغییر ثبت می‌شود.
- Handoff: قرارداد versioned برای branch reference، authorization، actor و audit به
  `MASTER-001` تحویل می‌شود؛ consumer فقط public contract را مصرف می‌کند.
- تست permission/security، migration validation، lint/typecheck/test/build، ثبت Hash و
  آزادسازی صریح قفل‌ها تکمیل شد.

### `MASTER-001` — PC-B — `DONE`

- Merge Commit: `cda0f9a67589974458a4261b753152a796fa1d0b`
- Foundation بدون Persistence شامل UI فارسی/RTL، Catalogها، جست‌وجو/فیلتر، قراردادهای
  ماژول‌محلی و تست تکمیل شد.
- Database، Migration، Repository، Backend پایدار و اتصال واقعی Frontend تکمیل نشده‌اند
  و فقط در Task جدید `MASTER-002` انجام خواهند شد.

### `ARCH-001` — PC-A — `DONE`

- Merge Commit: `99dd1cff21cff76f0edb101fb8e6033900c8b4a9`
- معماری تاییدشده فروش، تخصیص مسافر، رزرواسیون، تعریف بلیت، Manifest، خرید و تحویل
  مالی و ساختار منوی ۱۷ بخشی در اسناد مرجع ثبت شد.

### `UI-ARCH-001` — PC-A — `DONE`

- Merge Commit: `543f6e2b2f55833a2d1ae02440a9495f1510a112`
- Frontend معماری، منوی دقیقاً ۱۷ بخشی و دسترسی عملی `/system` به `/users` و
  `/settings` تکمیل شد؛ مسیرهای کاربران و تنظیمات آیتم مستقل منوی اصلی نیستند.

### ترتیب اجرا و ادغام

1. برنامه Sprint اول با Draft PR و Review وارد `develop` شد.
2. هر Task Branch مستقل خود را از آخرین `origin/develop` می‌سازد و ابتدا وضعیت را
   `IN_PROGRESS` می‌کند.
3. قفل‌های Sprint اول آزاد شده‌اند، اما هیچ Task جدیدی مالک آن‌ها نیست؛ رزرو مستقل در
   شروع Task بعدی الزامی است.
4. هر PR ابتدا به `develop` می‌رود؛ هیچ‌کدام مجاز به Merge خودکار، Force Push یا تغییر
   مستقیم `main`/`develop` نیستند.

## Sprint دوم — Master Data Persistence و Customer Foundation

Baseline برنامه: `origin/develop` در Merge Commit
`9c69124798af43ef2a9f8147576135cd86a8515d`. هیچ قابلیت این Sprint قبل از Merge PR
مربوط به خود تکمیل‌شده محسوب نمی‌شود.

### `IAM-002` — PC-A — `DONE`

- انتشار Permission Codeهای عمومی Master Data و Customers در قرارداد versioned IAM.
- Seed تکرارپذیر permissionها و تست سازگاری actor/guard بدون تغییر Prisma Schema یا Migration.
- پیش‌نیاز شروع Backend واقعی `MASTER-002` و انتشار قرارداد بعدی Customers.
- مالک موقت IAM shared-contract و root export قرارداد تا Merge/Handoff.
- با Merge `d1f1133` تکمیل و قفل IAM shared-contract برای دو مصرف‌کننده آزاد شد.

### `MASTER-002` — PC-B — `DONE`

- محدوده: Database، Migration، Repository، Backend، قرارداد عمومی و اتصال واقعی Frontend
  اطلاعات پایه به‌جز نرخ ارز authoritative مسدودشده با `DEC-OPEN-004`.
- اولین Migration Owner و Dependency/Lockfile Owner Sprint دوم پس از Merge این برنامه.
- شروع کدنویسی Backend و Schema فقط پس از Merge و Handoff `IAM-002` مجاز است.
- قرارداد عمومی IAM از `@rubi/contracts` مصرف می‌شود؛ دسترسی مستقیم به جدول یا Repository
  داخلی IAM ممنوع است.
- Definition of Done شامل Migration deploy/status، Seed/fixture ایمن، CRUD و status action،
  permission/audit، contract/integration tests و اتصال UI است. قرارداد async export پایدار
  می‌شود، اما artifact واقعی تا Handoff Documents/Worker مسدود و فایل ساختگی ممنوع است.
- Migration افزایشی `20260823084001_master_data_foundation`، Fixture تکرارپذیر،
  REST/contract و UI واقعی تکمیل شد؛ Prisma deploy/status، ۵۵ تست در ۲۴ فایل،
  lint/typecheck و build کل Monorepo پاس شدند.
- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` ادغام شد؛
  چهار قفل MASTER-002 در Handoff مستقل آزاد شدند.

### `CUSTOMER-001` — PC-A — `READY_FOR_REVIEW`

- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  به‌صورت `DONE/MERGED` تکمیل شد.
- فاز B از `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb` روی
  `codex/pc-a-customer-persistence` پیاده‌سازی شد.
- Migration افزایشی Customers، FKهای واقعی، Seed ساختگی و idempotent، قرارداد عمومی،
  Repository/API، permission/audit و Customer 360 متصل تکمیل شدند.
- lint، typecheck، build، migration deploy/status و Seed دوگانه پاس شدند؛ ۱۰۴ تست کل
  Monorepo موفق بود و Dependency/Lockfile تغییر نکرد.
- به‌دلیل بازبودن `DEC-OPEN-006` هیچ مدرک هویتی حساس ذخیره نمی‌شود. به‌دلیل بازبودن
  `DEC-OPEN-011` فقط Candidate Detection و Review دستی مجاز است و merge واقعی مسدود است.
- Task تا Review و Merge PR به `develop` در وضعیت `READY_FOR_REVIEW` می‌ماند.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده: `codex/pc-b-customer-affairs-foundation`.
- Phase A فقط Foundation Frontend فارسی/RTL/Responsive، طراحی Domain/Application،
  قراردادهای ماژول‌محلی و تست‌های هدفمند را پوشش می‌دهد.
- قابلیت‌ها: درخواست مشتری، Lead و منبع آشنایی، مرحله‌بندی و Qualification پیش‌فروش،
  نیاز سفر/بودجه اولیه، تماس/فعالیت/Follow-up، تبدیل کنترل‌شده Lead به Customer یا
  Sales Request در سطح proposal، پشتیبانی پس از فروش و Ticket lifecycle.
- Ticket شامل دسته‌بندی، اولویت، وضعیت، SLA، مسئول، Escalation، یادآوری، شکایت،
  اصلاح، کنسلی/استرداد، رضایت‌سنجی و بستن است. ارتباط آن با مشتری، قرارداد، رزرو و
  خدمت فقط Contract پیشنهادی ماژول‌محلی است.

- UI باید Loading، Empty، Error، Forbidden و Preview State و جست‌وجو، فیلتر،
  مرتب‌سازی و صفحه‌بندی داشته باشد و هیچ داده واقعی مشتری یا PII وارد Git نکند.
- محدوده فایل آینده فقط `apps/web/src/modules/customer-affairs/**`، route موجود
  `apps/web/src/app/(crm)/customer-affairs/**`،
  `apps/api/src/customer-affairs/**` بدون Controller فعال/Repository واقعی،
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` و تست‌های هدفمند همان محدوده است.
- Persistence، Prisma، Migration، Seed، Dependency، Lockfile و Contract مشترک در
  Phase A ممنوع‌اند. Backend Persistence فقط پس از Handoff آینده Migration انجام
  می‌شود.
- قفل Migration، Customer shared-contract/root export و اسناد مرکزی Sprint نزد
  PC-A/`CUSTOMER-001` Phase B می‌مانند؛ PC-B فایل‌های Database، IAM، Master Data،
  Customers داخلی یا اسناد مرکزی را تغییر نمی‌دهد.

### ترتیب اجرا و ادغام Sprint دوم

1. PR برنامه‌ریزی Sprint دوم وارد `develop` شود.
2. PC-A، `IAM-002` را تکمیل، Push و پس از Review Merge کند.
3. PC-B، `MASTER-002` را با قفل یگانه Migration/Dependency آغاز کند.
4. PC-A، `CUSTOMER-001` فاز A را روی Branch مستقل و بدون Persistence موازی آغاز کند.
5. `MASTER-002` با migration gate ادغام و چهار قفلش صریح آزاد شد.
6. Handoff مستقل، قفل‌های لازم را برای فاز B `CUSTOMER-001` رزرو کرد.
7. Customer فقط پس از persistence، permission/audit و migration tests کامل `DONE` می‌شود.
8. PC-B می‌تواند `CUSTOMER-AFFAIRS-001` Phase A را بدون قفل مشترک و فقط در مرز
   فایل ثبت‌شده موازی اجرا کند.

### معیارهای عدم تداخل

- PC-A در CUSTOMER-001 فاز B مالک Prisma/Migration دامنه Customers، قرارداد مشترک Customer
  و اسناد مرکزی Sprint است و به فایل‌های داخلی Master Data یا IAM دست نمی‌زند.
- قفل Dependency/Lockfile فقط هنگام نیاز واقعی و پس از ثبت dependency و فایل دقیق فعال
  می‌شود.
- هر تغییر Contract مشترک producer/consumer، نسخه و برنامه سازگاری ثبت‌شده می‌خواهد.
- PC-B در `CUSTOMER-AFFAIRS-001` فقط proposal اتصال Customers/Sales را داخل ماژول
  و سند Task خودش ثبت می‌کند؛ Controller فعال، Repository واقعی و Persistence ممنوع‌اند.
- فایل‌های Database، Prisma/Migration/Seed، manifest/lockfile، IAM، Master Data،
  Customers داخلی و اسناد مرکزی خارج از Scope PC-B هستند.
- main/develop مستقیم تغییر نمی‌کنند و هر Task PR مستقل به `develop` دارد.

### مرحله 3 — CRM و فروش (`P1`)

- [ ] Customer 360، contacts، addresses، companions، consent و duplicate merge
- [ ] Customer Affairs: request/lead، qualification، activities و پشتیبانی قبل/بعد فروش
- [ ] Sales Contract: quotation/version، party/payer/passenger و contract documents
- [ ] تخصیص passenger به ticket/hotel/room/insurance/tour فقط در Sales
- [ ] جریان Request → Availability/Hold → Contract → Finance + Reservation Execution

### مرحله 4 — تعریف بلیت و عملیات رزرواسیون (`P0/P1`)

- [ ] Ticket Catalog: flight/fare version، sale window و inventory/Hold بدون صدور passenger
- [ ] Reservation execution snapshot، availability/Hold و optimistic locking
- [ ] صدور بلیت API/دستی/ظرفیت شرکت، PNR و lifecycle تغییر/استرداد
- [ ] Manifest قالب‌محور و زمان‌بندی‌شده با نسخه اصلاحی/الحاقی
- [ ] فرم هتل/تایید کارگزار/واچر و Adapter بیمه سامان
- [ ] financial release و delivery state مستقل بدون شماره رسمی جعلی e-ticket

### مرحله 5 — فروش آنلاین و Providerها (`P0`)

- [ ] Booking API مرکزی و احراز هویت جداگانه دو سایت
- [ ] Provider Adapter contract، normalization، mock/sandbox و external mapping
- [ ] Search cache، recheck، payment، booking، issue و webhook queues
- [ ] idempotency، timeout، retry، circuit breaker و rate limit
- [ ] سناریوی payment success + issue failure با task، retry و refund/manual follow-up

### مرحله 6 — خرید و مالی (`P0`)

- [ ] Purchase Request از Reservations با contract/service/passenger/supplier reference
- [ ] supplier quote/discount، net purchase versioned و margin محاسباتی
- [ ] خرید سفر خودکار/دستی و زنجیره PR → PO → Receipt → Invoice → Payable
- [ ] Sales/Purchase invoices، receivable/payable، settlement، refund و commission
- [ ] Journal Entry/Lines دوطرفه و مانده محاسباتی حساب‌ها
- [ ] Bank/Cash accounts، transfers، reconciliation و چک/یادآوری سررسید
- [ ] Financial Release برای تحویل بلیت/واچر/بیمه به فروش

### مرحله 7 — عملیات ارتباطی (`P1`)

- [ ] Customer Service، SLA، escalation و satisfaction
- [ ] Marketing، segment، consent، campaign، UTM و attribution
- [ ] Agency/Corporate contracts، credit، agreed rates و settlement
- [ ] HR: پرونده مستقل کارمند، ساختار سازمانی، قرارداد، حضور/شیفت، مرخصی/ماموریت و اضافه‌کاری
- [ ] HR: ارزیابی، آموزش/گواهینامه، تجهیزات/اسناد، یادآوری و گزارش Permission-aware
- [ ] قرارداد تاییدشده HR → Finance برای ورودی پرداخت؛ payroll قانونی کامل خارج از محدوده
- [ ] Tasks، approvals، automation rules/runs و notifications

### مرحله 8 — آمادگی انتشار (`P0/P1`)

- [ ] Reporting Views، dashboard، PDF/Excel/CSV/API exports
- [ ] تست امنیت، permission، payment/issue/refund failure و performance
- [ ] backup/restore drill، monitoring، Sentry و retention policy
- [ ] Staging deployment و smoke/E2E؛ production readiness review

## Definition of Ready

نیازمندی، معیار پذیرش، مالک، مرز ماژول، مدل داده، permissionها، سناریوهای شکست و
وابستگی‌ها مشخص شده و فایل‌های مشترک رزرو شده‌اند.

## Definition of Done

پیاده‌سازی، validation، permission، audit، migration، UI states، تست‌های مرتبط،
خروجی لازم و مستندات تکمیل شده؛ هیچ Secret وارد Git نشده و وضعیت/تخصیص به‌روز و
شاخه Push شده است.
