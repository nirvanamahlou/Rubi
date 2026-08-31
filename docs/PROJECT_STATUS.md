# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-31 — MASTER-003L-SECTION-CLEANUP پیاده‌سازی و آزموده شد

## خلاصه

- مرحله جاری: **Advanced Master Data Management Full-Stack**
- وضعیت: **MASTER-003L-SECTION-CLEANUP روی شاخه Stacked مستقل آماده Review است**
- Repository: `Rubi`، Remote با نام `origin`
- Baseline: `origin/develop@b6da5d6300716a189958bc37d31ca195f0304dc5` شامل Merge PR #24
- شاخه فعال: `codex/pc-b-master-data-section-cleanup`
- Work Item: `MASTER-003L-SECTION-CLEANUP`؛ Stacked روی Draft PR #38
- محیط مسئول: `COMPUTER_ID=PC-B`؛ Web روی ۳۱۰۰ و API روی ۴۰۰۰ پاسخ می‌دهند.
- نوع تغییر: فقط Frontend، Test و Documentation؛ بدون تغییر داده، API، Migration،
  Customers، Dependency یا Lockfile.

### `MASTER-003L-SECTION-CLEANUP` — PC-B — `READY_FOR_REVIEW`

- شرکت اتوبوس، نوع اتوبوس و CIP از رابط تور و خدمات سفر حذف شدند؛ چهار تب لیدرها،
  نوع تور، نوع ترانسفر و ویزا باقی ماندند. اتوبوس فقط در حمل‌ونقل نمایش داده می‌شود.
- نوع مشتری، منبع سرنخ و نوع کمپین از مراجع فروش حذف شدند؛ نحوه آشنایی، کانال فروش،
  دلیل از دست رفتن و Tag باقی ماندند. متن و شمارنده کارت‌های Hub هماهنگ شدند.
- داده‌ها و قرارداد هر ۴۵ منبع حفظ شده‌اند؛ موارد بدون ورودی ناوبری صریحاً ثبت شده‌اند.
- Web tests: `133/133`، typecheck، lint فایل‌های تغییرکرده و Production Build موفق؛
  خروجی HTML ساخته‌شده دقیقاً چهار تب و چهار زیرمجموعه در هر یک از دو بخش دارد.
- Full Web lint فقط همان خطا/هشدار پیشین `date-picker.tsx` را گزارش می‌کند؛ فایل تغییر نکرد.
  مرورگر بدون Session به Login می‌رود؛ Smoke احراز‌شده در این اصلاح ادعا نمی‌شود.
- سه قفل فعال `PC-B/MASTER-003` و وضعیت آزاد Dependency/Lockfile تغییر نکرده‌اند.
- جزئیات: `docs/tasks/MASTER-003L-SECTION-CLEANUP.md`.

### `MODULES-FOUNDATION-001` — PC-A — `READY_FOR_REVIEW`

- ۱۲ Workspace باقی‌مانده با UI مشترک فارسی، RTL، Responsive، KPI، navigation داخلی،
  جست‌وجو، فیلتر، sort، pagination، Preview CRUD، stateها، permission، audit و reference
  بین‌ماژولی تکمیل شد؛ Customers، Customer Affairs، Finance، Master Data و IAM حفظ شدند.
- Dashboard برای صف‌های فروش، رزرواسیون، ظرفیت، مالی و مدیریت تکمیل و Sidebar در برابر
  overflow افقی و محوشدن عنوان سخت‌سازی شد.
- lint، typecheck، test و production build کل Monorepo پاس شدند؛ ۱۷۸ تست Web/API
  و ۲۵ تست package/worker پاس شدند. هر ۱۷ route در HTTP smoke پاسخ 200 و HTML معتبر داد.
- QA مرورگر داخلی به‌علت خروج ناگهانی trusted browser process ممکن نشد؛ build و HTTP
  smoke مطابق قرارداد Task جایگزین شدند.
- Prisma/Migration/Seed، Dependency/Lockfile، Persistence، Secret/PII و artifact جعلی
  تغییری نکردند؛ اتصال واقعی Provider/Worker/Documents/Reporting همچنان Deferred است.

### `MASTER-002` — PC-B — `DONE`

- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a` وارد
  `origin/develop` شد.
- Persistence، REST، قرارداد عمومی و UI واقعی Master Data تحویل شدند.
- چهار قفل Migration، Dependency/Lockfile، Master shared-contract و اسناد مرکزی آزاد شدند.

### `CUSTOMER-001` — PC-A — `DONE/MERGED`

- PR شماره ۱۹ با Source HEAD `19cb597cd9c4137021bc53e3f85d4cd682de51de` و
  Merge Commit `7d0a4f42e978b468263efdc83f780fa656fbd613` وارد `develop` شد.
- فاز A با PR شماره ۱۶ و Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  به‌صورت `DONE/MERGED` وارد `origin/develop` شد.
- فاز B از baseline قطعی `9b96f6eabfe8aed8fe3377fd221fed43dd79d2eb` روی شاخه
  `codex/pc-a-customer-persistence` تکمیل شد؛ اصلاحات Review در Commitهای `c85de3d`،
  `004b9cb` و `6e6df8c` روی همان Draft PR شماره ۱۹ قرار دارند.
- Migration اصلی `20260824093000_customer_persistence` byte-for-byte دست‌نخورده ماند؛
  Migration افزایشی `20260824113000_customer_contact_encryption_hardening` ستون‌ها،
  constraintها و indexهای رمزنگاری Contact را بدون عملیات مخرب اضافه کرد.
- Contact با AES-256-GCM و کلید نسخه‌دار ذخیره می‌شود؛ fingerprint از HMAC-SHA-256 با
  کلید مستقل ساخته می‌شود. reveal فقط با `customers.sensitive.read` و Audit مستقل است.
- Auditهای Customer/Contact/Address/Consent/Companion/Duplicate فقط snapshot allowlist دارند؛
  duplicate query نیز branch-scoped، index-backed و محدود به ۵۰ کاندید است.
- قرارداد عمومی به `customers.v2` ارتقا یافت. migration deploy/status، Seed دوگانه، lint،
  typecheck، build و ۱۲۰ تست Monorepo پاس شدند؛ Dependency/Lockfile تغییری نکرد.
- سه تنظیم blank-only در `.env.example`، `apps/api/.env.example` و validation رزرو و ثبت شدند:
  `CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64`، `CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64` و
  `CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION`. Fixtureها کاملاً ساختگی هستند.
- `DEC-OPEN-006` و `DEC-OPEN-011` باز می‌مانند. نگهداری مدرک حساس، auto-merge و
  merge واقعی ممنوع‌اند؛ فقط Candidate Detection و Review دستی ثبت و Audit می‌شوند.
- نرخ ارز authoritative و تولید واقعی Excel/PDF خارج از این Handoff باقی می‌مانند.
### `CUSTOMER001-FINANCE-HANDOFF-001` — PC-A — `DONE`

- PR شماره ۲۰ با Merge Commit `11fc875` وارد `origin/develop` شد.
- چهار قفل Migration، Dependency/Lockfile، Customer shared-contract/export و اسناد مرکزی
  پس از Merge PR #19 از CUSTOMER-001 آزاد می‌شوند.
- Migration Owner، Dependency/Lockfile Owner مشروط، Finance shared-contract/export و اسناد
  مرکزی برای PC-A/FINANCE-001 رزرو می‌شوند؛ هیچ قفلی به PC-B منتقل نشده است.
- `FINANCE-001` با Foundation و حل تصمیم‌ها آغاز می‌شود. `DEC-OPEN-001/004/005/016`
  Gate قطعی هر Schema، Migration، posting model، FX/tax و approval workflow هستند.
- Finance فقط قرارداد عمومی ماژول‌های دیگر را مصرف می‌کند؛ query مستقیم جدول‌های Customers،
  Sales، Reservations، Procurement یا HR ممنوع است.
- این Handoff فقط مستندات است و هیچ dependency، lockfile، Schema یا Migration تغییر نمی‌دهد.


### FINANCE-001 — PC-A — DONE/MERGED

- PR شماره ۲۱ با Merge Commit `45c107e471d53d1c724303de02ba01a5e0e16b2a` وارد `origin/develop` شد.
- هیچ `FINANCE-002`، PR باز Finance یا Branch فعال Finance Persistence وجود ندارد.
- Migration، Dependency/Lockfile و اسناد مرکزی stale آن آزاد شدند؛ Dependency/Lockfile
  تخصیص‌نیافته ماند و Migration/اسناد مرکزی به `LEGAL-ENTITY-CONTEXT-001` منتقل شدند.
- مالک محصول و کسب‌وکار در 2026-08-24 هر چهار Decision مالی `DEC-OPEN-001/004/005/016`
  را رسماً پذیرفت؛ این موارد دیگر تصمیم باز نیستند.
- پذیرش Decisionها Scope Phase A را توسعه نمی‌دهد: Prisma Schema، Migration، Repository،
  Persistence، Dependency و Lockfile همچنان در این PR بدون تغییر می‌مانند.
- پس از Merge PR #21، ایجاد Schema و Migration افزایشی مالی فقط در Task مستقل Phase B،
  با رزرو مجدد قفل‌ها و اجرای Migration gate کامل، مجاز خواهد بود.
- قرارداد عمومی finance.v1-proposal، producer/consumer eventهای versioned، Permission
  Matrix و Domain/Application Port بدون Controller یا Persistence تکمیل شدند.
- Money/Decimal، rounding، Journal balance، Check lifecycle، Maker/Checker، Release policy،
  optimistic concurrency و idempotency با تست پوشش داده شدند.
- مسیر /finance اکنون Workspace فارسی/RTL/Responsive با Dashboard، ۳۰ قابلیت قابل جست‌وجو،
  فیلتر، sort، pagination، فرم‌های Preview، stateهای کامل و route خروجی Excel/PDF است.
- lint، typecheck و build کل Monorepo پاس شدند؛ ۱۷۲ تست در ۵۱ فایل پاس شد و /finance در
  Production Build تولید شد.
- Dependency/Lockfile، Prisma، Migration و Seed تغییر نکردند. داده‌ها فقط synthetic هستند.
- QA مرورگر داخلی به‌دلیل خطای ACL ابزار Windows و redirect احراز هویت انجام نشد؛ HTTP
  redirect و Production Build route تایید شدند و dev server موقت متوقف شد.
### `LEGAL-ENTITY-CONTEXT-001` — PC-A — `DONE/MERGED`

- PR #24 با Source HEAD `6f475c03eebc6379fc8be47a48eb0751d58f2d89` و Merge Commit
  `b6da5d6300716a189958bc37d31ca195f0304dc5` وارد `origin/develop` شد.
- Migration، Legal Entity shared-contract/root export و اسناد مرکزی با دلیل
  `DONE/MERGED via PR #24` آزاد شدند؛ Dependency/Lockfile از قبل آزاد بود.

### `MASTER-003` — PC-B — `IN_PROGRESS`

- Branch مستقیماً از `origin/develop@b6da5d6` ساخته شد و Frozen Install بدون تغییر Lockfile پاس شد.
- Migration Owner، Master Data shared-contract/root export و اسناد مرکزی برای MASTER-003 رزرو شدند.
- `fflate@0.8.3` پس از اثبات نیاز، Pin و با فایل واقعی بدروم آزموده شد؛ قفل Dependency/Lockfile سپس آزاد شد.
- Import واقعی هتل با قالب `HOTEL_IMPORT_V1`، Preview Token، Idempotency، Commit اتمیک،
  کاتالوگ Meal/Room/Facility و UI متصل پیاده‌سازی شد.
- فایل واقعی `hotel-data-بدروم.xlsx` روی PostgreSQL 18.1 با نتیجه ۲۲ ایجاد، صفر خطا
  و صفر تکراری آزموده شد؛ دیتابیس موقت پس از آزمون حذف شد.
- Review رسمی PR #25 روی همان Draft/Branch اعمال شد: اعتبارسنجی runtime DTO، رد کامل
  External Relationship/Data در OOXML و منع update/status عمومی نرخ ارز سخت‌سازی شدند.
- پذیرش production-like و session واقعی: Preview فایل ۲۲ ردیفی، Commit اول ۲۲ ایجاد،
  فایل دوم ۲۲ Skip، rollback اتمیک، تعارض هم‌زمان ۲۰۱/۴۰۹ و `/master-data` با پاسخ ۲۰۰.
- ورود دستی کد یکتا از تمام فرم‌های اطلاعات پایه حذف شد؛ Backend کد داخلی یکتا را
  از نام رکورد تولید می‌کند و ویرایش آن ممنوع است. در Import هتل نیز شناسه خالی
  به‌صورت خودکار تولید می‌شود و فایل‌های قدیمی دارای شناسه سازگار باقی مانده‌اند.
- توضیح فرعی PageHeader و Alert فنی Persistence از بالای صفحه اطلاعات پایه حذف شدند
  تا کاربر مستقیماً کاتالوگ بخش‌ها را ببیند.
- فرم‌های Create/View/Edit اطلاعات پایه از Drawer کناری به Dialog وسط صفحه منتقل شدند؛
  فیلد و selector سازمان هتل نیز از فرم هتل حذف شد.
- خروجی واقعی XLSX برای همه منابع اطلاعات پایه با فیلتر و مرتب‌سازی جاری، چیدمان RTL،
  سقف ۱۰٬۰۰۰ ردیف، کنترل مجوز و Audit فعال شد؛ PDF آرشیوی همچنان منتظر Documents/Worker است.
- Scanner مستقل آنتی‌ویروس و Documents برای تصاویر هنوز متصل نیستند و وضعیت آن‌ها
  صریحاً `UNAVAILABLE`/در انتظار گزارش می‌شود.
- Scope توسعه افزایشی MASTER-002 شامل Master Data مشترک دو شرکت، نرخ مرجع غیر authoritative،
  کاتالوگ‌های پیشرفته، Import امن Excel، UI واقعی و تست کامل است.
### `MASTER-003B-GEO` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-next` دقیقاً از Remote Parent
  `origin/codex/pc-b-master-data-advanced@f0d3b8c4` ساخته شد و Parent Branch
