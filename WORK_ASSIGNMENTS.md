# Work Assignments

### `MASTER-003-LOCAL-PUBLISH` — PC-B — `IN_PROGRESS`

- مجوز صریح کاربر در 2026-08-31: انتشار تمام تغییرات محلی پروژه و فعال‌سازی نسخه کامل محلی، با حفظ کد و داده‌های موجود.
- اصلاحات سربرگ، وضعیت همکاری، حذف امن، فرم‌های سفر، ترمینال و وعده/سرویس در Commitها و شاخه‌های Stacked تفکیک می‌شوند؛ والدهای موجود، PC-A، main و develop تغییر نمی‌کنند. هیچ Merge یا Force Push انجام نمی‌شود.
- Scope شامل کد/تست/اسناد Master Data و مهاجرت‌های افزایشی معلق است؛ تنظیمات خصوصی، نسخه پشتیبان، داده عملیاتی، خروجی ساخت و Dependencyها وارد Git نمی‌شوند. سه قفل PC-B/MASTER-003 فعال و Dependency/Lockfile آزاد باقی می‌ماند.
- قبل از Deploy محلی، Backup دیتابیس گرفته می‌شود؛ Seed یا Reset روی داده کاربردی اجرا نمی‌شود. آزمون‌ها در DB مستقل هستند. API4000، Web3100 و زیرساخت Rubi پس از بررسی روشن می‌مانند.

### `MASTER-003-LOCAL-MEAL-SERVICE-FORM` — PC-B — `READY_FOR_REVIEW`

- تأیید صریح کاربر برای تکمیل روی همین نسخه محلی با حفظ تمام تغییرات موجود؛ checkout جاری `codex/pc-b-master-data-partner-forms` جابه‌جا نمی‌شود.
- Scope: فقط کد قابل تعریف وعده/سرویس، چندانتخابی وعده‌ها و وضعیت در حال بررسی؛ API/Contract/Web، Migration افزایشی، آزمون و اسناد همین اصلاح. بدون Customers، Seed یا Dependency/Lockfile.
- زیر قفل‌های فعال Migration/Contract/Docs مربوط به PC-B/MASTER-003. تغییرات قبلی حذف امن و فرم‌های دیگر حفظ می‌شوند. آزمون و Client جدید در نسخه آزمایشی جدا؛ Deploy دیتابیس کاربردی و تغییر سرورها خارج از این اصلاح است.
- قرارداد افزایشی سازگار با v12، Producer/Consumer: Master Data API/Web (PC-B): `values.code` اختیاری برای مصرف‌کننده قدیمی و قابل تعریف در فرم وعده؛ `values.status=active|inactive|under_review` با مجوز وضعیت و ذخیره اتمیک/Audit. در حال بررسی برای مصرف‌کننده قدیمی inactive است؛ `mealServiceStatus` فیلتر اختصاصی جدید و `includedMealsJson` نمایش بدون از دست دادن داده آرایه است.
- کد استاندارد با کنترل یکتایی و خطای هم‌زمانی، انتخاب چندگانه همراه پاک‌کردن و حفظ وعده سفارشی، وضعیت سه‌گانه در فرم/فهرست/فیلتر/Excel تکمیل شد. هشت آزمون واقعی PostgreSQL 18، Seed دوگانه، کنترل TypeScript و Build API/Web در نسخه جدا موفق؛ جزئیات در `docs/tasks/MASTER-003-LOCAL-MEAL-SERVICE-FORM.md`.
- فعال‌سازی محلی معلق است: Migration کاربردی و Client سرور مشترک تغییر نکرده‌اند؛ در کنترل نهایی API4000 پاسخ نمی‌دهد و Web3100 به Login می‌رود. Commit/Push و جابه‌جایی Branch در این اصلاح محلی انجام نشد.

آخرین به‌روزرسانی: 2026-08-31 — MASTER-003Q-PARTNER-FORMS آماده Review است

هر ردیف مالکیت یک واحد کار و فایل‌های آن را مشخص می‌کند. قبل از ویرایش، ردیف جدید
ثبت شود. وضعیت‌های مجاز: `PLANNED`، `PLANNED/RESERVED`، `IN_PROGRESS`،
`BLOCKED`، `READY_FOR_REVIEW`، `DONE`.

