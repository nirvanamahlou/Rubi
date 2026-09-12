# B2B-BACKEND-ONLY-CONNECTIONS-001 — ارتباطات CRM فقط در Backend

`COMPUTER_ID=PC-B` — Branch: `codex/pc-b-b2b-backend-only-connections` — Base: `origin/develop@40d8f1f4`

## درخواست و نتیجه

مالک محصول مشخص کرد که «ارتباطات» به معنی پیوندهای داده‌ای Backend است و نباید به‌صورت تب یا سکشن مستقل در پرونده سازمان/آژانس نمایش داده شود. تب «ارتباطات CRM» و کامپوننت نمایشی اختصاصی آن حذف شدند.

اتصال Backend حذف یا جابه‌جا نشده است. Controller و Service عمومی B2B در مسیر `/api/v1/b2b/agencies/:organizationId/crm-connections`، قرارداد مسیر، client و hook وب و مدل داده حفظ شده‌اند. داده‌های ارتباطی همچنان در KPIهای پرونده و نمای مالیِ زمینه‌ای مصرف می‌شوند.

## مرز تغییر

- بدون Migration، Schema، Seed یا تغییر داده.
- بدون تغییر API contract، Permission، Branch scope یا منطق Backend.
- بدون تغییر Dependency/Lockfile یا Runtime مشترک.
- `agency-connections-panel.tsx` که بخشی از جریان عملیاتی طبیعی پرونده است، دست‌نخورده باقی مانده است.

## کنترل کیفیت

- ۱۳۰ تست ماژول Organizations در ۱۹ فایل: موفق.
- ۸ تست مرزی و سرویس CRM connections در API: موفق.
- ESLint فایل‌های متاثر وب: موفق.
- TypeScript وب: موفق.
- Build تولیدی وب، شامل ۴۶ مسیر: موفق.
- جست‌وجوی منبع: هیچ import، render یا label اجرایی از پنل مستقل باقی نمانده و مسیر Backend و مصرف KPI/Finance موجود است.

این شاخه برای Review و PR به `develop` تحویل می‌شود و سازنده آن Merge خودکار انجام نمی‌دهد.
