# DOCUMENTS-002 — Vertical Slice پایدار اسناد و فایل‌ها

وضعیت: `READY_FOR_REVIEW`

مالک: `PC-B`

Branch: `codex/pc-b-documents-vertical-slice`

Parent: `origin/codex/pc-b-documents-foundation@05b09e8` / Draft PR `#61`

Draft PR این Slice: `#64` با Base برابر `codex/pc-b-documents-foundation`

تاریخ شروع: 2026-09-01

## رزرو

مالک در 2026-09-01 آزادشدن قفل‌های `PC-B/MASTER-003` را برای ادامه Documents تأیید
کرد. این Slice قفل‌های Migration، قرارداد مشترک Documents، Permission/Seed محدود IAM و
اسناد مرکزی را تا Handoff نهایی در اختیار `PC-B/DOCUMENTS-002` می‌گیرد. قفل Dependency
آزاد است و Dependency جدید برنامه‌ریزی نشده است.

PR این Slice تا زمان ادغام Phase A به‌صورت stacked روی
`codex/pc-b-documents-foundation` باز می‌شود و مستقیماً به `develop` متکی نیست.

## محدوده مرحله اول

- Schema و Migration افزایشی Documents، بدون Binary در Database
- Repository و REST API واقعی با Search/Filter/Sort/Pagination سمت Server
- جزئیات سند و شش تب موردنیاز رابط
- بارگذاری واقعی فایل پشت Storage Port خصوصی و سیاست Backend
- Permissionهای پایه و جداسازی محتوای Finance و HR
- رابط `/documents` در Layout اصلی، وضعیت‌های Loading/Empty/Error/Forbidden و Responsive
- تست Migration، Seed تکرارپذیر، API/Permission/Contract/Web و Smoke احراز‌شده

## خارج از محدوده این Slice

- صدور یا Render سندهای متعلق به Sales، Reservations، Finance یا HR
- Antivirus production و Worker پردازش امنیتی
- اشتراک امن پیشرفته، Export Worker و حذف دائمی Retention
- Query مستقیم به جدول ماژول‌های دیگر
- داده واقعی، PII، Secret یا فایل نمونه ماکاپ در Git/Seed

## معیارهای عملیاتی موقت

تا تصمیم نهایی `DEC-OPEN-007`، معیارهای پیشنهادی Phase A حفظ می‌شوند: بار کمتر از
100 QPS در p99، API Metadata با p95 حداکثر 500ms، دسترس‌پذیری پیشنهادی 99.9 درصد،
RPO پیشنهادی 15 دقیقه و RTO پیشنهادی 4 ساعت. این اعداد تعهد محصول نیستند.

## گزارش اجرا

### Database و قرارداد

- Migration افزایشی `20260901090000_documents_vertical_slice` مدل‌های نوع، دسته، سند،
  نسخه، ارتباط، Audit، قرنطینه و صف پردازش را می‌سازد. فایل Binary در PostgreSQL ذخیره
  نمی‌شود و تمام ارتباط‌های داخلی Documents با FK واقعی محافظت می‌شوند.
- ۱۹ نوع سند مرجع و ۹ دسته تکرارپذیر Seed می‌شوند؛ Seed هیچ سند یا فایل نمایشی تولید
  نمی‌کند. نقش‌های مستقل Archive، Sales، Finance و HR فقط Permission و Domain لازم خود
  را می‌گیرند.
- قرارداد عمومی `documents.v1` و ۲۸ Permission افزایشی IAM منتشر شد. دسترسی Finance و
  HR deny-by-default است و Repository فقط از Actor/Branch/Public Contract استفاده می‌کند.

### Backend و نگهداری فایل

- Endpointهای فهرست/Options، جزئیات، Audit، بارگذاری Multipart و دانلود واقعی زیر
  `/api/v1/documents` پیاده‌سازی شدند؛ جست‌وجو، فیلتر، مرتب‌سازی و صفحه‌بندی سمت Server
  اجرا می‌شوند.
