# REPORTING-REMOVE-SCHEDULING

## هدف

حذف کامل تجربه و API عمومی زمان‌بندی گزارش بنا بر درخواست مالک محصول، بدون حذف
مخرب داده‌های تاریخی دیتابیس.

## تغییرات Web

- حذف نمای `schedules` از navigation و parser مسیر Reports
- حذف شمارنده زمان‌بندی از پاسخ مورد انتظار Workspace
- حذف Dialog و دکمه «زمان‌بندی گزارش» از فرم پیکربندی
- حذف client متدهای ایجاد، تغییر وضعیت و فهرست زمان‌بندی
- حذف کارت خلاصه و رفتار عملیاتی اختصاصی زمان‌بندی

## تغییرات API

- حذف `schedule-items` و `schedules` از Controller و Swagger
- حذف DTOها، قرارداد Proposal، validator و Serviceهای زمان‌بندی
- حذف queryهای فهرست، ایجاد، تغییر وضعیت و شمارنده زمان‌بندی از Repository
- حفظ `reporting_schedules` و Migration موجود صرفاً برای جلوگیری از data loss؛
  هیچ مسیر عمومی آن را نمی‌خواند یا تغییر نمی‌دهد.

## خارج از محدوده

- حذف فیزیکی جدول/enum یا Migration مخرب
- تغییر Permissionهای IAM و Seedهای تاریخی
- تغییر Worker، Documents، Export یا سایر ماژول‌ها

## اعتبارسنجی

- Web Reports tests: `36/36`
- API Reporting tests: `22/22`
- Web/API TypeScript و lint: موفق
- Web/API production build: موفق
- `GET /login` روی پورت ۳۰۰۰: `200`
- `GET /api/v1/health` روی پورت ۴۰۰۰: `200`
- `GET /api/v1/reports/schedule-items`: `404`