| Work ID                         | مالک         | Branch                                      | محدوده/فایل‌های اصلی                                                                                  | وضعیت              | وابستگی یا Handoff                                                          |
| ------------------------------- | ------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| BOOT-001                        | PC-A         | `codex/pc-a-bootstrap-docs`                 | اسناد Bootstrap، معماری، ERD، workflow و backlog                                                      | `READY_FOR_REVIEW` | PC-B باید همه اسناد و تصمیم‌های باز P0 را مرور کند                          |
| FOUNDATION-001                  | PC-A         | `codex/pc-a-technical-bootstrap`            | Technical Bootstrap: Monorepo، Web/API/Worker، Docker Compose و Prisma Client بدون مدل تجاری          | `DONE`             | Commit `d9a9793` ادغام شد؛ مبنای Work Itemهای Full-Stack                    |
| FOUNDATION-002                  | تخصیص‌نیافته | TBD                                         | سخت‌سازی زیرساخت، CI و استقرار محیط‌های غیرمحلی                                                       | `PLANNED`          | FOUNDATION-001 و تصمیم‌های میزبانی/RPO/RTO                                  |
| FOUNDATION-003                  | تخصیص‌نیافته | TBD                                         | IAM/Audit foundation، schema دامنه و Migration اولیه                                                  | `PLANNED`          | با `IAM-001` جایگزین شده؛ برای جلوگیری از اجرای موازی رزرو جدید نگیرد       |
| FOUNDATION-004                  | PC-B         | `codex/pc-b-frontend-foundation`            | Frontend Foundation: `apps/web/**`، تست Frontend و `docs/tasks/PC-B.md`                               | `READY_FOR_REVIEW` | Base `b5b7c5d`؛ قفل Dependency/Lockfile آزاد شد                             |
| DOCS-002                        | PC-A         | `codex/pc-a-hr-module-ownership`            | ثبت ماژول منابع انسانی، مالکیت نهایی ماژول‌ها و قرارداد همکاری Full-Stack                             | `READY_FOR_REVIEW` | فقط مستندات؛ بدون کد، Dependency، Schema یا Migration                       |
| DOCS-003                        | PC-A         | `codex/pc-a-sprint-1-planning`              | ثبت برنامه Sprint اول، مرز کار و Handoff دو Task `IAM-001` و `MASTER-001`                             | `READY_FOR_REVIEW` | Base `c4f8bde`؛ فقط اسناد برنامه‌ریزی                                       |
| ARCH-001                        | PC-A         | `codex/pc-a-approved-workflow-architecture` | معماری ۱۷ بخش، فروش/تخصیص، رزرواسیون/Manifest، تعریف بلیت، خرید/تخفیف و release مالی                  | `DONE`             | Merge `99dd1cf`؛ مرجع قطعی UI-ARCH-001                                      |
| UI-ARCH-001                     | PC-A         | `codex/pc-a-approved-workflow-frontend`     | منوی ۱۷ بخشی، صفحات گردش فروش/رزرواسیون/خرید/مالی، تعریف بلیت و مدیریت سیستم در `apps/web/**`         | `DONE`             | Merge `543f6e2`؛ دسترسی عملی IAM از مدیریت سیستم و منوی ۱۷ بخشی تثبیت شد    |
| IAM-001                         | PC-A         | `codex/pc-a-iam-foundation`                 | IAM Full-Stack: Database، API، Web، Test، امنیت، شعبه/دسترسی و Audit                                  | `DONE`             | Merge `50eaccaf`؛ Handoff عمومی IAM ثبت و قفل‌های مشترک آزاد شد             |
| MASTER-001                      | PC-B         | `codex/pc-b-master-data-foundation`         | Foundation بدون Persistence اطلاعات پایه، UI، قرارداد ماژول‌محلی و تست                                | `DONE`             | Merge `cda0f9a`؛ Persistence واقعی به `MASTER-002` منتقل شد                 |
| SPRINT1-HANDOFF-001             | PC-A         | `codex/pc-a-sprint-1-handoff`               | بستن Sprint اول، ثبت Mergeهای نهایی، آزادسازی قفل‌ها و برنامه اولیه Sprint دوم                        | `DONE`             | Merge `9c69124`؛ چهار قفل Sprint اول آزاد شدند                              |
| SPRINT2-PLANNING-001            | PC-A         | `codex/pc-a-sprint-2-planning`              | ترتیب اجرا، قفل‌ها، مرز فایل و Handoff سه Task آغاز Sprint دوم                                        | `DONE`             | Merge `9efb37c`؛ فقط اسناد برنامه‌ریزی و وضعیت                              |
| IAM-002                         | PC-A         | `codex/pc-a-iam-domain-permissions`         | انتشار Permission Codeهای Master Data و Customers، Seed تکرارپذیر و Handoff قرارداد عمومی             | `DONE`             | Merge `d1f1133`؛ ۱۷ Permission و بدون Schema/Migration/Dependency           |
| IAM002-HANDOFF-001              | PC-A         | `codex/pc-a-iam-002-handoff`                | ثبت Merge، آزادسازی IAM contract lock و مجازکردن شروع دو Task مستقل Sprint دوم                        | `DONE`             | Merge `0af31c2`؛ دو Task مستقل مجاز به شروع هستند                           |
| MASTER-002                      | PC-B         | `codex/pc-b-master-data-persistence`        | Database، Migration، Repository، Backend و اتصال واقعی Frontend اطلاعات پایه                          | `DONE`             | Merge `ddfebb3`؛ چهار قفل با Handoff مستقل آزاد شدند                        |
| CUSTOMER-001                    | PC-A         | `codex/pc-a-customer-persistence`           | مشتریان، Persistence، رمزنگاری Contact، Audit redaction و Duplicate query                             | `DONE`             | PR #19؛ Merge `7d0a4f4`؛ Migration و قرارداد Customer پایدار و تحویل‌شده    |
| CUSTOMER-002A                   | PC-A         | TBD                                         | Customer Operations Enhancement در مرز Web/API فعلی Customers و تست‌های اختصاصی                       | `PLANNED/RESERVED` | شروع از آخرین `origin/develop`؛ بدون قفل مشترک و بدون تداخل با MASTER-003   |
| CUSTOMER001-FINANCE-HANDOFF-001 | PC-A         | `codex/pc-a-customer-finance-handoff`       | آزادسازی چهار قفل CUSTOMER-001 و رزرو کنترل‌شده FINANCE-001؛ فقط اسناد مرکزی و سند Handoff            | `DONE`             | PR #20؛ Merge `11fc875`؛ بدون کد، Schema، Migration، Dependency یا Lockfile |
| FINANCE-001                     | PC-A         | `codex/pc-a-finance-foundation`             | Foundation مالی و چهار Decision پذیرفته‌شده؛ Phase A بدون Persistence و Migration                     | `DONE`             | PR #21؛ Merge `45c107e`؛ قفل‌های stale با نبود FINANCE-002 آزاد شدند        |
| LEGAL-ENTITY-CONTEXT-001        | PC-A         | `codex/pc-a-legal-entity-context`           | Legal Entity Full-Stack، Prisma، API، Contract، App Shell، صفحه مدیریت، Audit و Test                  | `DONE`             | PR #24؛ Merge `b6da5d6`؛ قفل‌ها با دلیل `DONE/MERGED via PR #24` آزاد شدند  |
| MASTER-003                      | PC-B         | `codex/pc-b-master-data-advanced`           | توسعه افزایشی Master Data: Schema/Migration، Contract، Backend، Frontend، Excel Import/Export و Test  | `IN_PROGRESS`      | Draft PR #25؛ خروجی XLSX واقعی فعال؛ سه قفل فعال و Dependency lock آزاد است |
| CALENDAR-001                    | PC-B         | `codex/pc-b-master-data-advanced`           | تقویم مشترک آبی با سوییچ شمسی/میلادی در همه فرم‌های Web                                               | `READY_FOR_REVIEW` | ۸۵ تست Web، Typecheck و Lint موفق؛ چهار route لوکال پاسخ ۲۰۰ دادند          |
| MASTER-003B-GEO                 | PC-B         | `codex/pc-b-master-data-next`               | Vertical Slice جغرافیا: Country، Province/Region، City، Airport، Terminal و تست/مستندات همان Slice    | `READY_FOR_REVIEW` | Draft PR #28 روی PR #25؛ سه قفل MASTER-003 فعال می‌مانند                    |
| MASTER-003C-FINANCIAL           | PC-B         | `codex/pc-b-master-data-financial`          | مالی و پولی در Master Data: Currency، Rate Workflow/History، Bank/Branch و Payment Method مرجع        | `READY_FOR_REVIEW` | Draft PR #29 روی PR #28 و به‌تبع آن #25؛ بدون Query مستقیم Finance          |
| MASTER-003D-UI-POLISH           | PC-B         | `codex/pc-b-master-data-ui-polish`          | KPI پاستلی مشترک، نمای کامل جغرافیا و حذف underline کارت‌های Hub بدون تغییر Backend/Database          | `READY_FOR_REVIEW` | Draft PR #30 روی PR #29؛ ۳۳۵ تست، Typecheck و Build موفق                    |
| MASTER-003E-SUPPLIERS           | PC-B         | `codex/pc-b-master-data-suppliers`          | Vertical Slice سازمان‌ها و تأمین‌کنندگان: Supplier، Broker، Contact ماسک‌شده، Service و Collaboration | `READY_FOR_REVIEW` | Draft PR #31 روی PR #30؛ قفل‌های Migration/Contract/Docs فعال MASTER-003    |
| MASTER-003F-ACCOMMODATION       | PC-B         | `codex/pc-b-master-data-accommodation`      | Vertical Slice اقامت: Hotel Profile، Chain، Room، Meal، Facility، Excel و Composite Hotel             | `READY_FOR_REVIEW` | Draft PR #32 روی PR #31؛ قفل‌های Migration/Contract/Docs فعال MASTER-003    |
| MASTER-003G-UX-CONSOLIDATION    | PC-B         | `codex/pc-b-master-data-ux-consolidation`   | ادغام نرخ/تاریخچه در ارز، ادغام نمای شهر/استان، پروفایل‌های Popup و حذف نمای مستقل مخاطبان             | `READY_FOR_REVIEW` | Draft PR #33 روی PR #32؛ فقط Web/Test/Docs و بدون Schema، Migration یا API  |
| MASTER-003H-TRANSPORT           | PC-B         | `codex/pc-b-master-data-transport`          | Vertical Slice حمل‌ونقل: Airline، Aircraft، Cabin، Baggage، Manifest، Rail و Bus با پروفایل Popup       | `READY_FOR_REVIEW` | Draft PR #35 روی PR #33؛ سه قفل MASTER-003 فعال و Customers دست‌نخورده است  |
| MASTER-003I-SALES-REFERENCES    | PC-B         | `codex/pc-b-master-data-sales-references`   | Vertical Slice مراجع فروش: Acquaintance، Lead Source، Channel، Lost Reason، Customer Type، Tag، Campaign | `READY_FOR_REVIEW` | Draft PR #36 روی PR #35؛ سه قفل فعال و بدون Query مستقیم Customers          |
| MASTER-003J-INSURANCE           | PC-B         | `codex/pc-b-master-data-insurance`          | Vertical Slice بیمه: Insurer، Insurance Plan، Coverage، روابط مرجع، Popup و آزمون کامل                 | `READY_FOR_REVIEW` | Draft PR #37 روی PR #36؛ سه قفل فعال و بدون داده عملیاتی Reservations       |
| MASTER-003K-TRAVEL-SERVICES     | PC-B         | `codex/pc-b-master-data-travel-services`    | Vertical Slice تور و خدمات سفر: Leader، Tour/Transfer Type، CIP، Visa و Bus Catalog                    | `READY_FOR_REVIEW` | Draft PR #38، Stacked روی PR #37؛ همه Profileها Popup؛ Bus به Organization/Provider و Facility واقعی متصل است |
| MASTER-003L-SECTION-CLEANUP     | PC-B         | `codex/pc-b-master-data-section-cleanup`   | حذف شش ورودی از رابط خدمات سفر و مراجع فروش؛ هماهنگی کارت‌ها و تست ناوبری                         | `READY_FOR_REVIEW` | Stacked روی PR #38؛ Web/Test/Docs زیر قفل MASTER-003؛ بدون حذف داده، تغییر API یا Customers |
| CUSTOMER-AFFAIRS-001            | PC-B         | `codex/pc-b-customer-affairs-foundation`    | Foundation امور مشتریان: Lead، پیش‌فروش، Follow-up، پشتیبانی پس از فروش و Ticket                      | `PLANNED`          | فاز A فقط Frontend، طراحی دامنه، قرارداد ماژول‌محلی و تست؛ بدون Persistence |
| MODULES-FOUNDATION-001          | PC-A         | `codex/pc-a-all-modules-foundation`         | Foundation رابط ۱۷ بخش، تست Web و اسناد Task؛ `pnpm-workspace.yaml` فقط برای Build Policy Fix         | `READY_FOR_REVIEW` | PR #23؛ قفل موقت Dependency/Lockfile فقط برای Allowlist دقیق pnpm 11        |
| MASTER002-HANDOFF-001           | PC-A         | `codex/pc-a-master-002-handoff`             | ثبت Mergeهای MASTER-002/Customer Phase A، انتقال قفل‌ها و مرز فاز B                                   | `READY_FOR_REVIEW` | فقط شش فایل مستنداتی؛ Draft PR به `develop`                                 |