- Draft PR #28 با Base `codex/pc-b-master-data-advanced` ایجاد شد و تا Merge
  PR #25 نباید ادغام شود؛ سپس Base آن به `develop` تغییر می‌کند.
  دست‌نخورده ماند.
- Migration افزایشی `20260827090000_master_data_geography` مدل‌های Region، Airport
  و Terminal و توسعهٔ غیرمخرب City را اضافه می‌کند؛ ISO/IATA/ICAO، مختصات،
  same-country hierarchy و delete restrict در PostgreSQL enforce می‌شوند.
- Contract عمومی به `master-data.v5` ارتقا یافت و Backend/Frontend واقعی پنج منبع
  جغرافیا با Search/Filter/Sort/Pagination، Create/View/Edit، Status، Optimistic Lock،
  Audit، Permission و UI فارسی RTL responsive تکمیل شد.
- داده جغرافیا global است؛ هیچ Legal Entity filter یا branch ownership روی رکوردها
  اعمال نمی‌شود و branch فقط در Audit metadata ثبت می‌گردد.
- همه ۱۰ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه، constraint test و smoke
  احراز‌شده login + پنج API + `/master-data` با HTTP 200 پاس شدند؛ دیتابیس موقت
  پس از آزمون حذف شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده است. این Slice زیر
  همان سه قفل فعال `PC-B/MASTER-003` باقی می‌ماند و PR آن باید Draft و stacked روی
  PR #25 باشد.
- full typecheck، ۳۱۶ تست در ۷۷ فایل و production build کل Monorepo پاس شدند؛ lint
  همه فایل‌های Slice نیز پاس است. full lint فقط روی DatePicker بدون تغییر Parent
  متوقف می‌شود و برای حفظ Vertical Slice وارد این PR نشده است.

### `MASTER-003C-FINANCIAL` — PC-B — `READY_FOR_REVIEW`

- «مالی و پولی» زیرمجموعه Master Data در `/master-data/finance` است و شش نمای واقعی
  ارزها، تاریخچه نرخ، گردش تأیید، بانک‌ها، شعب بانک و روش‌های پرداخت مرجع دارد.
- Migration افزایشی `20260829100000_master_data_financial_reference` سیاست نمایش ارز،
  نام انگلیسی/SWIFT بانک، شعبه مستقل و روش پرداخت مرجع را بدون عملیات مخرب اضافه می‌کند.
- نرخ‌ها همچنان تاریخچه مستقل، Decimal مثبت با حداکثر ۱۰ اعشار، Maker/Checker، Audit،
  Optimistic Lock و `isAuthoritative=false` دارند؛ Seed نرخ عمداً خالی است.
- حساب، شبا، کارت، CVV، مانده، تسویه، تراکنش و پیکربندی درگاه وارد Master Data نشده‌اند
  و هیچ Query مستقیمی به جداول Finance وجود ندارد.
- همه ۱۱ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و Constraintهای SWIFT، کد
  شعبه، ترتیب روش پرداخت و خالی‌بودن Seed نرخ با موفقیت آزموده شدند.
- هیچ فایل Customers، manifest یا lockfile تغییر نکرده است؛ آیکن/لوگوی بانک تا قرارداد
  رسمی Documents به‌صورت upload جعلی پیاده‌سازی نشده است.
- Branch `codex/pc-b-master-data-financial` دقیقاً روی
  `origin/codex/pc-b-master-data-next@e0e3a5f` پشته شده است؛ Draft PR #29 با Base همین
  Branch ایجاد شد و قبل از Merge والدهای #28 و #25 نباید ادغام یا به `develop` منتقل شود.

### `MASTER-003D-UI-POLISH` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-ui-polish` از
  `origin/codex/pc-b-master-data-financial@e7e6180` ساخته شد و PR مالی #29 را تغییر
  نمی‌دهد.
- Draft PR #30 با Base همان Branch مالی ایجاد شد و تا Merge والدهای #29، #28 و #25
  نباید ادغام شود.
- کارت KPI مشترک با شش رنگ پاستلی، آیکن معنایی، Dark Mode و چینش Responsive به همه
  Workspaceهای اطلاعات پایه اضافه شد.
- KPIهای شش نمای مالی و پنج نمای جغرافیا دقیقاً با نام‌های ماکاپ نمایش داده می‌شوند؛
  مقادیر فاقد قرارداد واقعی Finance/Aggregate با `—` مشخص‌اند و عدد ساختگی ندارند.
- جغرافیا اکنون پنج تب کشور، استان/ناحیه، شهر، فرودگاه و ترمینال، فیلترهای رابطه‌ای،
  جدول تخصصی، قاعده یکپارچگی، عملیات واقعی و Export دارد.
- خط رنگی پایین کارت‌های Hub در Hover حذف شد؛ حرکت و Focus Ring دسترس‌پذیر حفظ شدند.
- تست کامل Repository برابر ۳۳۵ تست، Typecheck کل Monorepo و Production Build موفق
  است. Lint فایل‌های تغییرکرده موفق است؛ Full Web Lint فقط روی ایراد قدیمی و دست‌نخورده
  `apps/web/src/components/ui/date-picker.tsx` متوقف می‌شود.
- Database، Migration، Backend، Contract، Customers، Dependency و Lockfile در این
  Slice تغییر نکردند.

### `MASTER-003E-SUPPLIERS` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-suppliers` از
  `origin/codex/pc-b-master-data-ui-polish@920328e` ساخته شد و PR والد #30 را تغییر
  نمی‌دهد.
- Draft PR #31 با Base همان Branch والد ساخته شد و پیش از Merge زنجیره
  #30 ← #29 ← #28 ← #25 نباید ادغام شود.
- شش نمای دقیق تأمین‌کنندگان، پروفایل تأمین‌کننده، کارگزاران، پروفایل کارگزار،
  اطلاعات تماس و وضعیت همکاری در `/master-data/organizations-suppliers` پیاده‌سازی شدند.
- Migration افزایشی `20260829133000_master_data_suppliers` پروفایل Supplier، خدمات
  رابطه‌ای Supplier/Broker و مخاطبان چندگانه را با FK محدودکننده اضافه می‌کند.
- Contactهای سازمانی فقط رمز‌شده/Mask/Fingerprint ذخیره می‌شوند؛ Unmask مجوز مستقل،
  Audit و Mask مجدد خودکار دارد و plaintext وارد List، Excel یا Audit نمی‌شود.
- KPIها با نام و آیکن ماکاپ از Summary واقعی Backend تغذیه می‌شوند؛ تعداد قرارداد که
  متعلق به Procurement است بدون جعل قرارداد با `—` نمایش داده می‌شود.
- همه ۱۲ Migration روی PostgreSQL 18 خالی، Seed دوگانه و رد زنده داده Contact نامعتبر
  موفق بودند؛ Seed هیچ Supplier، Contact، Contract یا Provider ساختگی اضافه نمی‌کند.
- Lint، Typecheck، Production Build و همه `349/349` تست Repository موفق هستند و مسیر
  `/master-data/organizations-suppliers` در خروجی SSG ساخته می‌شود.
