# برنامه اجرای Rubi

## یکپارچه‌سازی مشترک — 2026-08-31

- SHARED-INTEGRATION-0831 در حال ترکیب Snapshotهای منتشرشده PR #55/#56/#46 در یک develop است؛ Branchهای مبدأ حفظ و نسخه ترکیبی بازبینی می‌شود.
- بلیت Phase A باقی می‌ماند؛ قیمت نهایی فروش در Sales، قیمت خرید مرجع در Catalog و صدور/Manifest در Reservations است.
- پس از عبور Gateها و Merge، هر دو دستگاه از همان Commit develop استفاده می‌کنند. Git کد را همگام می‌کند، نه داده یا کلید خصوصی دیتابیس محلی را.
- توسعه بعدی در Branch ماژولی انجام می‌شود؛ قفل Migration/Contract اطلاعات پایه بدون Handoff صریح جابه‌جا نمی‌شود.

## تحویل زنجیره مشتریان — 2026-08-31

- #26، #27 و #34 به develop ادغام شدند؛ #41 پس از ۴۲۵ تست و Smoke واقعی آماده ادغام Slice موجود است، نه تأیید تکمیل همه قابلیت‌های Customers.
- با Merge #41 قفل‌های همین کار طبق WORK_ASSIGNMENTS آزاد می‌شوند؛ تصمیم‌های DEC-OPEN-006/011 باز و الزامات مدارک/هویت خارجی/Import اتمیک/Merge واقعی باقی می‌مانند.
- کار محصول بعدی درخواستی PC-A: مدیریت و تعریف بلیت‌ها از آخرین origin/develop، با رزرو تازه Scope و قفل‌های لازم؛ تعریف محصول، برنامه، قیمت نسخه‌دار و ظرفیت. صدور بلیت مسافر و Manifest متعلق به رزرواسیون‌اند.

این برنامه backlog سطح محصول را نگهداری می‌کند. اولویت‌ها: `P0` الزامی برای
foundation یا یکپارچگی مالی، `P1` الزامی برای نسخه عملیاتی، `P2` بهبود بعدی.

## Documents — زنجیره Stacked فعلی

- [x] `DOCUMENTS-001`: Foundation رابط و معماری ماژول روی
      `codex/pc-b-documents-foundation` / Draft PR #61؛ هنوز به `develop` ادغام نشده است.
- [x] `DOCUMENTS-002`: Persistence و Migration افزایشی، قرارداد/IAM، API و بارگذاری واقعی،
      Storage محلی رمزگذاری‌شده، UI متصل، تفکیک نقش و Smoke Desktop/Mobile؛ آماده Review
      در Draft PR #64 روی Branch والد Phase A و بدون Merge مستقیم به `develop`.
- [x] `DOCUMENTS-003A`: تجربه لوکال Documents؛ حذف نمای مستقل Activity، لینک داخلی
      Permission-aware، چهار نمای شخصی، رابط رنگی و اسکن واقعی Microsoft Defender با
      تطبیق SHA-256 و fail-closed؛ روی شاخه فرزند و بدون Migration/Dependency.
- [x] `DOCUMENTS-003B`: پیش‌نمایش امن JPEG/PNG در جزئیات فایل پس از Scan پاک؛ مسیر inline
      احراز‌شده، مجوز مشاهده مستقل، دلیل محرمانگی، Audit و Blob URL موقت با cleanup؛
      روی شاخه فرزند و بدون Migration/Dependency/Contract عمومی.
- [x] `DOCUMENTS-003C-DEMO-BOOTSTRAP`: هفت سند و تصویر کاملاً ساختگی، قابل Preview و
      قابل ایجاد تکرارپذیر روی دیتابیس/Storage محلی هر دو کامپیوتر؛ Preview بدون Write،
      Apply صریح با Antivirus واقعی و بدون Migration/Dependency/Secret.
- [ ] `DOCUMENTS-003`: Adapter تولیدی S3/MinIO و Antivirus Worker عملیاتی با retry،
      monitoring و recovery؛ پس از تصمیم امنیت/عملیات و رزرو تازه Migration/Dependency.
