# CUSTOMER-DIRECT-CONTACT-0908 — نمایش درون‌ردیفی شماره تماس

- Computer: `PC-A`
- Branch: `codex/pc-a-customer-direct-contact-0908`
- Base: `3b82a72f3478af1d9045f83d043cf120583e0f59`
- Status: `COMPLETE_LOCAL`

## هدف

در فهرست مشتریان و مسافران، ایمیل نباید زیر عنوان «شماره تماس» نمایش داده شود و دکمه جداگانه «مشاهده تماس‌ها» نیز فضای یک ردیف دیگر ایجاد نکند. شماره ماسک‌شده و عملیات مشاهده امن باید در یک کنترل درون‌ردیفی ادغام شوند.

## مرز امنیتی

- فهرست Backend فقط شماره تلفن منتخب را به‌صورت Masked برمی‌گرداند.
- شماره کامل فقط با Permission موجود، دلیل allowlist و Audit موجود دریافت می‌شود.
- مقدار کامل در URL، Storage، Log یا پاسخ فهرست قرار نمی‌گیرد.
- مقدار Reveal‌شده پس از ۶۰ ثانیه، تغییر فهرست، blur یا پنهان‌شدن صفحه از حافظه UI پاک می‌شود.
- هیچ Schema، Migration، Seed، Dependency، Lockfile یا IAM grant تغییر نمی‌کند.

## کنترل کیفیت

- API Customers: ۹۴ تست پاس
- Web Customers: ۱۰۵ تست پاس
- lint و typecheck کامل API/Web: پاس
- Production build کامل API/Web: پاس
- API روی پورت ۴۰۰۰ و Web روی پورت ۳۱۰۰: پاسخ ۲۰۰
- `git diff --check`، Prettier و Scope scan: پاس
- Prisma، Migration، Seed، Dependency و Lockfile: بدون تغییر