- هیچ Query مستقیمی به Procurement، Finance یا Integrations و هیچ تغییری در Customers،
  dependency manifest یا lockfile وجود ندارد.

### `MASTER-003F-ACCOMMODATION` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-accommodation` از
  `origin/codex/pc-b-master-data-suppliers@02d4101` ساخته شد و PR والد #31 را تغییر
  نمی‌دهد.
- Draft PR #32 با Base `codex/pc-b-master-data-suppliers` ایجاد شد و پیش از Merge
  زنجیره #31 ← #30 ← #29 ← #28 ← #25 نباید ادغام شود.
- هفت نمای کاتالوگ اقامت شامل هتل‌ها، زنجیره، نوع اتاق، وعده/سرویس، امکانات، ورود
  گروهی Excel و هتل ترکیبی در `/master-data/accommodation` به Backend واقعی متصل
  هستند؛ پروفایل هتل طبق MASTER-003G از فهرست در Popup باز می‌شود.
- Migration افزایشی `20260829150000_master_data_accommodation` زنجیره هتل، روابط
  چندبه‌چند Meal/Room/Facility و هتل ترکیبی/اعضا را اضافه و مشخصات هتل را با وب‌سایت،
  زمان ورود/خروج، مختصات و لوگوی مرجع توسعه می‌دهد.
- Check Constraintهای زمان، جفت و بازه مختصات، ترتیب نمایش و اولویت عضو و همه FKهای
  جدید با `ON DELETE RESTRICT` در PostgreSQL اعمال می‌شوند؛ Migration دادهٔ قدیمی
  Meal/Room را بدون حذف به روابط جدید backfill می‌کند.
- Contract عمومی `master-data.v8` شامل ۲۵ منبع و Summary واقعی اقامت است. KPIهای
  هر شش کاتالوگ دقیقاً با نام و آیکن ماکاپ از Aggregate واقعی Backend تغذیه می‌شوند.
- قرارداد، نرخ خرید، موجودی، Voucher و تخصیص مسافر جعل نشده‌اند؛ این داده‌ها در
  Procurement/Reservations باقی می‌مانند و مرجع Documents تا قرارداد رسمی با `—`
  یا وضعیت در انتظار نمایش داده می‌شود.
- همه ۱۳ Migration روی PostgreSQL 18.1 خالی، Seed دوگانه و Constraintهای زنده زمان،
  مختصات، ترتیب و اولویت موفق‌اند؛ Seed هیچ Hotel/Chain/Composite یا قرارداد ساختگی
  اضافه نمی‌کند.
- Frozen install، Prisma format/validate/generate، Lint فایل‌های Slice، Typecheck و
  Production Build و هر `366/366` تست Repository موفق‌اند. Full Web Lint فقط روی
  ایراد قدیمی و خارج از Slice در
  `apps/web/src/components/ui/date-picker.tsx` متوقف می‌شود.
- هیچ فایل Customers، dependency manifest یا lockfile و هیچ جدول عملیاتی ماژول دیگر
  تغییر نکرده است.

### `MASTER-003G-UX-CONSOLIDATION` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-ux-consolidation` از HEAD تأییدشده PR #32
  ساخته شد و شاخه‌های والد یا PC-A را تغییر نمی‌دهد.
- Draft PR #33 با Base `codex/pc-b-master-data-accommodation` ایجاد شد و پیش از PR
  #32 یا سایر والدهای پشته Merge نمی‌شود.
- تاریخچه و نمودار نرخ داخل Popup جزئیات ارز قرار گرفت و با انتخاب ارز، جفت/نوع نرخ
  و بازه زمانی از Backend واقعی خوانده می‌شود؛ تب مستقل تاریخچه حذف شد.
- شهر و استان/ناحیه در یک تب بالادستی تجمیع شدند و نوع رکورد در همان صفحه انتخاب
  می‌شود؛ Schema و FKهای مستقل بدون تغییر باقی ماندند.
- پروفایل هتل، تأمین‌کننده و کارگزار با کلیک نام/مشاهده در Dialog مشترک باز می‌شود؛
  تب‌های پروفایل و نمای مستقل اطلاعات تماس از رابط حذف شدند.
- برچسب `MASTER-003 · PC-B` از Header صفحه اصلی حذف و شمارنده‌های Hub با نماهای
  قابل مشاهده هماهنگ شدند.
- ESLint تمام فایل‌های Slice، Typecheck و Production Build موفق‌اند؛ هر `366/366`
  تست Repository پاس شد. API Health پاسخ ۲۰۰ و Routeهای محافظت‌شده پاسخ ۳۰۷ به Login
  می‌دهند.
- Full Web Lint فقط به‌علت خطای قدیمی `react-hooks/set-state-in-effect` و هشدار
  `aria-required` در `apps/web/src/components/ui/date-picker.tsx` خارج از این Slice
  متوقف می‌شود.
- هیچ فایل Customers، Prisma/Migration/Seed، API/Contract، Dependency/Lockfile،
  Secret یا PII تغییر نکرده است.

### `MASTER-003H-TRANSPORT` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-transport` از
  `origin/codex/pc-b-master-data-ux-consolidation@70d97ea` ساخته شد و هیچ شاخه والد
  یا متعلق به PC-A را تغییر نمی‌دهد.
- Draft PR #35 با Base `codex/pc-b-master-data-ux-consolidation` ساخته شد و پیش از
  Merge PR #33 نباید ادغام شود؛ پس از Merge والد Base آن به `develop` تغییر می‌کند.
- Migration افزایشی `20260829170000_master_data_transport` مشخصات دوزبانه ایرلاین،
  نوع هواپیما، کلاس پروازی، قاعده بار، قالب Manifest، شرکت/نوع قطار و شرکت/نوع
  اتوبوس را با FK محدودکننده، Optimistic Lock و Constraintهای واقعی اضافه می‌کند.
- Contract عمومی به `master-data.v9` ارتقا یافت و هر ۹ منبع حمل‌ونقل به Backend واقعی
  Search/Sort/Pagination، Create/Edit، Active/Inactive، Audit، Permission و Export
  متصل شدند.
- Workspace فارسی RTL Responsive مطابق ماکاپ ۹ تب و KPIهای پاستلی هم‌نام دارد؛ تب
  مستقل پروفایل ایرلاین وجود ندارد و پروفایل همه ردیف‌ها از نام یا دکمه مشاهده در
  Popup باز می‌شود.
- Credential/Secret اتصال Provider، موجودی/قیمت/رزرو، قرارداد/تسویه و Manifest مسافر
  وارد Master Data نشده‌اند؛ Connection یا Documents فاقد قرارداد با `—`/وضعیت
  در انتظار نمایش داده می‌شود و Seed حمل‌ونقل عمداً خالی است.
- تمام ۱۴ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migration روی
  دیتابیس محلی Deploy و Seed دو بار بدون ایجاد داده ساختگی اجرا شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده و سه قفل فعال
  Migration/Contract/Docs همچنان زیر `PC-B/MASTER-003` باقی می‌مانند.

