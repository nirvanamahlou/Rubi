# MASTER-002 — Master Data Persistence

- وضعیت: `DONE`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-persistence`
- Merge Commit: `ddfebb369de67cb7ff45bd15a06841d3251c945a`
- Base: `f4381b5c842c962652f6fb168b3a6507177393e4`
- Migration Owner: `RELEASED` با Merge `ddfebb3`
- Dependency/Lockfile Owner: `RELEASED` با Merge `ddfebb3`
- Shared Contract Owner: `RELEASED` با Merge `ddfebb3`
- Central Sprint status docs: `RELEASED` با Merge `ddfebb3`

## محدوده

Persistence، Repository، Application Service، REST API نسخه‌دار، قرارداد عمومی و اتصال
واقعی UI برای کشور، شهر، ارز، بانک، بیمه، ایرلاین، هتل، Organization/Role، کارگزار،
لیدر و نحوه آشنایی تکمیل می‌شود. نرخ ارز فقط Draft/Preview است و منبع محاسبه یا گزارش
مالی authoritative محسوب نمی‌شود.

## مرز IAM و شعبه

مصرف IAM فقط از `AuthenticatedActor`، `IamPermissionCode` و `BranchReference` در
`@rubi/contracts` انجام می‌شود. هیچ جدول، Prisma model یا Repository داخلی IAM از Master
Data query یا import نمی‌شود. Permissionها deny-by-default و عملیات تغییر با actor، branch
scope و Audit ماژول ثبت می‌شوند.

## Migration و یکپارچگی

- Migration فقط افزایشی و غیرمخرب است؛ FK، Unique و Index واقعی دارد.
- رکورد reference حذف نمی‌شود و با `isActive/deactivatedAt` غیرفعال می‌شود.
- زمان‌ها UTC و نرخ Draft با Decimal و دو Currency FK ذخیره می‌شود.
- Organization profile واحد و Role چندگانه دارد؛ Agency/Corporate/Supplier duplicate نیست.
- Seed/Fixture فقط داده synthetic و تکرارپذیر توسعه ایجاد می‌کند.

## Export و محدودیت‌ها

درخواست async export شامل snapshot فیلتر، ستون‌ها، Permission، actor، branch، locale و
timezone پایدار می‌شود. تا قرارداد عمومی Documents/Worker، وضعیت درخواست صریحاً
`AWAITING_DOCUMENTS_WORKER` است و هیچ فایل Excel/PDF ساختگی یا artifact جعلی تولید نمی‌شود.

## معیار پذیرش

- Prisma format/validate/generate و migrate deploy/status روی PostgreSQL محلی
- Contract، Unit، Integration، Permission، Migration و Seed idempotency tests
- CRUD، activate/deactivate، search/filter/sort allowlist و pagination واقعی
- UI فارسی/RTL با Loading/Empty/Error/Permission/Success و عملیات واقعی
- lint، typecheck، affected/full tests، production build، diff/secret/scope scan
- Commitهای کوچک، Push معمولی و Draft PR به `develop` بدون Merge

## Handoff لازم

پس از Merge، قفل‌های Migration، Dependency/Lockfile، Master contract و اسناد مرکزی باید
در Handoff مستقل برای فاز B `CUSTOMER-001` آزاد و دوباره رزرو شوند؛ انتقال خودکار نیست.

## نتیجه پیاده‌سازی

- ۱۲ Resource عمومی با Prisma model، FK/Unique/Index، Repository و Application Service
  ماژولار و REST API زیر prefix نسخه‌دار `/api/v1/master-data` پیاده‌سازی شدند.
- Organization پروفایل واحد و Role چندگانه دارد؛ insurer/airline/broker/hotel فقط با
  Organization فعال و Role متناظر پذیرفته می‌شوند.
- mutationها با actor واقعی، branch scope، optimistic `version` و Audit snapshot ثبت
  می‌شوند؛ endpoint حذف وجود ندارد و status action رکورد را deactivate/activate می‌کند.
- Frontend فارسی، RTL و Responsive به Backend واقعی متصل است و Loading، Empty، Error،
  Permission، Success، create/view/edit/status، filter/sort/search و pagination را پوشش می‌دهد.
- درخواست Export، snapshot فیلتر/ستون/Permission/actor/branch را با وضعیت
  `AWAITING_DOCUMENTS_WORKER` ذخیره می‌کند؛ `artifactId` تا Worker/Docs برابر null است.

## Migration و کنترل‌ها

- Migration: `20260823084001_master_data_foundation`؛ فقط CREATE/INDEX/FK و بدون
  `DROP`، `TRUNCATE` یا `DELETE FROM`.
- PostgreSQL محلی ایزوله: نسخه ۱۸ روی `127.0.0.1:55432`؛ `migrate deploy` و
  `migrate status` پاس و schema up-to-date است.
- Fixture synthetic برای IR، IRR، USD و REFERRAL دو بار متوالی بدون duplicate اجرا شد.
- Prisma format/validate/generate، frozen install، lint و typecheck کل Monorepo پاس شدند.
- تست کامل: ۵۵ تست در ۲۴ فایل؛ Contract، Unit، HTTP Integration، Permission، Migration
  و Frontend client/state همگی پاس شدند.
- Production build هر ۶ build task پاس شد و route `/master-data` prerender شد.

## ریسک و Handoff

- `DEC-OPEN-004`: نرخ‌ها صرفاً Draft/Preview و `isAuthoritative=false` هستند.
- تولید Excel/PDF واقعی منتظر قرارداد و Worker ماژول Documents است؛ هیچ فایل جعلی نیست.
- PR شماره ۱۵ با Merge `ddfebb369de67cb7ff45bd15a06841d3251c945a` ادغام و Task
  `DONE` شد.
- چهار قفل MASTER-002 آزاد و قفل‌های لازم برای `CUSTOMER-001` فاز B در Handoff مستقل
  رزرو شدند.
- Migration اطلاعات پایه پیش‌تر روی دیتابیس Preview محلی اعمال شده است؛ Volume، داده یا
  تاریخچه Migration نباید حذف یا دستی دست‌کاری شود.
- تست Migrationهای بعدی فقط روی PostgreSQL ایزوله و تازه اجرا می‌شود.
