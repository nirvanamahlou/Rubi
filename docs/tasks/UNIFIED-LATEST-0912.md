# UNIFIED-LATEST-0912

## هدف

ساخت یک Baseline واحد و قابل دریافت برای همه کامپیوترها از آخرین تغییرات منتشرشده
PC-A و PC-B، بدون از بین‌بردن تغییرات محلی هیچ Worktree و بدون تغییر `main`.

## منابع ادغام

| محدوده | منبع نهایی هنگام ادغام |
| --- | --- |
| رزرواسیون، فروش و خروجی بلیت | `codex/pc-a-reservation-settings-0912@af77d07` |
| Header، Login B2 و گروه‌های بسته | `codex/pc-a-header-date-inline-0912@bc40d8b` |
| حسابداری و کارتابل مالی | `codex/pc-a-finance-core-accounting@f2085c1` |
| مدیریت قیمت | `codex/pc-a-pricing-management@135260f` |
| آژانس‌ها و مشتریان سازمانی | `codex/pc-b-b2b-profile-grid@5ef4e39` |
| میزکار شخصی | `codex/pc-b-workbench-message-emoji@2794b60` |
| Reporting PC-C | `codex/pc-a-authorize-pc-c-reporting@a9300cc` |
| تقویم نرخ هتل | `codex/pc-a-hotel-rate-calendar-0912@33a087e` |
| اطلاعات طرف قرارداد | `codex/pc-a-reservation-party-details-0912@e81148c` |
| جزئیات تور | `codex/pc-a-tour-runtime-0910@a86f409` |

## حل اختلاف‌ها

- بخش‌های افزایشی اسناد وضعیت هر دو سیستم حفظ شدند و این سند، مرجع دقیق Baseline
  تجمیعی است.
- Navigation همه مسیرهای جدید را حفظ می‌کند و گروه‌ها در ورود اولیه بسته‌اند.
- تاریخ‌های Finance، Pricing، مدارک مسافر و سابقه نرخ هتل از DatePicker مشترک
  استفاده می‌کنند.
- انقضای سند آژانس بر مبنای پایان روز تهران ذخیره و بدون جابه‌جایی روز نمایش داده
  می‌شود.
- صفحات اصلی رزرواسیون و مالی بر اساس Workspace عملیاتی جدید اعتبارسنجی می‌شوند.

## حفاظت از کارهای محلی

هیچ Worktree دیگری پاک، Reset، Stash یا Overwrite نشده است. فایل‌های خروجی محلی،
تنظیمات محیط و تغییرات Commit‌نشده وارد این شاخه نشده‌اند. این ادغام مالکیت دامنه یا
قفل Taskهای آینده را تغییر نمی‌دهد.

## نتیجه کنترل تحویل

- نصب Frozen و Prisma generate/format/validate: پاس
- lint: شش Task پاس
- typecheck: نه Task پاس
- تست: Web برابر ۱۲۸۱، API برابر ۱۲۱۰، Database برابر ۷۳، Contracts برابر ۶۷،
  Config برابر ۲ و Worker برابر ۱؛ در مجموع ۲۶۳۴ تست پاس
- Production Build: شش Task و ۴۶ Route پاس
- `git diff --check` و کنترل الگوی Secret/PII: پاس
- Smoke Login و Health و اجرای Web روی پورت 3100 پس از Merge ثبت می‌شود.

تست‌های PostgreSQL نیازمند متغیر محیطی صریح که در اجرای Unit موجود نبودند، به‌صورت
شفاف Skip شدند؛ Migrationهای متناظر در تست‌های Database بررسی شدند. هیچ داده واقعی یا
Credential وارد Git نشده است.