- [ ] `DOCUMENTS-004`: اشتراک امن، نسخه‌گذاری تکمیلی، Export، retention نهایی و اتصال
      producerها فقط از Public Contract/Event؛ بدون query مستقیم جدول ماژول دیگر.

## Foundation رابط تمام ماژول‌ها

- [x] `MODULES-FOUNDATION-001`: Foundation قابل بررسی هر ۱۷ route، Dashboard و Sidebar
- [x] Coverage Matrix کامل PDF با وضعیت‌های `PRESERVE`، `BUILD` و `DEFERRED`
- [x] lint، typecheck، test، production build و HTTP smoke هر ۱۷ route
- [ ] اتصال کامل Provider/Worker و خروجی‌های cross-module در Taskهای مالک هر ماژول؛
      Persistence/API و بارگذاری واقعی Documents در `DOCUMENTS-002` آماده Review است

## دروازه‌های تصمیم پیش از Foundation

- [x] `DEC-OPEN-001`: دامنه Sub-ledger و مرز اتصال حسابداری قانونی تایید شود.
- [ ] `DEC-OPEN-002`: دو دامنه سایت، برندها، درگاه‌ها و ارزهای قابل فروش مشخص شوند.
- [ ] `DEC-OPEN-003`: Providerهای موج اول و قابلیت واقعی هر API تعیین شوند.
- [x] `DEC-OPEN-004`: ارز، Decimal/rounding، FX source، Tax و Recognition تایید شود.
- [x] `DEC-OPEN-005`: Approval Matrix مالی و Maker/Checker تایید شود.
- [ ] `DEC-OPEN-006`: PII/document retention، residency و key management تایید شود.
- [ ] `DEC-OPEN-007`: hosting، RPO/RTO، availability و traffic تایید شود.
- [ ] `DEC-OPEN-013`: سیاست HR، تقویم/شیفت، payroll input و retention پرسنلی مشخص شوند.
- [x] `DEC-OPEN-016`: Financial Release، basisها و استثنای مدیر تایید شود.

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
- [x] `CI-001`: CI مشترک و مستقل PC-A/PC-B برای Full lint/typecheck/test/build،
      Prettier تغییرات و Migration/Seed روی PostgreSQL 18 موقت؛ آماده Review

سخت‌سازی محیط غیرمحلی و CD همچنان قابلیت تکمیل‌شده Sprint اول محسوب نمی‌شوند و در
`FOUNDATION-002` باقی می‌مانند. Persistence واقعی Master Data نیز در `MASTER-002`
انجام شده است.

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

### `CUSTOMER-001` — PC-A — `DONE/MERGED`

- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  به‌صورت `DONE/MERGED` تکمیل شد.
- فاز B از `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb` روی
  `codex/pc-a-customer-persistence` پیاده‌سازی شد.
- Migration اصلی Customers بدون تغییر حفظ شد و Migration افزایشی
  `20260824113000_customer_contact_encryption_hardening` رمزنگاری AES-256-GCM،
  HMAC-SHA-256 و indexهای fingerprint را اضافه کرد؛ قرارداد عمومی `customers.v2`،
  permission/audit allowlist و Customer 360 متصل تکمیل شدند.
- duplicate search به query محدود و branch-scoped با سقف ۵۰ کاندید تبدیل شد و reveal مقدار
  Contact فقط با `customers.sensitive.read` و Audit مستقل انجام می‌شود.
- lint، typecheck، build، migration deploy/status و Seed دوگانه پاس شدند؛ ۱۲۰ تست کل
  Monorepo موفق بود و Dependency/Lockfile تغییر نکرد.
- به‌دلیل بازبودن `DEC-OPEN-006` هیچ مدرک هویتی حساس ذخیره نمی‌شود. به‌دلیل بازبودن
  `DEC-OPEN-011` فقط Candidate Detection و Review دستی مجاز است و merge واقعی مسدود است.
