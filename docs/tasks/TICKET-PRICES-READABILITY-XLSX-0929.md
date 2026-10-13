# TICKET-PRICES-READABILITY-XLSX-0929 — PC-A

## درخواست و محدوده

- خواناتر کردن مشخصات پرواز و مسیر در کارت‌های `/sales/ticket-prices` و جا دادن کامل ارز در کنترل قیمت پایه.
- افزودن خروجی XLSX با قالب راست‌به‌چپ و هدر هماهنگ با خروجی Reservations.
- خروجی باید فیلترهای صفحه (مبدأ، مقصد، نوع سفر، جست‌وجو و بازه تاریخ) را رعایت کند. هر جفت رفت‌وبرگشت در یک ردیف می‌آید و جزئیات هر دو پرواز، قیمت پایه و قیمت مقصدهای فروش را دارد.

## رزرو و مرزها

- `COMPUTER_ID=PC-A`؛ مبنا `origin/develop@020bb818`؛ شاخه `codex/pc-a-ticket-prices-xlsx-0929`. پس از پیشرفت develop تا `686a6947`، تغییرات تازه fast-forward شدند.
- فایل‌های رزروشده: Sales `ticket-prices-workspace.tsx` و مدل/سازنده خروجی همین ماژول، `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md` و این handoff.
- مالک Sales/Pricing: PC-A. قفل محدود فایل‌های رابط و اسناد مرکزی برای همین Work Item است. مالک Migration یا Dependency/Lockfile لازم نیست؛ قرارداد مشترک/API و دیتابیس تغییر نمی‌کنند.
- فقط کدها، درصدهای کمیسیون و فیلترهای مجاز موجود در خروجی صفحه استفاده شوند؛ داده تازه از backend یا داده عملیاتی خوانده نمی‌شود.

## اعتبارسنجی و تحویل

Web lint، typecheck و build تولیدی (۵۵ مسیر) موفق شدند. CI کامل PR #470 نیز در هر دو اجرا سبز شد: build، quality gate، full test suite و PostgreSQL 18 migration/seed gate. Commit پیاده‌سازی `fe1bb633`; هیچ Migration جدید یا به‌روزرسانی runtime محلی در محدوده نیست. Merge با مجوز صریح مالک انجام می‌شود.
