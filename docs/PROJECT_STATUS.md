# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-25 — اصلاحات Review PR #24 برای LEGAL-ENTITY-CONTEXT-001 تکمیل شد

## خلاصه

### `CUSTOMER-002A.1` — PC-A — IMPLEMENTED / STACKED PR PENDING

- Branch فرزند `codex/pc-a-customer-next` از Remote Parent
  `codex/pc-a-customer-operations@5e9503d0b09560ed266aeaaa800d2fe701d1f712` ساخته شد؛ Parent PR #26 و Branch آن تغییر نکردند.
- فیلترهای مدل فعلی، Status History، Customers-only Activity Timeline، Audit API حداقلی، Privacy UX و Deep Link امن Customer 360 تکمیل شدند.
- قرارداد `customers.v2` به‌صورت additive/backward-compatible باقی ماند و هیچ فایل Customer Affairs یا Master Data تغییر نکرد.
- Migration Lock نزد `PC-B/MASTER-003` باقی ماند؛ Prisma/Migration/Seed/Dependency/Lockfile بدون تغییر هستند.
- ۵۲ تست API Customers، ۱۴ تست Web Customers، ۱۵ تست Contract و ۲۶۹ تست کامل پاس شدند؛ lint، typecheck، Production Build و Smoke احراز‌شده `/customers` نیز پاس شدند.
- نام لاتین، جنسیت، note، business code، idempotency persistence، Address Masking کامل، cross-module timeline و Merge واقعی در `BLOCKED_FOR_CUSTOMER_002B` باقی ماندند.

- مرحله جاری: **Issuer Company Context Full-Stack**
- وضعیت: **LEGAL-ENTITY-CONTEXT-001 آماده Review مجدد روی Draft PR #24؛ قفل‌ها فعال‌اند**
- Repository: `Rubi`، Remote با نام `origin`
- Baseline: `origin/develop@0ba85d4604f6eb4d792bee4c3059a32bcf858738` شامل Merge PR #23
- شاخه فعال: `codex/pc-a-legal-entity-context`
- Work Item: `LEGAL-ENTITY-CONTEXT-001`؛ `READY_FOR_REVIEW` (Review fixes from `17ad92703251e6f708fdd3e6c9fc03fd7c31975e`)
- محیط مسئول: `COMPUTER_ID=PC-A`؛ Dev Serverها پیش از تغییر متوقف شدند.
- نوع تغییر: Database، API، Contract، Permission/Audit، App Shell، صفحه مدیریت و تست؛
  Dependency/Lockfile تا اثبات نیاز واقعی آزاد است.

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
### `LEGAL-ENTITY-CONTEXT-001` — PC-A — `READY_FOR_REVIEW`

- Branch از `origin/develop@0ba85d4604f6eb4d792bee4c3059a32bcf858738` ساخته شد؛ Base از Branch قبلی MODULES استفاده نشده است.
- Draft PR #24 از `codex/pc-a-legal-entity-context` به `develop` باز است و Merge نشده است.
- PR #21 و #23 Merge هستند، همه PRهای باز بررسی شدند و هیچ `FINANCE-002`، PR/Branch فعال Finance Persistence یا مالک جدید قفل وجود ندارد.
- مدل افزایشی، Migration، Seed دو شرکت، قرارداد `legal-entities.v2`، هشت Permission، API امن، Branding Snapshot/Issue Metadata/Audit، App Shell و `/system/legal-entities` تکمیل شدند.
- `ALL` مجازی و Permission-based است؛ صدور ترکیبی ممنوع، انتخاب issuer یا دو target مستقل الزامی و سربرگ الزامیِ تکمیل‌نشده در Backend رد می‌شود.
- Prisma و migration/status روی PostgreSQL تازه، Seed دوبار، lint/typecheck/test/build کل Monorepo و Smoke واقعی Cookie/API/Web پاس شدند؛ ۲۴۵ تست در ۶۶ فایل سبز است.
- UI اتصال Branding به Documents را بدون فایل/URL ساختگی آماده و تا ارائه Public Upload Adapter واقعی غیرفعال نگه می‌دارد؛ لوگوی موجود نیایش حفظ و جهان باستان Placeholder صریح دارد.
- Migration، Contract و اسناد مرکزی تا Merge/Handoff فعال‌اند؛ Dependency/Lockfile آزاد است.
- اصلاحات Review PR #24 روی همان Branch تکمیل شد: concurrency اتمیک، snapshot FK/immutability، trusted policy fail-closed، reissue transaction/reason canonical و authenticated baseline access با تست منفی و Smoke واقعی تثبیت شدند.

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
