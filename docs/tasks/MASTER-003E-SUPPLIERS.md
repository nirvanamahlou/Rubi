# MASTER-003E-SUPPLIERS — Organizations and Suppliers Vertical Slice

- مالک و Computer: `PC-B`
- Branch: `codex/pc-b-master-data-suppliers`
- Stacked Base: `codex/pc-b-master-data-ui-polish@920328e`
- مسیر محصول: `/master-data/organizations-suppliers`
- والد مستقیم: `MASTER-003D-UI-POLISH` / Draft PR #30
- قفل‌ها: Migration، Master Data shared-contract و اسناد مرکزی همان قفل‌های فعال
  `PC-B/MASTER-003` هستند؛ Dependency/Lockfile آزاد است.

## مرز دامنه

این Slice پروفایل مشترک Organization را بدون ساخت هویت تکراری توسعه می‌دهد و Supplier،
Broker، مخاطبان متعدد، کاتالوگ خدمات و وضعیت همکاری را به آن متصل می‌کند. اطلاعات مرجع
میان دو Legal Entity مشترک است و Legal Entity Selector روی Query آن فیلتر اعمال نمی‌کند.

قرارداد، خرید، قیمت، تسویه و تعداد قراردادهای عملیاتی متعلق به Procurement/Finance و
تنظیم Provider/API متعلق به Integrations است. در نتیجه رابط برای داده‌ای که قرارداد عمومی
واقعی ندارد `—` نمایش می‌دهد و هیچ Query مستقیمی به جدول ماژول دیگر ندارد.

## Database و Migration

Migration افزایشی `20260829133000_master_data_suppliers` موارد زیر را اضافه می‌کند:

- پروفایل `MasterSupplier` با FK یکتای Organization، موقعیت، وضعیت همکاری و شناسه اختیاری Provider
- توسعه غیرمخرب `MasterBroker` با موقعیت، وضعیت همکاری و خدمات چندگانه
- کاتالوگ `MasterTravelService` و دو جدول رابطه Supplier/Service و Broker/Service
- `MasterOrganizationContact` چندگانه با تلفن و ایمیل رمز‌شده، Mask و Fingerprint
- FKهای `ON DELETE RESTRICT`، optimistic version، Audit actor/time و Indexهای Search/Filter

Migration فاقد `DROP`، `TRUNCATE` یا `DELETE` است. همه ۱۲ Migration روی PostgreSQL
18 خالی اجرا شدند، Seed دو بار تکرار شد و Seed هیچ Supplier، Broker، Contact یا Provider
ساختگی ایجاد نمی‌کند. Check Constraintهای کامل‌بودن payload رمز و وجود حداقل یک راه تماس
با آزمون واقعی PostgreSQL تأیید شدند.

## امنیت، API و Permission

- Contract عمومی Master Data به نسخه ۷ و ۲۰ Resource ارتقا یافته است.
- Search، Filter، Sort، Pagination، Create/View/Edit، Active/Inactive، Optimistic Lock،
  Audit و Excel برای منابع جدید از مسیر عمومی Master Data ارائه می‌شوند.
- تلفن و ایمیل plaintext هرگز در جدول، پاسخ فهرست، Export یا Audit ذخیره نمی‌شوند.
- Unmask فقط از Endpoint اختصاصی و Permission
  `master_data.sensitive_contact.unmask` انجام و هر مشاهده در Audit ثبت می‌شود.
- AES-256-GCM و Fingerprint HMAC با کلیدهای domain-separated از Root Secret مستقل Master
  Data ساخته می‌شوند؛ هیچ Secret جدیدی در Git ثبت نشده است.
- حذف فیزیکی Supplier/Contact/Service و دورزدن FK مرجع Endpoint ندارد.

## Web

Workspace فارسی، RTL و responsive دقیقاً شش نمای ماکاپ را دارد:

1. تأمین‌کنندگان
2. پروفایل تأمین‌کننده
3. کارگزاران
4. پروفایل کارگزار
5. اطلاعات تماس
6. وضعیت همکاری

نام KPIها، آیکن‌ها و رنگ‌های پاستلی مطابق ماکاپ هستند. جدول‌ها، پروفایل‌ها، فیلترها،
وضعیت‌ها و Board همکاری از Backend واقعی تغذیه می‌شوند. Contact در حالت عادی Mask است؛
نمایش مجاز پس از ۳۰ ثانیه دوباره Mask می‌شود.

## فرض‌های بهره‌برداری

- الگوی غالب read-heavy و اوج کوتاه‌مدت کمتر از ۵۰ درخواست بر ثانیه است.
- هدف API برابر p95 کمتر از ۳۰۰ms و p99 کمتر از ۶۰۰ms، دسترس‌پذیری 99.9%،
  `RPO <= 24h` و `RTO <= 4h` است.
- تماس سازمانی PII است؛ داده کارت/PCI در این Slice وجود ندارد.
- عملیات و نگهداری این Slice در محدوده مالکیت `PC-B/MASTER-003` است.

## پذیرش

- Prisma format/validate/generate: موفق
- همه ۱۲ Migration روی PostgreSQL خالی: موفق
- Seed دو بار و Constraint زنده: موفق
- Contract `14/14`، Database `32/32`، API `195/195`، Web `105/105`، Worker
  `1/1` و Config `2/2`؛ جمعاً `349/349` تست موفق
- Lint و Typecheck کامل Monorepo و Production Build موفق؛ مسیر
  `/master-data/organizations-suppliers` در خروجی SSG ساخته شد.
- هیچ فایل Customers، dependency manifest یا lockfile تغییر نکرده است.