- PR شماره ۱۹ با Merge Commit `7d0a4f42e978b468263efdc83f780fa656fbd613` وارد `develop` شد؛ Task `DONE/MERGED` است.

### `FINANCE-001` — PC-A — `DONE/MERGED`

- Branch فعال: `codex/pc-a-finance-foundation` از baseline `a165923`؛ Handoff با PR #20
  و Merge `11fc875` وارد `develop` شده است.
- فاز نخست فقط Foundation مالی، تثبیت مرز Sub-ledger، طراحی Domain/Application،
  قراردادهای producer/consumer و UI/stateهای بدون Persistence را پوشش می‌دهد.
- `DEC-OPEN-001`، `DEC-OPEN-004`، `DEC-OPEN-005` و `DEC-OPEN-016` با تأیید رسمی مالک
  محصول و کسب‌وکار در 2026-08-24 به `ACCEPTED` تغییر کردند و Gate معماری رفع شد.
- پذیرش Decisionها Scope فاز جاری را توسعه نمی‌دهد: هیچ Prisma Schema، Migration،
  Repository، Persistence، Dependency یا Lockfile در FINANCE-001 Phase A تغییر نمی‌کند.
- پس از Merge PR #21، Schema و Migration افزایشی مالی فقط در Task مستقل Phase B، با
  رزرو صریح Migration Owner و اجرای Migration gate، مجاز خواهد بود.
- Finance به جدول‌های Customers، Sales، Reservations، Procurement یا HR query مستقیم نمی‌زند
  و فقط contract/event عمومی و referenceهای پایدار مصرف می‌کند.
- Domain/Application، قرارداد عمومی پیشنهادی و Workspace مسیر `/finance` تکمیل شدند؛
  ۱۷۲ تست، lint/typecheck و Production Build پاس شدند.
- PR #21 با Merge `45c107e` وارد `origin/develop` شد. هیچ `FINANCE-002` یا PR/Branch فعال
  Finance Persistence وجود ندارد؛ قفل‌های stale آن برای `LEGAL-ENTITY-CONTEXT-001` آزاد شدند.

### `LEGAL-ENTITY-CONTEXT-001` — PC-A — `DONE/MERGED`

- PR #24 با Source HEAD `6f475c0` و Merge Commit `b6da5d6` وارد `origin/develop` شد.
- قفل‌های Migration، Legal Entity contract و اسناد مرکزی با دلیل `DONE/MERGED via PR #24` آزاد شدند.

### `MASTER-003 Phase A` — PC-B — `DONE / READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-advanced` از `origin/develop@b6da5d6`.
- توسعه افزایشی MASTER-002 برای Schema/Migration، Contract، Backend، Frontend، Import امن Excel و تست.
- اطلاعات پایه میان هر دو Legal Entity مشترک است و selector شرکت آن را scope نمی‌کند.
- Migration، Master Data shared-contract/root export و Central docs برای PC-B رزرو هستند.
- Dependency/Lockfile پس از Pin کردن `fflate@0.8.3`، Security Review و آزمون فایل واقعی آزاد شد.
- Review رسمی PR #25 روی همان Draft و Branch رفع شد؛ DTO runtime، امنیت OOXML و
  گردش وضعیت نرخ ارز با تست‌های regression و پذیرش PostgreSQL 18 پوشش داده شدند.
- خروجی مستقیم XLSX فیلترشده و RTL تا سقف ۱۰٬۰۰۰ ردیف با Permission/Audit فعال است؛
  PDF و خروجی آرشیوی پایدار تا اتصال Documents/Worker در وضعیت انتظار می‌مانند.
- اتصال‌های Documents/Worker/Finance/Reservations/Integrations فقط از Public Contract یا Port واقعی؛ بدون artifact یا Provider ساختگی.
- DONE فقط برای Phase A شامل نرخ ارز پیشرفته، Import امن هتل، کاتالوگ‌های موجود و UI
  فعلی است؛ کل اطلاعات پایه تکمیل‌شده نیست.