### `MASTER-003I-SALES-REFERENCES` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-sales-references` از
  `origin/codex/pc-b-master-data-transport@1049928` ساخته شد و روی Draft PR #35 پشته
  می‌شود؛ هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Draft PR #36 با Base `codex/pc-b-master-data-transport` ساخته شد و پیش از Merge
  PR #35 و تمام والدهای آن نباید ادغام شود؛ پس از Merge والد، Base مطابق زنجیره به
  `develop` تغییر می‌کند.
- Migration افزایشی `20260829190000_master_data_sales_references` شش کاتالوگ جدید
  Lead Source، Sales Channel، Lost Reason، Customer Type، Tag و Campaign Type را
  اضافه و کاتالوگ موجود Acquaintance Method را با نام انگلیسی و ترتیب نمایش تکمیل
  می‌کند؛ Check واقعی ترتیب نامنفی و رنگ Hex Tag و Unique Code فعال است.
- Contract عمومی به `master-data.v10` ارتقا یافت و هر هفت مرجع به Backend واقعی
  Search/Sort/Pagination، Create/Edit، Active/Inactive، Optimistic Lock، Audit،
  Permission و Export متصل شدند.
- Workspace فارسی RTL Responsive مطابق ماکاپ هفت تب و چهار KPI پاستلی هم‌نام دارد.
  هیچ تب پروفایل مستقلی وجود ندارد و جزئیات هر ردیف از نام یا دکمه مشاهده در Popup
  مشترک باز می‌شود.
- شمارنده استفاده به‌دلیل مالکیت آن توسط Consumer Aggregate و ممنوعیت Query مستقیم
  Customers/Sales صادقانه با `—` نمایش داده می‌شود؛ پس از قرارداد عمومی نسخه‌دار قابل
  اتصال است. Seed این Slice عمداً هیچ مرجع ساختگی اضافه نمی‌کند.
- تمام ۱۵ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migration روی
  دیتابیس محلی Deploy و Seed دو بار اجرا شد. هیچ فایل Customers، dependency manifest
  یا lockfile تغییر نکرده و سه قفل MASTER-003 فعال می‌مانند.
- Full Test شامل API `204/204`، Web `120/120`، Database `42/42`، Contracts `14/14`
  و سه تست سایر بسته‌ها موفق بود؛ Full Typecheck و Production Build نیز پاس شدند.
  Smoke احراز‌شده API و `/master-data/sales-references` هر دو پاسخ ۲۰۰ دادند. Lint
  فایل‌های دو Workspace حمل‌ونقل و مراجع فروش موفق است؛ Full lint فقط به‌دلیل ایراد
  قدیمی DatePicker خارج از این Slice متوقف می‌شود.


### `MASTER-003J-INSURANCE` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-insurance` از
  `origin/codex/pc-b-master-data-sales-references@fbc423d` ساخته شد و روی Draft PR
  #36 پشته می‌شود؛ هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Draft PR #37 با Base `codex/pc-b-master-data-sales-references` ساخته شد و پیش از
  Merge PR #36 و تمام والدهای آن نباید ادغام شود؛ پس از Merge والد، Base مطابق
  زنجیره به `develop` تغییر می‌کند.
- دو Migration افزایشی بیمه، Insurer را با Country و نام انگلیسی تکمیل و مدل‌های
  Insurance Plan، Coverage و رابطه چندبه‌چند آنها را با FK محدودکننده، Check مبلغ،
  سن، اعتبار و Version اضافه می‌کنند؛ عملیات مخرب وجود ندارد.
- Contract عمومی به `master-data.v11` و ۴۱ Resource ارتقا یافت. سه کاتالوگ شرکت‌های
  بیمه، طرح‌ها و پوشش‌ها به API واقعی، Permission، Audit، Optimistic Lock، Export،
  Search/Filter/Sort/Pagination و Summary واقعی متصل‌اند.
- Workspace فارسی RTL Responsive مطابق ماکاپ سه تب و KPIهای پاستلی هم‌نام دارد؛
  مشاهده جزئیات فقط Popup است و هیچ صفحه مستقل پروفایل ساخته نشده است.
- Pricing، Policy، Passenger، Reservation، Provider و Documents در مالکیت ماژول‌های
  مربوط باقی مانده‌اند؛ Query مستقیم بین‌ماژولی و Seed عملیاتی/ساختگی اضافه نشده است.
- تمام ۱۷ Migration روی PostgreSQL 18 خالی و Seed دوگانه موفق بود؛ همان Migrationها
  روی دیتابیس محلی Deploy شدند. هیچ فایل Customers، dependency manifest یا lockfile
  تغییر نکرده و سه قفل MASTER-003 فعال می‌مانند.
- Full Test شامل API `211/211`، Web `124/124`، Database `46/46`، Contracts `14/14`
  و سه تست سایر بسته‌ها موفق بود؛ Full Typecheck و Production Build نیز پاس شدند.
  Lint تمام فایل‌های این Slice موفق است؛ Full lint فقط به‌دلیل ایراد قدیمی DatePicker
  خارج از این Slice متوقف می‌شود.

### `MASTER-003K-TRAVEL-SERVICES` — PC-B — `READY_FOR_REVIEW`

- Branch مستقل `codex/pc-b-master-data-travel-services` از
  `origin/codex/pc-b-master-data-insurance@1a94fca` ساخته شد و روی Draft PR #37
  پشته می‌شود؛ Draft PR #38 ایجاد شد و هیچ شاخه والد یا متعلق به PC-A تغییر نمی‌کند.
- Migrationهای افزایشی `20260829220000_master_data_travel_services` و
  `20260829221000_master_data_travel_bus_connections` چهار کاتالوگ Tour
  Type، Transfer Type، CIP Service و Visa Service را اضافه و Leader را با Location،
  نام انگلیسی، مقصد و تماس رمزنگاری/ماسک‌شده تکمیل می‌کند؛ FK محدودکننده و Check
  ظرفیت، اعتبار، ترتیب و Version فعال است. Bus Company دقیقاً به یک Organization
  یا Provider متصل و Facilityهای Bus Type با رابطه M:N نگهداری می‌شوند.
- Contract عمومی به `master-data.v12` و ۴۵ Resource ارتقا یافت. هفت تب ماکاپ به API
  واقعی، Permission، Audit بدون Ciphertext، Optimistic Lock، Export و Summary واقعی
  متصل‌اند؛ شرکت و نوع اتوبوس در سطح Hub به این بخش تخصیص یکتای UI دارند.
- Workspace فارسی RTL Responsive KPIهای پاستلی هم‌نام و ستون‌های دقیق ماکاپ دارد؛
  مشاهده همه جزئیات، به‌ویژه پروفایل لیدر، فقط Popup است و مسیر مستقل ساخته نشده است.
- اسناد/آدرس/بانک/دستمزد لیدر، پرونده و سند مسافر، قیمت، ظرفیت، Reservation، Voucher،
  قرارداد و Settlement وارد Master Data نشده‌اند؛ شمارنده بدون Public Contract با
  `—` نمایش داده می‌شود و Seed این Slice عمداً خالی است.