### `MASTER-003-LOCAL-TRAVEL-FORMS` — PC-B — `READY_FOR_LOCAL_REVIEW` (فعال‌سازی معلق)

- تأیید کاربر برای تکمیل فرم‌های نوع ترانسفر و ویزا روی تغییرات موجود، بدون حذف یا بازنویسی کار نوع تور، حذف امن و سایر اصلاحات محلی.
- محدوده: دو فرم و نمایش فهرست/پروفایل آن‌ها، وضعیت مجوزدار اتمیک، ظرفیت بازه‌ای، نوع اعتبار مرجع ویزا، Migration افزایشی و آزمون‌های همان دو منبع.
- Schema، Migration `20260831100000_master_data_travel_reference_forms`، قرارداد افزایشی v12 و اسناد این اصلاح زیر قفل موجود `PC-B/MASTER-003` هستند؛ Dependency/Lockfile، Customers و IAM داخلی تغییر نمی‌کنند.
- در این گفت‌وگوی جانبی Branch/Commit/Push یا سرورهای مشترک تغییر نمی‌کنند؛ بررسی دیتابیس و ساخت در محیط آزمایشی جدا انجام می‌شود. جزئیات سازگاری در `docs/tasks/MASTER-003-LOCAL-TRAVEL-FORMS.md` ثبت می‌شود.
- فرم‌ها و ذخیره‌سازی پیاده شدند؛ ۷۰ تست هدفمند API، ۲۸ تست Web، ۱۳ تست واقعی PostgreSQL 18 و دو تست Migration موفق‌اند. اجرای Migration/بازسازی Client روی محیط مشترک در این کار انجام نشده و باید با کار هم‌زمان ترمینال هماهنگ شود.

### `MASTER-003Q-PARTNER-FORMS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-partner-forms` از `560b3c1` / PR #44؛ والدها تغییر نمی‌کنند.
- مجوز هماهنگی: درخواست صریح کاربر در 2026-08-31 برای تکمیل تأمین‌کننده/کارگزار روی نسخه فعلی با حفظ تغییرات محلی حذف امن و وضعیت همکاری. آن تغییرات جداگانه باقی می‌مانند و در Commit این کار وارد نمی‌شوند.
- محدوده: نام انگلیسی مستقل پروفایل، نوع شخصیت سازمان، تماس اصلی وابسته به همان سازمان، انتخاب چندگانه خدمات، فرم‌های Popup، Migration افزایشی، API/Permission/Audit، Test و اسناد همین Slice.
- سه قفل Migration/Contract/Docs همان `PC-B/MASTER-003`؛ Schema، قرارداد Master Data و اسناد وضعیت برای همین زیرواحد رزرو می‌شوند. بدون Dependency، Customers یا فایل داخلی ماژول دیگر.
- Producer: Master Data API، Consumer: Master Data Web. توسعه سازگار با v12: فیلدهای اختیاری `englishName`/`primaryContactId` برای Supplier/Broker و `personType` برای Organization؛ نبود فیلد در PATCH مقدار قبلی را حفظ می‌کند. فقط نام/Mask مخاطب در پاسخ عمومی؛ هیچ Ciphertext یا شماره کامل در List/Export/Audit پروفایل نیست.
- قرارداد و محدودیت خرید فاقد Public Service عملیاتی‌اند؛ اتصال آن‌ها Deferred و بدون جعل داده/نوشتن در مالک دیگر است.
- Draft PR #45: https://github.com/nirvanamahlou/Rubi/pull/45 — Stacked روی `codex/pc-b-master-data-clear-fields` و وابسته به #44 و زنجیره #25؛ پیش از والد Merge نشود.
- نتیجه: چهار فیلد/قابلیت اصلی با ذخیره واقعی، Mask، انتخاب چندگانه و Popup تکمیل شد. Migration `20260831090000_master_data_partner_forms` افزایشی است؛ PostgreSQL 18 خالی، Seed دوبار و چهار آزمون واقعی DB موفق‌اند. تست‌های واحد، typecheck، lint محدوده و Production Build موفق؛ lint کلی Web فقط ایراد قبلی DatePicker را دارد. Smoke احراز‌شده به Session کاربر نیاز دارد.