- `MASTER-003E-SUPPLIERS` در Branch مستقل و خارج از PR #25 با وضعیت
  `PAUSED_FOR_CUSTOMER_002B_MIGRATION_HANDOFF` باقی می‌ماند.
- Migration و Central Docs برای `PC-A/CUSTOMER-002B` رزرو مشروط هستند و فقط بعد از
  Merge ترتیبی PRهای #25، #26 و #27 و Handoff نهایی فعال می‌شوند؛ Customer shared-contract/
  root export نیز برای همان Task رزرو است.
- Master shared-contract/root export پس از Merge PR #25 پایدار و `RELEASED` می‌شود؛
  Dependency/Lockfile برابر `RELEASED` باقی می‌ماند.

### `MASTER-004` — PC-B — `PLANNED`

- ادامه کاتالوگ‌ها، Antivirus/Documents Integration، PII encryption/unmask و قابلیت‌های
  آینده اطلاعات پایه را پوشش می‌دهد.
- تا Handoff بعدی فقط طراحی و تغییرات ماژول‌محلی غیرمرکزی مجاز است؛ Prisma Schema،
  Migration، Seed، Root Contract، Dependency/Lockfile و اسناد مرکزی ممنوع‌اند.
- هیچ Persistence، Antivirus، Documents Adapter یا artifact ساختگی به‌عنوان قابلیت نهایی
  معرفی نمی‌شود.
- مرجع: [MASTER-004.md](docs/tasks/MASTER-004.md).

### `CUSTOMER-002B` — PC-A — `PLANNED / RESERVED`

- Migration Owner، Central Sprint Docs و Customer shared-contract/root export برای این
  Task رزرو شده‌اند، اما Reservation تا عبور کامل Gate #25 → #26 → #27 فعال نیست.
- شروع Persistence یا تغییر Schema پیش از Handoff نهایی ممنوع است.
- مرجع انتقال: [MASTER-003-HANDOFF.md](docs/tasks/MASTER-003-HANDOFF.md).

- `MASTER-003B-GEO` روی Branch مستقل
  `codex/pc-b-master-data-next` و Base والد PR #25 پیاده‌سازی شد: Country،
  Province/Region، City، Airport و Terminal با Migration غیرمخرب، Contract v5،
  API/UI واقعی، Permission/Audit و optimistic lock.
- Draft PR #28 به‌صورت stacked می‌ماند و پیش از Merge PR #25 ادغام نمی‌شود؛
  پس از Merge والد، Base آن به `develop` تغییر خواهد کرد.
- `MASTER-003C-FINANCIAL` زیر مسیر `/master-data/finance`، Contract v6 و Migration
  `20260829100000_master_data_financial_reference` پیاده‌سازی شد: Currency Display
  Policy، Rate History/Approval، Bank/Branch و Payment Method مرجع. حساب، شبا، کارت،
  مانده، تراکنش، درگاه و نرخ authoritative همچنان در مالکیت Finance هستند.
- Draft PR #29 روی Branch جغرافیا و PR #28 پشته شده است و به‌تبع آن به PR #25 وابسته
  می‌ماند؛ پیش از والدها Merge نمی‌شود.
- `MASTER-003D-UI-POLISH` به‌صورت Slice مستقل روی PR #29 آماده شد: KPIهای پاستلی و
  آیکن‌دار در همه Workspaceها، نام KPIهای مالی و جغرافیا مطابق ماکاپ، نمای تخصصی پنج‌تب
  جغرافیا و حذف خط Hover کارت‌های Hub. این Slice هیچ Schema، Migration، API Contract،
  Customers، Dependency یا Lockfile را تغییر نمی‌دهد.
- Draft PR #30 با Base `codex/pc-b-master-data-financial` ایجاد شد و پیش از والدهای
  #29، #28 و #25 نباید Merge شود.
- `MASTER-003H-TRANSPORT` با ۹ کاتالوگ حمل‌ونقل، Contract v9، Migration افزایشی و
  پروفایل Popup در Draft PR #35 روی PR #33 آماده Review است.
