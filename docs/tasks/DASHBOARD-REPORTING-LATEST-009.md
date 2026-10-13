# DASHBOARD-REPORTING-LATEST-009

وضعیت: `LOCAL_COMPLETE / RUNTIME_ACTIVE`

مالک اجرا: `PC-C`

## هدف

- حفظ آخرین نسخه Reports شامل تغییرات تا commit `9d8d985f`.
- افزودن آخرین نسخه Dashboard شامل تغییرات `c4dc3c26` تا `af6de805`.
- اجرای هر دو مسیر `/dashboard` و `/reports` از یک runtime روی پورت ۳۰۰۰.

## محدودیت

- worktreeهای مستقل Dashboard و Reports تغییر نمی‌کنند.
- merge به `main` یا `develop` انجام نمی‌شود.
- API، Prisma/Migration، dependency و lockfile خارج از محدوده هستند.

## نتیجه

- آخرین Reports تا commit `9d8d985f` حفظ شد.
- snapshot نهایی Dashboard از commit `af6de805` همراه route صحیح `/dashboard`
  اعمال شد؛ route دیگر به `DashboardShell` اولیه متصل نیست.
- ۵۶ تست Dashboard/Reports، lint محدود، typecheck و build تولیدی ۴۶ route پاس شدند.
- dependency و lockfile تغییر نکردند؛ بسته workspace داخلی Contracts پیش از build
  از همان source شاخه ساخته شد.
- runtime یکپارچه روی پورت ۳۰۰۰ فعال است و هر دو مسیر `/dashboard` و `/reports`
  از همین پردازش سرو می‌شوند؛ پس از تعویض runtime ورود مجدد کاربر لازم است.
