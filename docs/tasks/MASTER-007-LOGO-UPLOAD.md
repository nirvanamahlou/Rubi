# MASTER-007 — بارگذاری لوگوی اطلاعات پایه

## مسئله

فرم‌های دارای لوگو در اطلاعات پایه مستقیماً API عمومی Documents را صدا می‌زدند. در نتیجه کاربری که مجوز ویرایش اطلاعات پایه داشت اما مجوز فهرست، بارگذاری یا حذف عمومی اسناد را نداشت، رکورد را ذخیره می‌کرد ولی لوگو به آن متصل نمی‌شد.

## راه‌حل

- Web فایل، عنوان و نسخه رکورد را فقط به `POST /api/v1/master-data/:resource/:id/logo` می‌فرستد.
- Master Data وجود رکورد، نوع منبع و optimistic version را کنترل می‌کند و پس از دریافت شناسه واقعی سند، `logoFileReference` را به‌روزرسانی می‌کند.
- Documents با یک سرویس داخلی محدود، فقط دارایی برند مربوط به رابطه دقیق `master-data/resource/record-id` را می‌سازد یا بایگانی می‌کند. فهرست عمومی اسناد در اختیار ویرایشگر Master Data قرار نمی‌گیرد.
- کنترل PNG/JPEG، سقف ۵ مگابایت، شعبه مجاز، magic bytes، quarantine، اسکن، Audit و اعلان‌های Documents حفظ شده‌اند.
- همان مسیر برای حذف و جایگزینی لوگو استفاده می‌شود و فایل قبلی فقط وقتی بایگانی می‌شود که واقعاً به همان رکورد تعلق داشته باشد.

## پوشش

`airlines`، `banks`، `insurers`، `hotels`، `hotel-chains`، `rail-companies`، `bus-companies`، `organizations`، `suppliers` و `brokers`.

## سازگاری و مالکیت

تغییر API افزایشی است. Documents مالک فایل، نسخه، Storage، اسکن و Audit باقی می‌ماند و Master Data فقط UUID سند را نگه می‌دارد. هیچ Schema، Migration، Seed، Dependency/Lockfile یا IAM grant تغییر نکرده است.

## صحت‌سنجی

- API Master Data/Documents: ۴۶ فایل و ۵۰۶ تست موفق
- Web Master Data: ۴۲ فایل و ۳۳۸ تست موفق
- lint محدوده API و Web موفق
- typecheck کامل API و Web موفق
- production build کامل API و Web موفق
