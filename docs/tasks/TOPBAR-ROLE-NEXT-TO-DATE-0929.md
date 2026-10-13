# TOPBAR-ROLE-NEXT-TO-DATE-0929 — PC-A

- درخواست: نقش کاربر کنار تاریخ هدر دیده شود.
- پیاده‌سازی: نشان نقش‌های فعال از منوی کاربر به گروه تاریخ/ساعت منتقل شد. مقدار از نشست فعلی و نقش‌های واقعی IAM خوانده می‌شود؛ رویداد نشست، هدر را پس از refresh احراز هویت به‌روز می‌کند.
- محدوده: Web HeaderToday، UserMenu، helper نشست و تست‌های مرتبط. بدون API، Migration، قرارداد مشترک، دسترسی/داده عملیاتی یا Dependency.
- اعتبارسنجی: ۱۳ تست هدر/نشست، Web typecheck، ESLint هدفمند و ESLint کامل Web، و production build (۵۵ مسیر) موفق‌اند. Migration یا Dependency وجود ندارد.
- وضعیت: آماده review در PR به `develop`؛ Merge پس از موفقیت CI.
