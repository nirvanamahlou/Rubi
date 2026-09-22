# PACKAGE-PRICING-BANNER-001 — ساخت بنر پکیج

وضعیت: `READY_FOR_REVIEW`

شاخه: `codex/pc-b-package-pricing-banner`

## محدوده

- مسیر اختصاصی ساخت بنر برای پکیج انتخاب‌شده در مدیریت قیمت و پکیج‌ها
- خواندن داده از قراردادها و APIهای موجود Package Pricing
- پیش‌نمایش HTML/CSS فارسی، RTL و واکنش‌گرا با تنظیمات صرفاً نمایشی
- کنترل deny-by-default مجوز مشاهده و ساخت بنر
- اعتبارسنجی fail-closed قیمت فروش، مقصد، بازه سفر و اتاق قابل‌فروش
- حفظ پکیج و فیلترهای صفحه مدیریت هنگام بازگشت

## مرزها

این کار Migration، Prisma، قرارداد مشترک، API عمومی، Dependency/Lockfile یا ماژول Documents را تغییر نمی‌دهد. خروجی تصویر/PDF تا آماده‌شدن Public Contract اسناد غیرفعال و با وضعیت روشن نمایش داده می‌شود. Adapter محلی فقط نقطه اتصال آینده را تعریف می‌کند و فایل ساختگی تولید نمی‌کند.

## تحویل

- دکمه «ساخت بنر» برای نسخه منتشرشده قیمت، کاربر را به `/sales/pricing/packages/[packageId]/banner` می‌برد.
- انتخاب تور، نوبت، بازه نرخ و نسخه انتشار در `returnTo` نگه داشته و هنگام بازگشت بازیابی می‌شود.
- داده صفحه از `tour-departures`، `tour-costs`، `tour-drafts/publications` و `banner-templates` موجود خوانده می‌شود.
- Preview فارسی و RTL با قالب، عنوان، متن کوتاه، قیمت، تاریخ، نام هتل و CTA قابل تنظیم است.
- مجوزهای `package_pricing.read` و `package_pricing.render` هر دو لازم‌اند؛ نبود هرکدام پیش از دریافت داده پکیج رد می‌شود.
- پکیج بدون مقصد، بازه معتبر، پرواز فعال، قیمت فروش منتشرشده یا اتاق دارای ضریب مثبت به‌صورت fail-closed متوقف و دلیل فارسی نمایش داده می‌شود.
- View Model بنر فقط قیمت فروش را نگه می‌دارد و نرخ خرید، کارگزار، کمیسیون، سود و شناسه revision مالی را منتقل نمی‌کند.
- به دلیل نبود قرارداد عمومی آماده Documents برای تولید بنر، خروجی تصویر/PDF غیرفعال و وضعیت `در انتظار سرویس خروجی اسناد` است.

## اعتبارسنجی

- ۱۷ تست کل `pricing-management`: موفق
- ESLint فایل‌های متاثر با صفر warning: موفق
- TypeScript کامل Web: موفق
- Next.js Production Build با Webpack: موفق؛ ۵۰ مسیر شامل route پویا بنر
- `git diff --check`، Scope scan و Secret/PII scan: پاک

Migration، Schema، API/Contract مشترک، Dependency/Lockfile، داده عملیاتی و Documents تغییر نکردند.