### `MASTER-003-LOCAL-TERMINAL-FORM` — PC-B — `READY_FOR_REVIEW` (محلی)

- تأیید صریح کاربر برای تکمیل ترمینال روی فایل‌های دارای تغییر محلی و Migration افزایشی در 2026-08-31؛ تغییرات حذف امن، تور و سایر کارها حفظ می‌شوند. کار محلی روی checkout فعلی، بدون تغییر Branch، Commit/Push، restart سرورها یا تغییر داده عملیاتی است.
- محدوده: مدل/Migration ترمینال، Policy و Repository/DTO/Export همان Master Data، Contract افزایشی، فرم/فهرست جغرافیا، آزمون‌ها و گزارش. فایل‌های مرکزی Schema/Contract/Docs زیر همان سه قفل PC-B/MASTER-003 رزرو هستند؛ Dependency/Lockfile آزاد و دست‌نخورده می‌ماند.
- Producer: Master Data API؛ Consumer: Master Data Web. `MIXED` به enum نوع ترمینال اضافه می‌شود. فیلدهای اختیاری `gateCount`، `operatingHoursMode`، `opensAt`، `closesAt` افزایشی و سازگار با payload قدیمی‌اند؛ نبود در PATCH مقدار قبل را حفظ می‌کند. ساعت‌ها ساعت محلی تکرارشونده در Timezone فرودگاه‌اند، نه زمان وقوع رویداد.
- `values.status` فقط در فرم ترمینال مقادیر active/inactive/maintenance دارد و با مجوز master_data.status.manage، همراه مشخصات در یک تراکنش/Audit ذخیره می‌شود. رکورد در تعمیرات isActive=false و isUnderMaintenance=true دارد؛ قرارداد عمومی status همچنان active/inactive است و مصرف‌کننده قدیمی آن را قابل استفاده نمی‌بیند.
- شهر، IATA/ICAO و Timezone از FK فرودگاه خوانده می‌شوند؛ نام تغییر‌دهنده فقط از API عمومی مجوزدار IAM، بدون Query مستقیم. Schema/Migration فقط افزایشی است؛ تست DB در پایگاه موقت مستقل انجام می‌شود. Customers و Finance خارج از محدوده‌اند.
- نتیجه: فرم و فهرست ترمینال شامل نوع مشترک، تعداد گیت، ساعت فعالیت و تعمیرات تکمیل شد. ۶۹ تست جدید API/Web و ۱۵ آزمون واقعی PostgreSQL 18 موفق؛ مجموعه جاری API با ۴۶۳، Web با ۳۰۴ و Contract با ۱۴ تست موفق است. lint محدوده، typecheck با قرارداد جاری، Prisma format/validate/generate و Build جداگانه API/Web موفق‌اند.
- Migration `20260831110000_master_data_terminal_details` و Seed دوبار فقط در DB مستقل آزموده شدند؛ Seed در نسخه آزمایشی با مهلت تراکنش ۶۰ثانیه‌ای اجرا شد چون مهلت پیش‌فرض ۵ثانیه‌ای در محیط جاری تمام می‌شد. DB آزمون حذف شد؛ فعال‌سازی روی دیتابیس/سرور مشترک هنوز انجام نشده و نیازمند هماهنگی است. گزارش: `docs/tasks/MASTER-003-LOCAL-TERMINAL-FORM.md`.

### `MASTER-003-LOCAL-TOUR-FORM` — PC-B — `READY_FOR_REVIEW` (محلی)

- کار محلی گفت‌وگوی جانبی با تأیید صریح کاربر برای اصلاح هم‌پوشان، با حفظ تغییرات موجود؛ در این گفت‌وگو Branch جابه‌جا نشد و Commit/Push انجام نشد. هنگام پایان بررسی، checkout مشترک روی `codex/pc-b-master-data-partner-forms` بود.
- Scope: فقط فرم/فهرست نوع تور، اعتبارسنجی و ذخیره اتمیک وضعیت در Master Data، نمایش metadata آخرین تغییر، آزمون‌ها و سند `docs/tasks/MASTER-003-LOCAL-TOUR-FORM.md`؛ بدون Customers، IAM داخلی، Schema/Migration/Seed یا Dependency/Lockfile.
- تغییر محدود فایل‌های مشترک `master-data.service.ts`، `master-data.repository.ts` و `master-data-travel-services-workspace.tsx` با حفظ کامل حذف امن و سایر تغییرات محلی؛ فایل‌های جدید فرم و آزمون مستقل‌اند. اسناد مرکزی زیر قفل فعال PC-B/MASTER-003 می‌مانند.
- Producer/Consumer: Master Data API/Web. قرارداد افزایشی سازگار با v12: `values.status` اختیاری فقط برای `tour-types`؛ تغییر وضعیت نیازمند `master_data.status.manage` و همراه سایر فیلدها در همان تراکنش/Audit است. نبود status رفتار قدیمی را حفظ می‌کند.
- پاسخ نوع تور در attributes، `updatedByUserId` واقعی و `usageCount=null`/`usageStatus=UNAVAILABLE` دارد. شمارش محصولات تا انتشار قرارداد مالک موجود نیست؛ نام کاربر فقط از API عمومی مجوزدار `GET /iam/users` خوانده می‌شود، بدون Query مستقیم یا ذخیره نام/PII در Master Data.
- بررسی: ۵۸ آزمون جدید نوع تور؛ مجموعه جاری Web با ۲۴۲ تست و API با ۳۸۴ تست موفق/۱۱ تست skipped؛ typecheck، lint فایل‌های متاثر و Build جدا از خروجی سرور موفق‌اند. Smoke احراز‌شده به‌دلیل نبود Session انجام نشد. شمارش استفاده همچنان وابسته به قرارداد محصولات است.