- `MASTER-003I-SALES-REFERENCES` با هفت کاتالوگ مستقل مراجع فروش، Contract v10،
  Migration افزایشی و پروفایل Popup روی شاخه
  `codex/pc-b-master-data-sales-references` و Draft PR #36 آماده Review است؛ شمارش مصرف تا انتشار
  Public Aggregate Contract با `—` نمایش داده می‌شود و Query مستقیم Customers/Sales
  وجود ندارد.

### `CALENDAR-001` — PC-B — `READY_FOR_REVIEW`

- DatePicker مشترک با تم آبی، انتخاب روز/ساعت و سوییچ شمسی/میلادی در بالای تقویم.
- پوشش همه فیلدهای تاریخ Customers، Customer Affairs، Finance و Master Data.
- قرارداد ذخیره‌سازی بدون تغییر: ISO Gregorian؛ بدون Dependency، API، Schema یا Migration.
- تست قراردادی مانع بازگشت ورودی خام مرورگر به فرم‌های سامانه می‌شود.

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
- قفل‌های مشترک CUSTOMER-001 با Merge `7d0a4f4` آزاد و در Handoff مستقل برای
  PC-A/`FINANCE-001` رزرو شده‌اند؛ PC-B همچنان به Database، IAM، Master Data،
  Customers داخلی، Finance contract یا اسناد مرکزی دسترسی ندارد.

### ترتیب اجرا و ادغام Sprint دوم

1. PR برنامه‌ریزی Sprint دوم وارد `develop` شود.
2. PC-A، `IAM-002` را تکمیل، Push و پس از Review Merge کند.
3. PC-B، `MASTER-002` را با قفل یگانه Migration/Dependency آغاز کند.
4. PC-A، `CUSTOMER-001` فاز A را روی Branch مستقل و بدون Persistence موازی آغاز کند.
5. `MASTER-002` با migration gate ادغام و چهار قفلش صریح آزاد شد.
6. Handoff مستقل، قفل‌های لازم را برای فاز B `CUSTOMER-001` رزرو کرد.
7. `CUSTOMER-001` پس از persistence، permission/audit و migration gate با Merge `7d0a4f4` برابر `DONE` شد.
8. PC-B می‌تواند `CUSTOMER-AFFAIRS-001` Phase A را بدون قفل مشترک و فقط در مرز
   فایل ثبت‌شده موازی اجرا کند.
9. Handoff مستقل، چهار قفل CUSTOMER-001 را آزاد و برای Foundation کنترل‌شده `FINANCE-001` رزرو می‌کند.

### معیارهای عدم تداخل

- PC-A در `FINANCE-001` مالک مشروط Migration، Finance shared-contract و اسناد مرکزی است؛
  Decision Gate پذیرفته شده است؛ Schema/Migration فقط پس از Merge PR #21 و در Task مستقل Phase B ایجاد می‌شود.
- قفل Dependency/Lockfile فقط هنگام نیاز واقعی و پس از ثبت dependency و فایل دقیق فعال
  می‌شود.
- هر تغییر Contract مشترک producer/consumer، نسخه و برنامه سازگاری ثبت‌شده می‌خواهد.
- PC-B در `CUSTOMER-AFFAIRS-001` فقط proposal اتصال Customers/Sales را داخل ماژول
  و سند Task خودش ثبت می‌کند؛ Controller فعال، Repository واقعی و Persistence ممنوع‌اند.
- فایل‌های Database، Prisma/Migration/Seed، manifest/lockfile، IAM، Master Data،
  Customers داخلی و اسناد مرکزی خارج از Scope PC-B هستند.
- main/develop مستقیم تغییر نمی‌کنند و هر Task PR مستقل به `develop` دارد.

### مرحله 3 — CRM و فروش (`P1`)

- [x] `CUSTOMER-002A.1`: Timeline/Filters/Privacy UX با Persistence فعلی؛ Draft PR #27 به‌صورت Stacked روی PR #26
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