- تمام ۱۹ Migration روی PostgreSQL 18 خالی، Constraintهای زنده و Seed دوگانه موفق
  بودند؛ همان Migration روی دیتابیس محلی Deploy و Seed دو بار اجرا شد. هیچ فایل
  Customers، dependency manifest یا lockfile تغییر نکرده است.
- Full Test شامل API `218/218`، Web `129/129`، Database `51/51`، Contracts `14/14`
  و سه تست سایر بسته‌ها، در مجموع `415/415` موفق بود؛ Full Typecheck و Production
  Build نیز پاس شدند. Lint فایل‌های Slice موفق است؛ Full lint فقط به‌دلیل ایراد قدیمی
  DatePicker خارج از این Slice متوقف می‌شود.

### `CALENDAR-001` — PC-B — `READY_FOR_REVIEW`

- کامپوننت مشترک DatePicker با تم آبی و سوییچ بالای تقویم برای شمسی/میلادی ایجاد شد.
- همه ورودی‌های خام `date` و `datetime-local` در Customers، Customer Affairs، Finance
  و Master Data با کامپوننت مشترک جایگزین شدند.
- مقدار ارسالی و ذخیره‌شده همچنان ISO Gregorian است و سوییچ فقط نمایش/انتخاب را تغییر می‌دهد.
- انتخاب ساعت برای فیلدهای datetime حفظ شد؛ ناوبری ماه، امروز، تاریخ انتخاب‌شده،
  بستن با Escape و کلیک بیرون و ویژگی‌های دسترس‌پذیری پوشش داده شدند.
- Web Typecheck، Lint و ۸۵ تست پاس شدند و چهار route متاثر روی dev server پاسخ ۲۰۰ دادند.
- Production build به‌دلیل dev server فعال و قفل `.next` هم‌زمان اجرا نشد؛ dev compilation موفق بود.

### `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`

- Branch آینده `codex/pc-b-customer-affairs-foundation` و هدف آن Foundation مستقل
  امور مشتریان برای Lead/پیش‌فروش و پشتیبانی پس از فروش است.
- فاز A فقط Frontend فارسی/RTL/Responsive، Domain/Application design، قراردادهای
  ماژول‌محلی و تست‌های هدفمند را شامل می‌شود.
- محدوده آینده PC-B به ماژول/route `customer-affairs` در Web،
  `apps/api/src/customer-affairs/**` بدون Controller فعال یا Repository واقعی و
  `docs/tasks/CUSTOMER-AFFAIRS-001.md` محدود است.
- درخواست مشتری، Lead source، Qualification، نیاز سفر/بودجه، فعالیت/Follow-up،
  Ticket/SLA/Escalation، شکایت، اصلاح، کنسلی/استرداد و رضایت‌سنجی در Scope طراحی
  قرار دارند؛ اتصال Customers/Sales/Reservation فقط proposal ماژول‌محلی است.
- Persistence، Prisma، Migration، Seed، Dependency/Lockfile، قرارداد مشترک و PII
  واقعی ممنوع‌اند.
- قفل‌های مشترک CUSTOMER-001 با Merge `7d0a4f4` آزاد و برای PC-A/`FINANCE-001`
  رزرو شده‌اند؛ PC-B حق تغییر Database، IAM، Master Data، Customers داخلی، Finance
  contract یا اسناد مرکزی را در Task خودش ندارد.

### `IAM-002` — PC-A — `DONE`

- قرارداد عمومی IAM به نسخه ۲ ارتقا یافت و ۵ Permission برای Master Data و ۶ Permission
  برای Customers منتشر شد؛ ۶ Permission قبلی IAM بدون تغییر حفظ شدند.
- Seed دو بار متوالی روی PostgreSQL 18 موفق بود؛ هر ۱۷ Permission یکتا و به نقش
  `administrator` متصل هستند.
- Prisma validate/generate، lint، typecheck، ۴۳ تست در ۱۹ فایل و build تولیدی کل
  Monorepo پاس شدند.
- Schema، Migration، Dependency و Lockfile تغییر نکردند. PR شماره ۱۱ با Merge Commit
  `d1f1133` ادغام و قفل IAM shared-contract آزاد شد.
- PC-B مجاز است `MASTER-002` را Full-Stack آغاز کند و تنها Migration و
  Dependency/Lockfile Owner باشد. PC-A هم‌زمان فقط فاز A بدون Persistence
  `CUSTOMER-001` را آغاز می‌کند.
- Handoff با PR شماره ۱۲ و Merge Commit `0af31c2` وارد `develop` شد.

## برنامه اجرایی Sprint دوم

### `SPRINT2-PLANNING-001` — PC-A — `DONE`

- سه Task آغاز Sprint شامل `IAM-002`، `MASTER-002` و `CUSTOMER-001` با Branch و مرز فایل
  مستقل ثبت شدند.
- `IAM-002` پیش‌نیاز کوتاه انتشار Permission Code و Seed عمومی برای دو دامنه است و هیچ
  Schema، Migration یا Dependency تغییر نمی‌دهد.
- پس از Handoff IAM-002، `MASTER-002` تنها Migration و Dependency/Lockfile Owner می‌شود.
- `CUSTOMER-001` فاز A بدون Persistence موازی است؛ فاز B فقط پس از Merge Master و Handoff
  صریح قفل Migration مجاز خواهد بود.
- نرخ ارز authoritative با `DEC-OPEN-004`، PII حساس با `DEC-OPEN-006` و auto-merge با
  `DEC-OPEN-011` تا تصمیم محصول/امنیت خارج از Scope قطعی هستند.
- مرجع دقیق: `docs/tasks/SPRINT-2-PLANNING.md`.
- PR شماره ۱۰ با Merge Commit `9efb37c` وارد `develop` شد.
- Scoped Prettier، لینک‌های Markdown، تعادل Fence، Scope/Secret scan و
  `git diff --check` پاس شدند؛ هیچ تست یا Build نرم‌افزاری لازم نبود چون Task فقط مستندات است.

## نتیجه نهایی Sprint اول

|  PR | Work Item     | Merge Commit                               | نتیجه                                             |
| --: | ------------- | ------------------------------------------ | ------------------------------------------------- |
|  #5 | `IAM-001`     | `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` | IAM Full-Stack و قرارداد عمومی ادغام شد           |
|  #6 | `MASTER-001`  | `cda0f9a67589974458a4261b753152a796fa1d0b` | Foundation بدون Persistence اطلاعات پایه ادغام شد |
|  #7 | `ARCH-001`    | `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` | معماری تاییدشده گردش سفر و منوی ۱۷ بخشی ادغام شد  |
|  #8 | `UI-ARCH-001` | `543f6e2b2f55833a2d1ae02440a9495f1510a112` | Frontend معماری و دسترسی عملی IAM ادغام شد        |

- منوی اصلی دقیقاً ۱۷ بخش دارد و «مدیریت سیستم» تنها آیتم اصلی IAM/Settings است.
- صفحه `/system` دسترسی عملی به رابط موجود `/users` و مسیر `/settings` فراهم می‌کند؛
  هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند.
- مرحله Foundation بسته شده است؛ Persistence واقعی Master Data قابلیت تکمیل‌شده محسوب
  نمی‌شود و در `MASTER-002` برنامه‌ریزی خواهد شد.