### `MASTER-003P-CLEAR-FIELDS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-clear-fields` از PR #43 / `b78d0a9`؛ والد دست‌نخورده می‌ماند.
- محدوده: پاک‌کردن انتخاب در فرم‌های Master Data (انتخاب ساده/مرجع/چندانتخابی/تاریخ)، کنترل محلی فرم، اعتبارسنجی و آزمون‌های Web و اسناد همین واحد کار.
- فیلد اجباری پس از پاک‌کردن بدون انتخاب دوباره قابل ذخیره نیست؛ فیلد فقط‌خواندنی یا در حال ذخیره قابل پاک‌کردن نیست. پاک‌کردن انتخاب هیچ رکورد مرجعی را حذف نمی‌کند.
- بدون تغییر UI مشترک، Customers، Backend، Contract، Schema/Migration/Seed یا Dependency/Lockfile؛ اسناد مرکزی تحت قفل فعال `PC-B/MASTER-003` و سه قفل اصلی ثابت‌اند.
- رزرو فایل مرکزی جدید `apps/web/vitest.config.mts` فقط برای اجرای آزمون واقعی کامپوننت‌های TSX با همان JSX خودکار Next و alias موجود Web؛ بدون Dependency یا تغییر تنظیمات ساخت Next.
- تغییرات محلی موجود در `master-data-suppliers-workspace.tsx` و `supplier-collaboration.ts` خارج از Scope‌اند و نه بازنویسی، نه stage می‌شوند.
- تحویل Draft Stacked روی `codex/pc-b-master-data-payment-form`؛ پیش از #43 و والدهای پشته Merge نشود.
- کنترل کیفیت روی checkout مستقل همین Commit (بدون تغییرات هم‌زمان دیگر): Frozen install، `175/175` تست Web شامل ۲۰ آزمون جدید، typecheck، lint فایل‌های متاثر و Production Build موفق؛ گزارش کامل در `docs/tasks/MASTER-003P-CLEAR-FIELDS.md`.

### `MASTER-003O-PAYMENT-FORM` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-payment-form` از PR #42 / `495af50`؛ والد دست‌نخورده می‌ماند.
- محدوده: حذف ورودی کد روش و نام انگلیسی فقط از فرم روش پرداخت، مدل فیلدهای فرم و validation، تولید کد داخلی در Master Data API و تست/اسناد همان کار؛ بدون Customers یا Finance.
- رفتار افزایشی سازگار با Contract v12: در `POST /api/v1/master-data/payment-methods` اگر `values.code` ارسال نشود، Backend کد یکتا تولید می‌کند. کد صریح مصرف‌کننده قدیمی همچنان پذیرفته و اعتبارسنجی می‌شود؛ Update بدون این دو فیلد، مقدارهای قبلی را حفظ می‌کند. Producer: Master Data API؛ Consumer: Master Data Web؛ هر دو PC-B.
- فیلدهای Catalog/Export، Schema، Migration، Seed، قرارداد عمومی و Dependency/Lockfile تغییر نمی‌کنند؛ اسناد مرکزی تحت قفل فعال `PC-B/MASTER-003` و سه قفل اصلی ثابت‌اند.
- Draft PR روی شاخه `codex/pc-b-master-data-clean-labels`؛ پیش از #42 و والدهای پشته Merge نشود.
- Web: `155/155` و API: `245/245` تست موفق؛ typecheck هر دو، lint فایل‌های Web متاثر و کل API و Production Build هر دو موفق‌اند. API محلی با کد جدید پاسخ ۲۰۰ می‌دهد؛ گزارش در `docs/PROJECT_STATUS.md`.

### `MASTER-003N-CLEAN-LABELS` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-clean-labels` از PR #40 / `808ca13`؛ والد دست‌نخورده می‌ماند.
- محدوده: حذف متن و نشان فنی از Header فرم‌ها و Workspaceهای Master Data؛ فقط `apps/web/src/modules/master-data/components/**` و تست/اسناد همان کار.
- قرارداد API، اعتبارسنجی، Audit، نسخه رکورد، هشدار Preview، داده‌ها و فرم‌ها حفظ می‌شوند؛ بدون Backend/Schema/Migration/Seed/Dependency/Customers.
- اسناد وضعیت تحت قفل فعال `PC-B/MASTER-003`؛ سه قفل اصلی تغییر نمی‌کنند و Dependency آزاد می‌ماند. Draft PR مستقیم روی #40 و بدون Merge خودکار.
- Web: هر ۱۵۱ تست، typecheck، lint فایل‌های تغییرکرده و Production Build موفق؛ هشت صفحه ساخته‌شده فاقد برچسب‌های حذف‌شده‌اند. گزارش در `docs/PROJECT_STATUS.md` ثبت شد.

### `MASTER-003M-CURRENCY-FORM` — PC-B — `READY_FOR_REVIEW`

- Branch: `codex/pc-b-master-data-currency-form` از PR #39 / `02f88e9`؛ والد دست‌نخورده است.
- گزارش پیاده‌سازی و کنترل کیفیت: `docs/tasks/MASTER-003M-CURRENCY-FORM.md`؛ Draft PR مستقیم روی #39، بدون Merge خودکار.
- محدوده: فرم ارز و ثبت نرخ خرید/فروش در Web، تست‌ها، API همان Master Data و اسناد.
- قفل مشترک: `packages/contracts/src/master-data/index.ts` و export لازم، تحت قفل فعال MASTER-003؛ بدون Schema/Migration/Dependency یا Customers.
- قرارداد افزایشی سازگار با v12: `POST /api/v1/master-data/currency-rates/quotes` با ارز مبدأ/مقصد، buyRate و sellRate اختیاری (حداقل یکی)، منبع، زمان UTC، بازه اعتبار و دلیل اصلاح؛ پاسخ فهرست نرخ‌های جدید. Producer: Master Data API؛ Consumer: فرم ارز Master Data Web، هر دو PC-B. مسیرهای قبلی و ساختار تاریخچه تغییر نمی‌کنند.
- دو نرخ در تراکنش واحد، Draft و `isAuthoritative=false` ثبت می‌شوند؛ ثبت‌کننده از actor است. ارز پایه فقط‌خواندنی و منتظر قرارداد Finance باقی می‌ماند. سیاست نمایش از UI حذف و مقدار ذخیره‌شده حفظ می‌شود؛ ایجاد جدید از Default موجود DB استفاده می‌کند.

### قفل موقت Supply-chain برای Review PR #23

- `Dependency/Lockfile Owner = PC-A/MODULES-FOUNDATION-001` در 2026-08-25 فقط برای
  اصلاح `allowBuilds` در `pnpm-workspace.yaml` رزرو شد؛ افزودن یا تغییر Dependency،
  Version و `pnpm-lock.yaml` مجاز نیست.
- Fresh Install frozen بدون `ERR_PNPM_IGNORED_BUILDS` پاس شد؛ فقط Scriptهای
  `@parcel/watcher` و `@swc/core` اجرا شدند، `pnpm-lock.yaml` ثابت ماند و قفل موقت
  Dependency/Lockfile در 2026-08-25 با وضعیت `RELEASED` آزاد شد.

## Sprint 1 — مرز فایل و Handoff

### `IAM-001` — PC-A

- محدوده مالکیت پیاده‌سازی: مدل و Migrationهای IAM، Backend احراز هویت و authorization،
  Frontend ورود/خروج و مدیریت کاربران/نقش‌ها، تست‌های unit/integration/permission/E2E و
  Audit رخدادهای امنیتی.
- فایل‌های رزروشده: `apps/api/src/iam/**`، پیکربندی ضروری API، مسیرهای احراز هویت و
  مدیریت دسترسی در `apps/web/src/**`، `packages/contracts/src/iam/**`،
  `packages/database/prisma/schema.prisma` و Migration/Seed نخست IAM، manifestهای
  ضروری، `pnpm-lock.yaml` و اسناد وضعیت/امنیت/Handoff همین Task.
