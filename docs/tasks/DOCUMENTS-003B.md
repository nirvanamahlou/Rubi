# DOCUMENTS-003B — پیش‌نمایش امن تصویر

تاریخ: 2026-08-31

مالک اجرا: `PC-B`

شاخه: `codex/pc-b-documents-image-preview`

والد: `codex/pc-b-documents-usability@8cbe77b`

## هدف و محدوده

تصویر JPEG/PNG بارگذاری‌شده پس از اسکن پاک و احراز مجوز در تب «پیش‌نمایش» جزئیات
همان سند نمایش داده می‌شود. این Slice هیچ Prisma Schema، Migration، Seed، قرارداد
عمومی، Dependency یا Lockfile را تغییر نمی‌دهد و به شاخه‌های والد یا `develop` Merge
نمی‌شود.

## رفتار Backend

- مسیر افزایشی و احراز‌شده `GET /api/v1/documents/:id/preview` فقط محتوای JPEG/PNG را
  با `Content-Disposition: inline` و `Cache-Control: private, no-store` تحویل می‌دهد.
- شعبه و Domain، مجوز `documents.file.read`، محرمانگی، آرشیو فعال و وضعیت واقعی
  `CLEAN` پیش از بازکردن فایل کنترل می‌شوند؛ Pending، آلوده، قرنطینه و Scan ناموفق
  fail-closed باقی می‌مانند.
- سند محرمانه علاوه بر `documents.sensitive.read` به دلیل مشاهده حداقل پنج نویسه‌ای
  نیاز دارد. دلیل فارسی در Header به‌صورت URI-safe ارسال و در مرز HTTP رمزگشایی می‌شود.
- رویداد `documents.file.preview` با نتیجه موفق/ناموفق و علت کنترل‌شده ثبت می‌شود؛
  پیش‌نمایش به‌اشتباه در Audit به‌عنوان دانلود ثبت نمی‌شود.
- نوع MIME پاسخ دوباره در Web کنترل می‌شود و `X-Content-Type-Options: nosniff` فعال است.

## رفتار رابط

- برای تصویر عمومی/داخلیِ پاک، محتوای مجاز خودکار دریافت و با نسبت اصلی داخل قاب رنگی
  نمایش داده می‌شود.
- برای تصویر محرمانه، کادر «دلیل مشاهده» و دکمه «نمایش امن تصویر» قبل از دریافت ظاهر
  می‌شوند.
- Loading، خطا و تلاش دوباره، نبود مجوز، Scan ناتمام و فایل غیرتصویری هرکدام وضعیت
  مستقل و فارسی دارند. PDF، Office و Text همچنان از دکمه دانلود مجاز استفاده می‌کنند.
- فایل به Blob URL موقت تبدیل می‌شود؛ هنگام تغییر سند، بستن Dialog یا تلاش دوباره،
  درخواست قبلی Abort و URL موقت آزاد می‌شود. URL عمومی یا ماندگار ساخته نمی‌شود.

## اعتبارسنجی

- API: lint، typecheck، production build و مجموعه کامل تست موفق؛ ۷۰۸ تست موفق و ۶۶
  تست اختیاری PostgreSQL skip.
- Web: lint، typecheck، production build و مجموعه کامل تست موفق؛ ۵۱۶ تست موفق.
- تست‌های تازه مسیر inline و Permission مستقل، Audit پیش‌نمایش، Scan gate، نوع غیرتصویری،
  دلیل محرمانگی، کدگذاری فارسی، AbortSignal و cleanup Blob URL را پوشش می‌دهند.
- API جدید روی پورت ۴۰۰۰ و Web جدید روی پورت ۳۱۰۰ از مسیر صریح همین Worktree فعال‌اند؛
  Health برابر ۲۰۰ و مسیر محافظت‌شده بدون Session برابر ۳۰۷ است.

## محدودیت باقی‌مانده

تولید Thumbnail صفحه اول PDF و تبدیل Office در این Slice وجود ندارد؛ انجام آن به
Renderer/Worker امن و Work Item مستقل نیاز دارد. این Slice فقط JPEG/PNG را inline
نمایش می‌دهد و هیچ دسترسی عمومی یا دورزدن Antivirus ایجاد نمی‌کند.
