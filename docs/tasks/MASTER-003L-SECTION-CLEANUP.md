# MASTER-003L — Section navigation cleanup

## مالکیت و محدوده

- مالک: `PC-B`؛ Branch: `codex/pc-b-master-data-section-cleanup`
- والد: `codex/pc-b-master-data-travel-services` / Draft PR #38
- Base commit: `696195b9683ad789aa879c0c9b46732d98ba1c80`
- تغییر مستقل Web/Test/Docs تحت مالکیت و قفل‌های فعال `PC-B/MASTER-003`.
- بدون تغییر API، Contract، Database، Migration، Seed، Customers، Dependency یا Lockfile.

## رفتار جدید

- از تور و خدمات سفر، «شرکت اتوبوس»، «نوع اتوبوس» و «CIP» حذف شدند. تب‌های باقی‌مانده:
  لیدرها، نوع تور، نوع ترانسفر و ویزا.
- شرکت و نوع اتوبوس در صفحه موجود حمل‌ونقل باقی مانده‌اند؛ کارت Hub نیز این انتساب را نشان می‌دهد.
- از مراجع فروش، «نوع مشتری»، «منبع سرنخ» و «نوع کمپین» حذف شدند. تب‌های باقی‌مانده:
  نحوه آشنایی، کانال فروش، دلیل از دست رفتن و Tag.
- متن، برچسب‌ها و شمارنده دو کارت Hub مطابق چهار زیرمجموعه فعلی شدند.
- پروفایل‌ها همچنان Popup هستند؛ فرم، جست‌وجو، فیلتر، KPI و خروجی تب‌های باقی‌مانده حفظ شدند.
- کد نمایشی بلااستفاده و درخواست فرودگاهِ مخصوص CIP از صفحه خدمات سفر حذف شد.
- این تصمیم فقط مربوط به نمایش است؛ هیچ رکورد، جدول، API یا قرارداد حذف نشده است.
  CIP و سه مرجع فروش در `unlistedMasterDataResources` ثبت شده‌اند و همچنان جزو ۴۵ منبع API هستند.
  این تغییر جایگزین چیدمان قبلی تب‌های MASTER-003I و MASTER-003K است، نه حذف قابلیت Backend آن‌ها.

## کنترل کیفیت

- تمام تست‌های Web: `133/133` در ۳۲ فایل؛ شامل حذف شش ورودی، هماهنگی تب/Hub،
  حفظ انتساب اتوبوس به حمل‌ونقل، حفظ catalog و Popup بودن پروفایل‌ها.
- Web typecheck و lint تمام فایل‌های تغییرکرده: موفق.
- Web Production Build: موفق، ۳۴ صفحه؛ هر هشت مسیر اطلاعات پایه تولید شد.
- کنترل HTML خروجی Build: چهار تب دقیق و شمارنده «۴ زیرمجموعه» در هر کارت تأیید شد.
- Web HTTP: Login پاسخ ۲۰۰؛ Hub و دو مسیر بخش بدون Session به Login هدایت می‌شوند.
  مرورگر صفحه ورود را نشان داد؛ آزمون احراز‌شده انجام نشده است.
- API Health در `/api/v1/health` پاسخ ۲۰۰؛ سرورهای محلی متوقف یا جایگزین نشدند.
- Full Web lint: همان خطای قبلی `react-hooks/set-state-in-effect` در خط ۶۷ و هشدار
  `aria-required` در خط ۹۹ `date-picker.tsx`؛ فایل خارج از Scope و دست‌نخورده است.
- Migration/Seed در این اصلاح لازم نیست و اجرا نشده است.
- `git diff --check` و بررسی Scope/الگوهای Secret و PII در خطوط افزوده‌شده: موفق.

## تحویل و ادغام

- Draft PR باید Base مستقیم `codex/pc-b-master-data-travel-services` داشته باشد؛ وابسته به #38 و والدهای آن است.
- پیش از Merge والد ادغام نشود؛ پس از Merge والد، Base طبق ترتیب پشته به‌روز شود.
- Parent، PC-A، main و develop تغییر نمی‌کنند؛ بدون Force Push یا حذف Source Branch.
- قفل‌های Migration، Master Data shared-contract و Central docs نزد `PC-B/MASTER-003` باقی‌اند؛ Dependency آزاد است.