## برنامه Sprint اول

### `UI-ARCH-001` — PC-A — `DONE`

- Merge Commit: `543f6e2b2f55833a2d1ae02440a9495f1510a112` روی `origin/develop`

- منوی اصلی مطابق معماری ۱۷ بخشی تاییدشده بازچینی شد؛ Customer Affairs قبل/بعد،
  Reservation، Ticket Management، Sales و System Management مرز مستقل و روشن دارند.
- نمای معماری ماژول‌های فروش، رزرواسیون، خرید و مالی همراه زنجیره تحویل اطلاعات ایجاد شد.
- صفحات مستقل امور مشتریان، تعریف بلیت و مدیریت سیستم افزوده شدند؛ مسیر قدیمی خدمات مشتریان
  به Customer Affairs هدایت می‌شود.
- صفحه مدیریت سیستم اکنون ورودی عملی به رابط موجود IAM در `/users` و تنظیمات در
  `/settings` دارد؛ هر دو مسیر زیر «مدیریت سیستم» Resolve می‌شوند و منوی اصلی ۱۷ بخشی
  بدون آیتم مستقل جدید حفظ شده است.
- تغییر فقط در Frontend و اسناد Task است؛ Prisma، Migration، Dependency/Lockfile، IAM و
  فایل‌های `MASTER-001` تغییر نمی‌کنند.
- نصب frozen، ESLint کل Web، Typecheck، نه فایل تست با ۲۶ تست و Production Build پاس شدند.
- خروجی Build شامل ۲۴ Route قابل اجرا است و Smoke احراز‌شده هر ده مسیر اصلی روی پورت ۳۱۰۰
  با HTTP 200 و محتوای مورد انتظار پاس شد؛ `git diff --check` نیز پاس است.

### `ARCH-001` — PC-A — `DONE`

- Merge Commit: `99dd1cff21cff76f0edb101fb8e6033900c8b4a9` روی `origin/develop`
- ساختار ۱۷ بخشی شامل «مدیریت و تعریف بلیت‌ها» و «مدیریت سیستم» ثبت شده است.
- Customer Affairs مالک Lead/Support؛ Sales مالک قرارداد و تخصیص passenger/service؛
  Reservations مالک استعلام/Hold/صدور/Manifest؛ Procurement مالک خرید و Finance مالک
  financial release است.
- رزرواسیون Purchase Request را با قرارداد/service/supplier و قیمت/تخفیف کارگزار ایجاد
  می‌کند؛ Procurement approval/net purchase را مالک و margin از داده approved محاسبه می‌شود.
- مرجع جزئیات: `docs/TRAVEL_WORKFLOW_ARCHITECTURE.md`.
- این Work Item فقط اسناد است و هیچ Schema، Migration، Dependency یا Lockfile تغییر نمی‌دهد.
- Prettier، لینک‌های Markdown، تعادل fenceها، secret/scope scan و `git diff --check` پاس شدند.

### `IAM-001` — PC-A — `DONE`

- Merge Commit: `50eaccaf25b63d2ff584ff928cf05c4ccd4c5eac` روی `origin/develop`
- ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend/Frontend و Audit امنیتی را Full-Stack پوشش می‌دهد.
- PC-A در طول `IAM-001` مالک انحصاری Migration، Dependency/Lockfile و قراردادهای مشترک IAM بود.
- معیار تحویل شامل Database، API، Frontend، تست‌های permission/security و Handoff
  قرارداد عمومی IAM به مصرف‌کنندگان است.
- Migration `20260822120000_iam_foundation` روی PostgreSQL توسعه اعمال شد؛ Seed دو بار
  متوالی بدون duplicate پاس شد و `prisma migrate status` دیتابیس را up-to-date اعلام کرد.
- Migration غیرمخرب `20260822150000_username_login` ورود case-insensitive با نام کاربری
  اختصاص‌یافته مدیر و ایمیل اختیاری را اضافه کرد و روی PostgreSQL لوکال پاس شد.
- Merge انجام شده و قفل‌های Migration، Dependency/Lockfile و IAM shared-contract در
  2026-08-23 با `SPRINT1-HANDOFF-001` رسماً آزاد شدند.

### `MASTER-001` — PC-B — `DONE`

- Branch: `codex/pc-b-master-data-foundation`
- Merge Commit: `cda0f9a67589974458a4261b753152a796fa1d0b` روی `origin/develop`
- Catalog دوازده‌گانه، UI فارسی/RTL responsive، فرم‌های Create/View/Edit، search/filter/
  sort/pagination و Stateهای Loading/Empty/Error/Permission/Preview تکمیل شد.
- Contractهای ماژول‌محلی list/detail/mutation/status و async Excel/PDF همراه validation،
  error envelope، Permission Matrix و ۲۰ تست پاس‌شده در `develop` قرار دارند.
- Prisma schema/Migration/repository، Backend پایدار، mutation واقعی، نرخ ارز authoritative
  و export artifact تکمیل نشده‌اند و در `MASTER-002` برنامه‌ریزی شده‌اند؛ هنوز هیچ قفل
  Migration یا Dependency به آن Task تخصیص ندارد.
- هیچ manifest، lockfile، Prisma، Migration یا فایل IAM تغییر نکرده است.
- Consumer requirementهای IAM در `docs/tasks/MASTER-001.md` ثبت شده‌اند؛ مصرف
  `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` اکنون از قرارداد عمومی
  `@rubi/contracts` انجام می‌شود.

## وضعیت Baseline مشترک

- Technical Bootstrap با Merge Commit `bdb5461` روی `develop` قرار دارد.
- مالکیت Full-Stack ماژول‌ها و Human Resources با Merge Commit `b5b7c5d` ثبت شده است.
- Frontend Foundation و طراحی Dashboard با Merge Commit `c4f8bde` روی `develop` قرار دارد.
- Prisma baseline شامل مدل‌های IAM، branch reference، Session و Audit و دو Migration غیرمخرب
  با Merge Commit `50eacca` وارد `develop` شده است.
- Master Data Foundation بدون persistence با Merge Commit `cda0f9a` وارد `develop` شده است.

## تکمیل‌شده در DOCS-002

- مدل همکاری به Full-Stack برای هر دو PC تغییر کرد؛ تقسیم ثابت Backend/Frontend حذف شد.
- مالکیت نهایی ماژول‌ها و تفکیک Backend/UI گزارش‌ها در `MODULE_OWNERSHIP.md` ثبت شد.
- قفل هم‌زمان Migration Owner، Dependency/Lockfile Owner، فایل مرکزی و API/Event Contract ثبت شد.
- منابع انسانی به منوی اصلی ۱۷ بخشی اضافه و دامنه، مرز، مدل مفهومی، امنیت و گزارش آن مستند شد.
- Employee از Customer/Passenger مستقل و ارتباط HR → Finance به payroll input تاییدشده محدود شد.
- حقوق و دستمزد قانونی و کامل در نسخه اولیه خارج از محدوده باقی ماند.

## تکمیل‌شده در Technical Bootstrap

