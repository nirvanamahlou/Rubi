# CALENDAR-001 — تقویم مشترک سامانه

- مالک: PC-B
- Branch: `codex/pc-b-master-data-advanced`
- وضعیت: `READY_FOR_REVIEW`
- تاریخ: 2026-08-26

## هدف

تمام فیلدهای تاریخ Web از یک تقویم مشترک با تم آبی استفاده کنند و بالای هر تقویم امکان سوییچ بین شمسی و میلادی وجود داشته باشد.

## محدوده انجام‌شده

- ایجاد `DatePicker` مشترک بدون Dependency جدید.
- نمایش پیش‌فرض شمسی و امکان تغییر به میلادی از بالای پنجره تقویم.
- ناوبری ماه، نمایش امروز، انتخاب تاریخ و انتخاب ساعت برای datetime.
- جایگزینی ورودی‌های خام مرورگر در Customers، Customer Affairs، Finance و Master Data.
- حفظ ISO Gregorian در state و درخواست Backend؛ تقویم انتخاب‌شده فقط presentation است.
- پشتیبانی از disabled/read-only، Escape، کلیک بیرون، focus ring و ARIA.

## کنترل کیفیت

- Web Typecheck: موفق
- Web Lint: موفق
- Web Tests: ۲۳ فایل و ۸۵ تست موفق
- Route compilation روی dev server: `/master-data`، `/customers`، `/customer-affairs` و `/finance` همگی ۲۰۰
- Production build در زمان بررسی به‌دلیل dev server فعال و قفل هم‌زمان `.next` قابل اجرا نبود؛ هیچ پردازش کاربر متوقف نشد.

## مرزها

این Task هیچ Dependency، Lockfile، API، Database، Contract یا Migration را تغییر نمی‌دهد. قفل UI مشترک تا Merge/Handoff فعال می‌ماند.