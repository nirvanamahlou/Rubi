# BRAND-NORA-001 — تغییر نام محصول به Nora

## نتیجه

- نام نمایشی فارسی و انگلیسی محصول در Web، API، Worker، Swagger، PDF/XLSX، اعلان‌ها، فرم‌ها و مستندات به `Nora/نورا` تغییر کرد.
- namespace تمام packageهای workspace و importهای داخلی به `@nora/*` منتقل شد؛ root package نیز `nora-airline-crm` است.
- کوکی‌ها، JWT issuer/audience، هدرهای Manifest و Password Change، نام صف‌ها، کلیدهای runtime، نمونه تنظیمات و نام فایل‌های Customer Affairs با Nora هماهنگ شدند.
- نام‌ها و لینک‌های واقعی GitHub و مسیرهای تاریخی سیستم‌عامل تغییر نکردند، چون هنوز به منابع موجود اشاره می‌کنند.
- شناسه‌های AAD رمزنگاری مشتری/Master Data، salt مشتق‌سازی کلید TOTP، magic bytes فایل Documents و نام دیتابیس عملیاتی قدیمی حفظ شدند. این شناسه‌ها نام نمایشی نیستند و تغییر مستقیم آن‌ها داده‌های موجود را ناخوانا می‌کند.

## مرز داده و زیرساخت

هیچ Schema، Migration، Seed، role، permission یا رکورد عملیاتی تغییر نکرد. تنظیمات نمونه و Docker برای نصب تازه با نام Nora به‌روزرسانی شدند؛ runtime فعلی همچنان همان دیتابیس و document storage موجود را مصرف می‌کند.

## اعتبارسنجی

- `pnpm install --frozen-lockfile`: موفق، ۱۰۶۵ entry از نظر supply chain policy تایید شد.
- `pnpm typecheck`: ۹ از ۹ Task موفق.
- `pnpm lint`: ۶ از ۶ Task موفق، بدون warning.
- `pnpm build`: ۶ از ۶ Task موفق؛ Web تولیدی با ۴۶ route، API و Worker ساخته شدند.
- `pnpm test`: ۹ از ۹ Task موفق؛ Web برابر ۱۳۷۹ تست، API برابر ۱۳۳۳ تست و packageهای Contracts/Database/Config/Worker برابر ۱۴۹ تست موفق. تست‌های PostgreSQL که نیازمند opt-in هستند طبق قرارداد suite اجرا نشدند.
- runtime محلی: Build `unified-ZyV35vImKKoEtH_BCsmJV` روی Web3100 و API4191 اجرا شد؛ readiness هر دو ۲۰۰ و صفحه ورود پس از reload قابل مشاهده است.
