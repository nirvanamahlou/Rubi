# MASTER-003D-UI-POLISH — Master Data Visual Consistency

- مالک: `PC-B`
- Computer: `PC-B`
- Branch: `codex/pc-b-master-data-ui-polish`
- Base: `codex/pc-b-master-data-financial@e7e6180`
- Draft PR: [#30](https://github.com/nirvanamahlou/Rubi/pull/30)
- والد مستقیم: `MASTER-003C-FINANCIAL` / Draft PR #29
- محدوده: فقط Web و مستندات همان Slice

## خروجی

- کامپوننت KPI مشترک با رنگ‌های پاستلی Sky، Emerald، Violet، Amber، Rose و Cyan
- آیکن معنایی، Dark Mode، RTL، Responsive و متن کمکی برای هر KPI
- نام KPIهای مالی و جغرافیا دقیقاً مطابق ماکاپ‌های تأییدشده
- مقدار `—` برای شاخص‌هایی که قرارداد واقعی Finance یا Aggregate هنوز ارائه نمی‌کند؛
  هیچ عدد ساختگی یا Seed نمایشی استفاده نمی‌شود
- نمای تخصصی جغرافیا با تب‌های کشور، استان/ناحیه، شهر، فرودگاه و ترمینال
- فیلتر Country/Region/City/Airport/Terminal Type از API عمومی Master Data
- جدول تخصصی هر منبع، Optimistic Lock از فرم موجود، Active/Inactive، Export و قواعد
  یکپارچگی قابل مشاهده
- حذف underline رنگی کارت‌های Hub در Hover با حفظ Focus Ring و حرکت کارت

## مرزها

- هیچ Schema، Migration، Seed، Backend یا API Contract تغییر نکرد.
- حساب، شبا، کارت، تراکنش، درگاه و تنظیمات تسویه وارد Master Data نشدند.
- هیچ فایل Customers، Dependency یا Lockfile تغییر نکرد.
- Legal Entity Selector داده‌های جغرافیا یا اطلاعات پایه را فیلتر نمی‌کند.

## پذیرش

- Web tests: `102/102`
- Full repository tests: `335/335`
- Monorepo typecheck: موفق
- Production build: موفق؛ مسیرهای `/master-data/geography` و
  `/master-data/finance` به‌صورت SSG تولید شدند
- Targeted lint همه فایل‌های تغییرکرده: موفق
- Full Web lint: فقط ایراد قدیمی و خارج از Scope
  `apps/web/src/components/ui/date-picker.tsx`
- API Health: `200`؛ مسیرهای محافظت‌شده Redirect صحیح به Login دارند
- `git diff --check`: موفق
