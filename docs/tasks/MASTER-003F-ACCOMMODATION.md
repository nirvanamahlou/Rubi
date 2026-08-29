# MASTER-003F — Accommodation Master Data

- وضعیت: `READY_FOR_REVIEW — STACKED DRAFT PR #32`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-accommodation`
- Parent: PR #31 / `codex/pc-b-master-data-suppliers@02d4101`
- Parent chain: `#31 ← #30 ← #29 ← #28 ← #25`
- Draft PR: [#32](https://github.com/nirvanamahlou/Rubi/pull/32)
- Route: `/master-data/accommodation`
- Migration: `20260829150000_master_data_accommodation`

## محدوده تحویل

این Vertical Slice فقط دامنه اقامت و هتل را پوشش می‌دهد و هشت نمای تأییدشده ماکاپ را
به Backend واقعی متصل می‌کند:

1. هتل‌ها
2. پروفایل هتل
3. زنجیره هتل
4. نوع اتاق
5. وعده و سرویس
6. امکانات
7. ورود گروهی Excel
8. هتل ترکیبی

## Database و Migration

- `MasterHotelChain` با Country FK، نام دوزبانه، وب‌سایت، Logo Reference، وضعیت و Version
- توسعه غیرمخرب `MasterHotel` با Chain FK، وب‌سایت، ساعت ورود/خروج، مختصات، Logo
  Reference و Saleable Reference
- `MasterMealServiceCategory` با `MEAL_PLAN` و `SERVICE`
- روابط نرمال چندبه‌چند Hotel ↔ Meal Service و Hotel ↔ Room Type؛ رابطه Facility موجود
  حفظ و در UI کامل شد
- `MasterCompositeHotel` و اعضای اولویت‌دار/پشتیبان با City FK
- Check Constraint واقعی برای قالب ساعت، جفت و بازه مختصات، ترتیب نمایش Facility،
  شرط غیرخالی Composite و اولویت مثبت عضو
- FKهای جدید `ON DELETE RESTRICT` و Backfill غیرمخرب Meal/Room قدیمی
- Seed عمداً هیچ Hotel، Chain، Composite، Contract، Inventory یا Documents Reference
  ساختگی اضافه نمی‌کند

## API و Contract

- Contract عمومی `master-data.v8` با ۲۵ Resource
- Resourceهای جدید: `hotel-chains`، `room-types`، `meal-services`، `facilities` و
  `composite-hotels`
- `GET /api/v1/master-data/accommodation/summary` برای KPIهای واقعی
- Search، Filter، Sort، Pagination، Create/View/Edit، Active/Inactive، Optimistic Lock،
  Audit، Permission و XLSX برای همه کاتالوگ‌ها
- فیلترهای Country/City/Chain/Star/Capacity/Meal Category/Facility Category/Saleable
- اعتبارسنجی Reference فعال، URL، زمان، مختصات، ظرفیت، روابط چندبه‌چند و اعضای هم‌شهر
- Import موجود `HOTEL_IMPORT_V1` پس از Commit روابط نرمال Meal/Room/Facility را نیز
  به‌روز می‌کند

## Web

- UI فارسی، RTL، Responsive با هشت تب و Header/Description/Action متناظر ماکاپ
- KPIهای پاستلی با نام و آیکن دقیق هر نما و مقدار واقعی Backend
- جدول تخصصی برای Hotel/Chain/Room/Meal/Facility و کارت اعضای Composite
- پروفایل واقعی Hotel شامل موقعیت، زمان، سرویس‌ها، امکانات و وضعیت Documents
- فیلترهای Contextual واقعی و Export منطبق با فیلتر جاری
- فرم‌های Create/View/Edit با selector تک‌انتخابی و چندانتخابی Reference
- Empty/Loading/Error/Forbidden state بدون رکورد نمایشی یا عدد ساختگی

## مرز مالکیت

- Hotel/Chain/Room/Meal/Facility/Composite داده مرجع مشترک Legal Entityها هستند.
- Reservations مالک Inventory، Room Assignment، Passenger Allocation و Voucher است.
- Procurement مالک Contract، Purchase Rate و Contract Reference است.
- Documents/Worker مالک Logo/Image/File lifecycle است؛ تا قرارداد رسمی فقط وضعیت
  unavailable نمایش داده می‌شود.
- هیچ Query مستقیمی به جدول ماژول دیگر و هیچ تغییر در Customers انجام نشده است.

## کنترل کیفیت

- Frozen install: موفق؛ Lockfile ثابت
- Prisma format/validate/generate: موفق
- ۱۳ Migration روی PostgreSQL 18.1 خالی: موفق
- Seed دو بار: موفق و بدون داده ساختگی اقامت
- Constraint زنده زمان، جفت/بازه مختصات، ترتیب Facility و اولویت عضو: موفق
- Lint فایل‌های Slice: موفق
- Typecheck کل Monorepo: موفق
- تست کامل Monorepo: `366/366` موفق
- Production Build کل Monorepo: موفق؛ route اقامت در SSG تولید شد
- Full Web Lint: فقط به‌علت ایراد قدیمی و خارج از Scope در DatePicker متوقف است

## قفل و Merge

قفل‌های Migration، Master Data shared-contract و اسناد مرکزی همان
`PC-B/MASTER-003` باقی می‌مانند. این PR باید Draft و Base آن
`codex/pc-b-master-data-suppliers` باشد؛ قبل از Merge والد #31 و زنجیره والدهای آن
نباید Merge یا به `develop` منتقل شود. Force push و حذف Source Branch ممنوع است.