- Adapter خصوصی این Slice فایل را با AES-256-GCM و کلید مستقل، نام تصادفی و مجوز فایل
  محدود روی Disk محلی Development/Test نگه می‌دارد. Magic bytes، MIME، پسوند، سقف حجم،
  Macro/Archive، Hash و Path traversal بررسی می‌شوند.
- دانلود تا نتیجه `CLEAN` آنتی‌ویروس fail-closed است. Adapter تولیدی S3/MinIO و موتور
  واقعی Antivirus هنوز Deferred هستند و این Adapter محلی جایگزین معماری تولید نیست.

### Web

- صفحه `/documents` به API واقعی متصل شد؛ ۱۱ بخش، نماهای شخصی، کارت‌های آرشیو، جست‌وجو
  و فیلترهای Server-side، Sort/Pagination، Loading/Empty/No-result/Error/401/403 و جدول
  Responsive دارد.
- Dialog بارگذاری چهار بخش دارد و فایل واقعی، نوع، دسته، Branch، مالک، محرمانگی، تاریخ
  و یادداشت را ارسال می‌کند. انتخابگر شمسی/میلادی یک Instant مشترک را حفظ می‌کند.
- Dialog جزئیات شش تب «پیش‌نمایش، اطلاعات، ارتباطات، نسخه‌ها، دسترسی و اشتراک، فعالیت و
  نگهداری» دارد. قابلیت‌های Deferred با برچسب صریح نمایش داده می‌شوند و رکورد Preview
  یا فایل جعلی از مسیر تولید حذف شد.
- مشکل قرارگیری Dialog مشترک در RTL رفع و با آزمون قرارداد پوشش داده شد.

### کنترل کیفیت و Smoke

- Prisma format/validate/generate، تمام ۲۸ Migration از صفر روی PostgreSQL 18، Seed دوگانه
  و شمارش دقیق ۱۹ نوع/۹ دسته/۴ نقش پاس شدند؛ Drift جدیدی برای مدل Documents وجود ندارد.
- lint، typecheck و Production Build کل Monorepo پاس شدند. مجموعه عمومی ۱٬۲۹۶ تست پاس
  دارد و ۶۶ تست PostgreSQL opt-in در اجرای عمومی عمداً skip می‌شوند؛ آزمون‌های دیتابیس
  واقعی این Slice جداگانه پاس شدند.
- مرورگر احراز‌شده: ورود و route مستقیم، فعال‌شدن منو، بارگذاری واقعی، ایجاد کد آرشیو،
  شش تب جزئیات و مسدودبودن دانلود تا Scan پاس شدند. Sales سند مشتری را می‌بیند؛ Archive
  همان سند را Mask‌شده و بدون دانلود می‌بیند؛ Finance و HR آن را نمی‌بینند و گزینه‌های
  بارگذاری‌شان فقط به Domain خود محدود است.
- تقویم بین `۱۴۰۵/۶/۱۵` و `6 September 2026` همان تاریخ را حفظ کرد. چیدمان Desktop و
  Mobile 390×844 و Dialog بارگذاری در هر دو حالت بررسی شد.
- Database/Container، حساب‌ها، فایل، کلید، Storage و Environmentهای آزمایشی همگی Synthetic
  و خارج از Git بودند و پس از Smoke حذف شدند. هیچ داده یا Secret واقعی وارد Repository نشد.

### Handoff و ریسک باقی‌مانده

- این Branch عمداً روی `codex/pc-b-documents-foundation@05b09e8` است و PR آن باید تا
  Merge والد به همان Branch هدف بگیرد؛ هیچ Merge مستقیم به `develop` انجام نمی‌شود.
- Slice بعدی باید Adapter تولیدی S3/MinIO، Antivirus Worker با Retry/Operations، سیاست
  قطعی retention/residency/key management، اشتراک امن، نسخه‌گذاری عملیاتی، Export و
  producer integrationها را جداگانه رزرو کند.
- قفل‌های Migration، Contract/IAM، فایل Dialog/environment example و اسناد مرکزی این
  Task پس از آماده‌شدن Review آزاد شدند؛ Dependency/Lockfile در تمام اجرا آزاد ماند.
