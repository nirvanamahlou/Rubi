# SYSTEM-MANAGEMENT-LIVE-CONSUMERS-004

## وضعیت

`READY_FOR_REVIEW` — `COMPUTER_ID=PC-B`

## هدف

مقدارهای منتشرشده در مرکز مدیریت سیستم فقط در جدول تنظیمات باقی نمانند و در
مصرف‌کنندهٔ واقعی ماژول‌های تحت مالکیت PC-B اثر بگذارند.

## پیاده‌سازی

- `SettingsRuntimeService` مقدار مؤثر را با اولویت
  `USER > BRANCH > LEGAL_ENTITY > GLOBAL` Resolve می‌کند و در نبود مقدار فعال،
  مقدار پیش‌فرض امن را نگه می‌دارد.
- امور مشتریان مقدار `affairs/sla` را هنگام ساخت تیکت می‌خواند؛ زمان پاسخ/حل و
  نسخهٔ سیاست روی Snapshot تیکت ثبت می‌شود و تیکت‌های قبلی بازنویسی نمی‌شوند.
- Documents مقدار `documents/upload` را برای سقف فایل بارگذاری و `options` مصرف
  می‌کند؛ سقف تنظیمی هرگز از حد سخت زیرساخت بالاتر نمی‌رود.
- Procurement مقدارهای `procurement/approval`، `procurement/quotations` و
  `procurement/emergency` را روی سیاست فعال مالک اعمال می‌کند؛ مراحل تأیید واقعی
  همچنان از Policy مالک می‌آیند.
- Workbench مقدار `tasks/tasks.priority` را فقط وقتی اولویت رویداد صریحاً ارسال
  نشده باشد به‌عنوان پیش‌فرض مصرف می‌کند.
- UI مرکز تنظیمات مقدار Global را برای Scope شرکت به‌صورت ارثی نشان می‌دهد؛
  ذخیرهٔ Override شرکت نسخهٔ مستقل و `expectedVersion` خودش را دارد.

## مرزها

دادهٔ عملیاتی، Secret، Migration، Permission و قرارداد عمومی ماژول‌های PC-A تغییر
نکرده‌اند. هیچ اتصال موفقی بدون Consumer واقعی یا Port عمومی مالک ادعا نشده است.

## اعتبارسنجی

- API TypeScript، ESLint و Build موفق.
- Web TypeScript، ESLint و Build موفق.
- کل تست API: `1535 passed | 168 skipped` در `194 passed | 14 skipped` فایل.
- تست‌های متمرکز Resolver، SLA، Documents، Procurement و Workbench موفق.
