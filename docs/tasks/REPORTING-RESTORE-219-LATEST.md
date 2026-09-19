# REPORTING-RESTORE-219-LATEST

## هدف

ارائه آخرین تغییرات یکپارچه همکاران از `origin/develop` همراه با نسخه نهایی مورد
تأیید بخش گزارش‌ها در commit زیر:

`219091bf962ed5ce5a8dfff9ba949e13b0e0b1fd`

## روش بازیابی

- مبنا: `origin/develop@40d8f1f4316fa525b7f09f29b1cb5b9d121e1e0f`
- بازیابی محدود به `apps/web/src/modules/reports/**` و route گزارش‌ها.
- هیچ commit یا branch همکار حذف یا بازنویسی نشد؛ تغییرات Reports بعد از snapshot
  مرجع صرفاً از نسخه فعال کنار گذاشته شدند.
- DatePicker و سایر اجزای مشترک از develop نگه داشته شدند تا اصلاحات همکاران در
  سایر ماژول‌ها عقب‌گرد نکند.
- API فعال روی پورت 4000، دیتابیس و داده‌ها تغییری نکردند.

## اعتبارسنجی

- `pnpm --filter @rubi/contracts build`: موفق
- `pnpm --filter @rubi/web typecheck`: موفق
- `pnpm --filter @rubi/web build`: موفق، 46 route
- lint route و تمام فایل‌های `apps/web/src/modules/reports`: موفق
- تست‌های `reporting.spec.ts` و `client.spec.ts`: 10 تست موفق
- `navigation.spec.tsx` و `reporting-workspace.spec.tsx`: در مرحله collect با parser
  فعلی Vitest روی JSX snapshot تاریخی شکست می‌خورند. چون typecheck و production
  build موفق‌اند و هدف بازیابی دقیق snapshot است، فایل‌های مرجع تغییر داده نشدند.

## محدوده و ریسک

این تحویل UI Reports را بازیابی می‌کند و backend جدیدی به develop اضافه نمی‌کند.
عملکردهای داده‌ای صفحه به API موجود روی پورت 4000 متکی‌اند. برای ادغام production
backend گزارش‌ها، قرارداد و migration مستقل با مالک‌های API/Database لازم است.