- قفل‌های **Migration Owner = PC-A**، **Dependency/Lockfile Owner = PC-A** و
  **IAM shared-contract Owner = PC-A** در طول Task رزرو بودند و پس از Merge
  `50eaccaf` و Handoff مورخ 2026-08-23 آزاد شدند.
- خروجی لازم برای PC-B: قرارداد عمومی branch/reference مورد استفاده Master Data، شکل
  actor/audit و روش مصرف permission بدون import داخلی از IAM.

### `MASTER-001` — PC-B

- محدوده مالکیت پیاده‌سازی: کشور/شهر، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل،
  organizationهای آژانس/شرکت، کارگزار، لیدر، نحوه آشنایی، وضعیت فعال/غیرفعال،
  جست‌وجو/فیلتر، Excel/PDF، Frontend، API Contract و Test.
- در طول `MASTER-001` و تا Handoff از `IAM-001`، PC-B فقط بخش‌های بدون Migration را
  توسعه داد؛ Persistence واقعی اکنون به `MASTER-002` منتقل شده و پیش از شروع آن باید
  قفل مستقل Prisma/Migration و Dependency رزرو شود.
- قرارداد Master Data نباید ساختار داخلی IAM را تکرار کند. نیاز به branch access، actor
  یا permission ابتدا به‌صورت consumer requirement برای PC-A ثبت و از قرارداد عمومی IAM
  مصرف می‌شود.
- در شروع `MASTER-002`، PC-B باید آخرین `origin/develop` را دریافت، نبود
  Migration/Dependency Owner دیگر را تأیید و قفل لازم را پیش از هر تغییر Schema یا
  Dependency رسماً رزرو کند.
- قراردادهای این مرحله فقط داخل ماژول Web و سند Task تعریف می‌شوند و proposal هستند؛
  انتقال آن‌ها به `packages/contracts/**` یا پیاده‌سازی Backend نیازمند رزرو مستقل فایل
  مشترک و Handoff ثبت‌شده با producer/consumer است.
- Consumer requirementهای IAM شامل permission code، branch scope و actor/audit در
  `docs/tasks/MASTER-001.md` ثبت می‌شوند؛ هیچ فایل IAM در این Task تغییر نمی‌کند.

## قفل‌های آزادشده Sprint اول

| قفل                       | مالک پیشین/Task | وضعیت      | تاریخ و مبنای آزادسازی                                                           |
| ------------------------- | --------------- | ---------- | -------------------------------------------------------------------------------- |
| Migration Owner           | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ IAM baseline با Merge `50eaccaf` ادغام و Handoff عمومی ثبت شد        |
| Dependency/Lockfile Owner | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ Dependencyهای IAM با Merge `50eaccaf` تثبیت و Sprint اول بسته شد     |
| IAM shared-contract Owner | PC-A/IAM-001    | `RELEASED` | 2026-08-23؛ قرارداد عمومی IAM با Merge `50eaccaf` در `@rubi/contracts` منتشر شد  |
| Central architecture docs | PC-A/ARCH-001   | `RELEASED` | 2026-08-23؛ معماری تاییدشده با Merge `99dd1cf` وارد `develop` و به PC-B تحویل شد |

آزادشدن این قفل‌ها به معنی مجوز هم‌زمان برای دو Task نبود. وضعیت تاریخی این بخش با
برنامه Sprint دوم پایین تکمیل می‌شود: `MASTER-002` قفل‌های جدید را پس از Merge برنامه
رزرو می‌کند و `CUSTOMER-001` تا Handoff بعدی از آن‌ها استفاده نمی‌کند. در هر لحظه همچنان
فقط یک Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## Handoff رسمی IAM به PC-B

- قرارداد عمومی IAM فقط از `@rubi/contracts` مصرف می‌شود.
- `BranchReference`، `AuthenticatedActor` و `IamPermissionCode` (از جمله
  `iam.audit.read`) قراردادهای عمومی قابل مصرف برای `MASTER-002` هستند؛ Audit فقط با
  actor context عمومی ثبت می‌شود و مدل یا Repository داخلی Audit عمومی نیست.
- دسترسی مستقیم Master Data به جدول‌ها، Prisma modelها یا Repository داخلی IAM ممنوع
  است؛ ارتباط فقط از قرارداد یا سرویس عمومی versioned انجام می‌شود.
- این Handoff قفل‌های Sprint اول را آزاد می‌کند، اما به PC-B یا PC-A قفل Migration یا
  Dependency جدید نمی‌دهد؛ تخصیص بعدی فقط در PR برنامه‌ریزی Sprint دوم انجام می‌شود.

## Sprint 2 — ترتیب اجرا، مرز فایل و Handoff

مرجع جزئیات این Sprint در `docs/tasks/SPRINT-2-PLANNING.md` است. ترتیب الزامی:

1. `IAM-002` روی آخرین `origin/develop` قرارداد Permission عمومی Master Data و Customers
   را منتشر و Seed تکرارپذیر را بدون تغییر Schema/Migration تکمیل می‌کند.
2. پس از Merge و Handoff `IAM-002`، `MASTER-002` وارد فاز Full-Stack می‌شود و تنها مالک
   Migration و Dependency/Lockfile خواهد بود.
3. `CUSTOMER-001` می‌تواند هم‌زمان فقط فاز A بدون Persistence را پیش ببرد؛ تغییر Prisma،
   Migration، manifest، lockfile، root export قرارداد مشترک یا فایل IAM ممنوع است.
4. پس از Merge `MASTER-002` و آزادسازی صریح قفل‌ها، یک Handoff مستقل قفل Migration را
   برای فاز B `CUSTOMER-001` رزرو می‌کند؛ مالکیت خودکار منتقل نمی‌شود.

### `IAM-002` — PC-A

- فایل‌های رزروشده: `packages/contracts/src/iam/**`، export ضروری
  `packages/contracts/src/index.ts`، بخش permission در `packages/database/prisma/seed.ts`،
  تست‌های قرارداد/Seed و اسناد همان Task.
- خروجی: Permission Codeهای versioned حداقل برای read/create/update/status/export در
  Master Data و read/create/update/merge/consent/sensitive-read در Customers.
- این Task مجاز به تغییر `schema.prisma`، Migration، Dependency یا Lockfile نیست.

### `MASTER-002` — PC-B

- فایل‌های رزروشده پس از Handoff IAM-002: مدل‌های Master Data در
  `packages/database/prisma/schema.prisma`، Migration جدید همان Task،
  `apps/api/src/master-data/**`، `apps/web/src/modules/master-data/**`، route موجود،
  `packages/contracts/src/master-data/**`، export هماهنگ‌شده قرارداد و تست/اسناد Task.
- دسترسی مستقیم به `iam_*` یا Repository داخلی IAM ممنوع است؛ actor، branch و permission
  فقط از قرارداد عمومی IAM مصرف می‌شوند. جدول reference مشترک `branches` فقط در محدوده
  lifecycle تاییدشده Master و همراه contract test تغییر می‌کند.
- نرخ ارز authoritative تا حل `DEC-OPEN-004` خارج از Migration قطعی است؛ Currency و سایر
  Catalogها می‌توانند کامل شوند، اما نرخ Draft/Preview منبع گزارش مالی نیست.