- pnpm 11 workspace و Turborepo با Node 24، TypeScript strict، ESLint flat config و Prettier
- `apps/web`: Next.js App Router، Tailwind، فارسی/RTL، صفحه اجرا و `/status`
- `apps/api`: NestJS REST، prefix `/api/v1`، Swagger، ValidationPipe، error envelope، request ID،
  CORS قابل تنظیم، logging و graceful shutdown
- endpoint پایه `GET /api/v1/health` با قرارداد مشترک `packages/contracts`
- `apps/worker`: Nest standalone، BullMQ/ioredis، startup Redis health و graceful shutdown
- `packages/database`: Prisma 7، PostgreSQL datasource، Client factory و scriptهای
  format/validate/generate بدون model مصنوعی
- Compose محلی PostgreSQL 18، Redis 8 و MinIO با health check، volume نام‌دار و ساخت bucket
- lockfile pin‌شده و scriptهای root برای dev/build/lint/typecheck/test/database/infrastructure

## وضعیت تاریخی هنگام `DOCS-003`

- در زمان آن Task، قابلیت IAM یا Master Data هنوز پیاده‌سازی نشده و وضعیت هر دو `PLANNED` بود؛
  وضعیت جاری آن‌ها در بخش Sprint اول ثبت شده است.
- خود Commit مستنداتی `DOCS-003` هیچ فایل نرم‌افزاری، Prisma schema، Migration، Seed،
  Dependency یا Lockfile را تغییر نداد.
- Nginx، CI و deployment محیط غیرمحلی هنوز ساخته نشده‌اند.
- تصمیم‌های P0 بازِ `docs/DECISIONS.md` همچنان مانع schema دامنه/مالی و adapter واقعی هستند.

## کنترل کیفیت Technical Bootstrap

- نصب dependency و lockfile supply-chain policy: پاس
- Prisma format، validate و generate روی schema بدون model: پاس
- peer dependency check، ESLint، TypeScript typecheck و Prettier check: پاس
- Vitest: ۷ تست در ۶ suite، همگی پاس
- production build: Web، API، Worker و packageهای buildable پاس؛ routeهای `/` و `/status` static
- Compose config: پاس؛ PostgreSQL/Redis/MinIO healthy و MinIO init با exit 0
- smoke: API health، Swagger JSON، Web status/RTL، MinIO live و Worker→Redis/BullMQ پاس
- `git diff --check` و secret scan در gate نهایی پیش از commit تکرار می‌شوند.

## کنترل کیفیت IAM-001

- Prisma format/validate/generate پاس؛ Migration deploy و status روی PostgreSQL 18 پاس.
- Seed فقط permission، نقش سیستمی و شعبه مرکزی را می‌سازد و اجرای تکراری آن پاس است.
- lint کل Monorepo پاس؛ typecheck کل Monorepo پاس.
- Vitest: ۱۸ تست در ۱۱ suite شامل login HTTP contract، refresh cookie، validation،
  password policy و permission guard همگی پاس.
- Build تولیدی API، Worker، Web و packageهای مشترک پاس؛ `/login` و `/users` در خروجی Web هستند.
- `git diff --check`، بررسی Secret و Markdown links در gate نهایی تکرار می‌شوند.

## Handoff نهایی Sprint اول

1. PR شماره ۵ با Merge Commit `50eacca` وارد `develop` شده و قرارداد عمومی IAM در دسترس است.
2. قرارداد `@rubi/contracts` و جزئیات مصرف در `docs/IAM.md` مبنای PC-B است؛ دسترسی مستقیم
   به جدول‌ها یا repository داخلی IAM ممنوع می‌ماند.
3. PR شماره ۶ با Merge Commit `cda0f9a` وارد `develop` شده است؛ Foundation بدون
   Persistence تکمیل و Persistence واقعی به `MASTER-002` منتقل شده است.
4. PRهای شماره ۷ و ۸ با Merge Commitهای `99dd1cf` و `543f6e2` معماری تاییدشده و
   Frontend منوی ۱۷ بخشی را وارد `develop` کرده‌اند.
5. قفل‌های Migration، Dependency/Lockfile و shared-contract متعلق به `IAM-001` و قفل
   اسناد مرکزی متعلق به `ARCH-001` در 2026-08-23 آزاد شدند.
6. قرارداد عمومی IAM از `@rubi/contracts` مصرف می‌شود؛ `BranchReference`،
   `AuthenticatedActor` و `IamPermissionCode` (از جمله `iam.audit.read`) عمومی‌اند و
   Audit با actor context عمومی ثبت می‌شود. مدل/Repository داخلی IAM یا Audit قابل
   دسترسی مستقیم برای Master Data نیست.
7. آزادشدن قفل‌ها مجوز اجرای هم‌زمان نیست. `MASTER-002` و `CUSTOMER-001` پیش از هر
   تغییر Prisma، Migration یا Dependency باید قفل مستقل رزرو کنند و در هر لحظه فقط یک
   Migration Owner و یک Dependency/Lockfile Owner مجاز است.

## برنامه اولیه Sprint دوم

- `MASTER-002` — PC-B — `DONE`: Merge `ddfebb3`؛ Persistence، REST، قرارداد عمومی،
  UI واقعی و async export request تکمیل و چهار قفل آزاد شدند. نرخ ارز authoritative و
  تولید artifact واقعی Documents/Worker همچنان خارج از Scope است.
- `CUSTOMER-001` — PC-A — `DONE/MERGED`: PR #19 با Merge `7d0a4f4` ادغام و چهار قفل آن در Handoff مستقل آزاد شدند.
- `FINANCE-001` — PC-A — `READY_FOR_REVIEW`: چهار Decision مالی ACCEPTED؛ Phase B مستقل برای Schema/Migration فقط پس از Merge PR #21 مجاز است.
- `CUSTOMER-AFFAIRS-001` — PC-B — `PLANNED`: Phase A مستقل بدون Persistence؛
  فقط Frontend، طراحی دامنه/Application، Contract ماژول‌محلی و تست در مسیرهای
  `customer-affairs`. این Task هیچ قفل مشترکی دریافت نمی‌کند و Backend Persistence
  آن تا Handoff آینده Migration مسدود است.

## ریسک‌ها و تصمیم‌های باز

- دامنه Sub-ledger عملیاتی و مرز integration حسابداری قانونی با DEC-OPEN-001 نهایی شد.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست ارز، rounding، FX و Tax/Recognition با DEC-OPEN-004 پذیرفته شد؛ شماره‌گذاری اسناد همچنان باز است.
- schema و نرخ authoritative فقط در Task مستقل Phase B پس از Merge PR #21 و Migration gate مجاز است.
- ذخیره PII حساس و مدارک هویتی تا تصمیم قطعی retention/رمزنگاری ممنوع می‌ماند.
- اجرای Persistence مالی فقط در Task مستقل Phase B پس از Merge PR #21 و با قفل یگانه Migration/Dependency مجاز است؛ تاریخچه Migration یا داده محلی نباید دستی دست‌کاری شود.
- Compose credentialها synthetic و Local هستند و پیش از هر محیط دیگر باید با secret manager جایگزین شوند.