- تولید واقعی artifactهای Excel/PDF تا قرارداد Documents/Worker مسدود است؛ MASTER-002
  فقط permission، فیلتر snapshot و قرارداد async export را پایدار می‌کند و فایل ساختگی
  تولید نمی‌کند.
- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` وارد
  `develop` شد؛ Task `DONE` است و مالکیت چهار قفل آن در Handoff مستقل پایان یافت.

### `CUSTOMER-001` — PC-A

- فاز A: `docs/tasks/CUSTOMER-001.md`، UI و stateهای Customers در `apps/web/**`، طراحی
  application/API در `apps/api/src/customers/**` و تست‌های دامنه بدون Persistence واقعی.
- فاز A حق تغییر Prisma، Migration، Dependency/Lockfile، `packages/contracts/src/index.ts`،
  فایل‌های Master Data یا IAM را ندارد و وضعیت Task تا Handoff `IN_PROGRESS` می‌ماند.
- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  ادغام و `DONE/MERGED` شد؛ وضعیت کلی Task تا پایان فاز B `IN_PROGRESS` می‌ماند.
- فاز B با این Handoff فقط در دامنه Customers مجاز است: مدل/Repository/Migration، قرارداد
  عمومی، اتصال واقعی UI، permission/audit و تست Migration را تکمیل می‌کند و حق تغییر فایل
  داخلی IAM یا Master Data را ندارد.
- Master Data فقط از قرارداد عمومی `@rubi/contracts` مصرف می‌شود؛ import یا query مستقیم
  از ساختار داخلی Master Data ممنوع است.
- ذخیره فایل یا مقدار حساس مدارک هویتی تا حل `DEC-OPEN-006` ممنوع است؛ فقط metadata/reference
  غیرحساس طراحی می‌شود. Duplicate auto-merge تا حل `DEC-OPEN-011` ممنوع و فقط candidate
  detection و review دستی طراحی می‌شود.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده: `codex/pc-b-customer-affairs-foundation`.
- هدف فاز A: Foundation امور مشتریان شامل درخواست مشتری، Lead و منبع آشنایی،
  مرحله‌بندی و Qualification قبل از فروش، نیاز سفر و بودجه اولیه، تماس‌ها،
  فعالیت‌ها و Follow-up و پشتیبانی پس از فروش.
- محدوده پشتیبانی شامل Ticket، دسته‌بندی، اولویت، وضعیت، SLA، مسئول، Escalation،
  یادآوری، شکایت، درخواست اصلاح، کنسلی/استرداد، رضایت‌سنجی و بستن Ticket است.
- تبدیل Lead به Customer یا Sales Request و ارتباط Ticket با مشتری، قرارداد، رزرو و
  خدمت فقط Contract پیشنهادی ماژول‌محلی است و هیچ mutation بین‌ماژولی اجرا نمی‌کند.
- مرز فایل آینده PC-B فقط `apps/web/src/modules/customer-affairs/**`، route موجود
  `apps/web/src/app/(crm)/customer-affairs/**`،
  `apps/api/src/customer-affairs/**` برای Domain/Application Port و Contract
  ماژول‌محلی بدون Controller فعال/Repository واقعی،
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` و تست‌های هدفمند همین محدوده است.
- UI فاز A فارسی، RTL، Responsive و هماهنگ با طراحی آبی Rubi است و Loading، Empty،
  Error، Forbidden، Preview، جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی را پوشش می‌دهد.
- Persistence، Prisma، Migration، Seed، Dependency، manifest، Lockfile، قرارداد
  مشترک/root export و داده واقعی مشتری یا PII در فاز A ممنوع است.
- PC-B حق تغییر `packages/database/**`، IAM، Master Data، فایل‌های داخلی Customers
  یا اسناد مرکزی Sprint را ندارد. Backend Persistence فقط پس از Handoff آینده
  Migration مجاز می‌شود.

#### مرز تداخل پس از Merge `CUSTOMER-001` فاز B

- قفل‌های Customer با Merge `7d0a4f4` و این Handoff آزاد می‌شوند؛ PC-B هیچ مالکیتی بر
  Migration، Finance contract یا اسناد مرکزی دریافت نمی‌کند.
- Migration Owner، Finance shared-contract/root export و Central Sprint docs برای
  PC-A/`FINANCE-001` رزرو می‌شوند؛ فعال‌سازی Schema تا عبور از Decision Gate ممنوع است.
- قرارداد اتصال Customer Affairs به Customers/Sales در فاز A فقط proposal داخل
  ماژول و سند Task است؛ انتشار Contract مشترک یا Persistence به Handoff صریح بعدی
  نیاز دارد.

## انتقال اتمیک قفل FINANCE-001 → LEGAL-ENTITY-CONTEXT-001

دلیل انتقال: `FINANCE-001 merged via PR #21 and no active FINANCE-002 task exists`.
ممیزی `origin/develop`، Git history، همه PRهای باز و بسته Finance، Remote Refها و اسناد
مرکزی نشان داد PR #21 با Merge `45c107e` ادغام شده و هیچ FINANCE-002، Branch یا PR فعال
Finance Persistence و هیچ مالک جدیدی برای قفل‌ها وجود ندارد.

### قفل‌های آزادشده از PC-A/FINANCE-001

- Migration Owner: `RELEASED`
- Dependency/Lockfile Owner: `RELEASED`؛ FINANCE-001 هیچ Dependency یا Lockfile تغییر نداد
- Central Sprint status docs: `RELEASED`

Finance shared-contract در `packages/contracts/src/finance/**` مرز دامنه Finance باقی
می‌ماند و به Task Legal Entity منتقل نمی‌شود.

### قفل‌های آزادشده PC-A/LEGAL-ENTITY-CONTEXT-001

مبنای آزادسازی: `DONE/MERGED via PR #24` با Source HEAD
`6f475c03eebc6379fc8be47a48eb0751d58f2d89` و Merge Commit
`b6da5d6300716a189958bc37d31ca195f0304dc5` در `origin/develop`.

- Migration Owner: `RELEASED`
- Legal Entity shared-contract/root export: `RELEASED`
- Central status/docs: `RELEASED`
- Dependency/Lockfile Owner: همچنان `RELEASED`

### قفل‌های فعال PC-B/MASTER-003

| قفل                                     | مالک/Task       | محدوده                                                                                   | وضعیت/شرط آزادسازی                                       |
| --------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Migration Owner                         | PC-B/MASTER-003 | `packages/database/prisma/schema.prisma`، Migration و Seed افزایشی Master Data           | `ACTIVE` تا Merge و Handoff                              |
| Master Data shared-contract/root export | PC-B/MASTER-003 | `packages/contracts/src/master-data/**` و export لازم                                    | `ACTIVE` تا Merge و Handoff                              |
| Central status/docs                     | PC-B/MASTER-003 | `WORK_ASSIGNMENTS.md`، `PLANS.md`، `docs/PROJECT_STATUS.md` و `docs/tasks/MASTER-003.md` | `ACTIVE` تا Merge و Handoff                              |
| Dependency/Lockfile Owner               | PC-B/MASTER-003 | `fflate@0.8.3` در `apps/api/package.json` و `pnpm-lock.yaml`                             | `RELEASED` پس از Pin، Security Review و آزمون فایل واقعی |

#### زیرواحد Stacked `MASTER-003B-GEO`

- Branch مستقل `codex/pc-b-master-data-next` از
  `origin/codex/pc-b-master-data-advanced@f0d3b8c411d6e665147958e67193ac52c6ad4397`
  ساخته شده و Parent Branch نباید از این Task تغییر یا Push شود.
- محدوده انحصاری این Slice شامل مدل، Migration افزایشی، Repository/API/Contract،
  Permission/Audit، UI فارسی RTL و تست‌های Country، Province/Region، City، Airport و
  Terminal است؛ هیچ فایل Customers در این Task تغییر نمی‌کند.
- سه قفل فعال Migration، Master Data shared-contract/root export و Central docs همان
  قفل‌های `PC-B/MASTER-003` هستند و قفل جدید یا موازی ایجاد نمی‌شود؛ Dependency/Lockfile
  آزاد می‌ماند و این Slice مجاز به تغییر manifest یا lockfile نیست.
- PR این Slice باید Draft و با Base `codex/pc-b-master-data-advanced` باشد، وابستگی به
  PR #25 را صریح ثبت کند و پیش از Merge والد ادغام نشود.

#### زیرواحد `MASTER-003C-FINANCIAL`

- Branch مستقل `codex/pc-b-master-data-financial` از
  `origin/codex/pc-b-master-data-next@e0e3a5f` ساخته شده و Base PR آن باید همان
  Branch جغرافیا باشد؛ Draft PR #29 ایجاد شد و Parentهای #28 و #25 پیش از آن Merge
  می‌شوند.
- این Slice زیرمجموعه «اطلاعات پایه / مالی و پولی» است و در مسیر
  `/master-data/finance` ارائه می‌شود؛ ماژول مستقل Finance یا مسیر `/finance` نیست.
- محدوده مالکیت Master Data شامل تعریف ارز، تاریخچه نرخ دستی non-authoritative،
  Maker/Checker، بانک، شعبه بانک و روش پرداخت مرجع است. حساب، شبا، کارت، CVV، مانده،
  تسویه، تراکنش و تنظیم واقعی درگاه در مالکیت Finance باقی می‌مانند.
- Migration، Contract، Backend، UI RTL، Test و Documentation این Slice زیر همان سه
  قفل فعال `PC-B/MASTER-003` انجام می‌شود؛ Dependency/Lockfile آزاد و بدون تغییر است.
- هیچ نرخ واقعی یا ساختگی، بانک، شعبه یا روش پرداخت عملیاتی در Seed اضافه نمی‌شود؛
  Seed فقط ارزهای استاندارد موجود را با نام انگلیسی و سیاست نمایش تکمیل می‌کند.

### رزرو موازی PC-A/CUSTOMER-002A

- Task با عنوان `CUSTOMER-002A — Customer Operations Enhancement` و وضعیت
  `PLANNED/RESERVED` برای PC-A رزرو است و باید از آخرین `origin/develop` آغاز شود.
- محدوده مجاز فقط `apps/web/src/modules/customers/**`، صفحات مرتبط با `/customers`،
  `apps/api/src/customers/**` با Schema فعلی، تست‌های اختصاصی Customers و
  `docs/tasks/CUSTOMER-002A.md` است.
- تغییر Prisma Schema یا Migration، Dependency یا Lockfile، Master Data، Legal Entity و
  فایل‌های مرکزی قفل‌شده توسط MASTER-003 ممنوع است.
- تغییر Customer shared-contract یا root export بدون هماهنگی و ثبت مجدد Handoff مجاز
  نیست.
- Migration Lock، Master Data shared-contract/root export و Central Sprint docs همچنان
  در مالکیت PC-B/MASTER-003 باقی می‌مانند. وضعیت Dependency/Lockfile نیز همان وضعیت
  ثبت‌شده در PR #25 است و این رزرو آن را تغییر نمی‌دهد.

محدوده اجرایی MASTER-003 شامل `apps/api/src/master-data/**`،
`apps/web/src/modules/master-data/**`، route `/master-data`، قرارداد عمومی Master Data،
Schema/Migration افزایشی و تست‌های همان قابلیت است. فایل‌های داخلی IAM، Legal Entities،
Customers، Finance، Procurement، Reservations، Integrations و Documents خارج از مالکیت
این Task می‌مانند و فقط از Public Contract یا Port نسخه‌دار مصرف می‌شوند.

### قفل فعال PC-B/CALENDAR-001

- محدوده: `apps/web/src/components/ui/date-picker*`، export همان UI و جایگزینی
  ورودی‌های `date`/`datetime-local` در ماژول‌های Web.
- تغییر Dependency/Lockfile، API، Database، Contract و Migration مجاز نیست.
- مقدار ذخیره‌شده همچنان ISO Gregorian باقی می‌ماند؛ سوییچ شمسی/میلادی فقط لایه
  نمایش و انتخاب تاریخ است.

## قفل‌های آزادشده Sprint دوم

| قفل                             | مالک پیشین                | مبنای آزادسازی                                         |
| ------------------------------- | ------------------------- | ------------------------------------------------------ |
| IAM shared-contract             | PC-A/IAM-002              | Merge `d1f1133`، تست Contract/Seed و Handoff عمومی     |
| Central Sprint planning docs    | PC-A/SPRINT2-PLANNING-001 | Merge `9efb37c` برنامه Sprint دوم                      |
| Migration Owner                 | PC-B/MASTER-002           | Merge `ddfebb3` و Handoff مستقل به CUSTOMER-001        |
| Dependency/Lockfile Owner       | PC-B/MASTER-002           | Merge `ddfebb3` و تثبیت dependency/lockfile            |
| Master shared-contract/export   | PC-B/MASTER-002           | Merge `ddfebb3` و تحویل قرارداد عمومی Master Data      |
| Central Sprint status docs      | PC-B/MASTER-002           | Merge `ddfebb3` و Handoff اسناد مرکزی به PC-A          |
| Migration Owner                 | PC-A/CUSTOMER-001 Phase B | Merge PR #19 با Commit `7d0a4f4` و migration gate موفق |
| Dependency/Lockfile Owner       | PC-A/CUSTOMER-001 Phase B | Merge PR #19 بدون تغییر dependency/lockfile            |
| Customer shared-contract/export | PC-A/CUSTOMER-001 Phase B | `customers.v2`، contract tests و Merge PR #19          |
| Central Sprint status docs      | PC-A/CUSTOMER-001 Phase B | Merge PR #19 و Handoff مستقل به FINANCE-001            |

## قرارداد مالکیت

- یک فایل یا Migration هم‌زمان فقط یک مالک فعال دارد.
- تغییر محدود و ناگزیر در فایل مشترک باید در توضیح ردیف و Commit اعلام شود.
- وضعیت `DONE` یعنی Commit و Push شده و گزارش تست/ریسک در Project Status ثبت شده
  است؛ ادغام‌شدن را تضمین نمی‌کند.
- آزادکردن کار بدون تکمیل با تغییر مالک به `تخصیص‌نیافته` و ثبت دلیل انجام می‌شود.
