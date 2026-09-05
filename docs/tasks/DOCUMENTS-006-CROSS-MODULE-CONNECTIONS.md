# DOCUMENTS-006 — ارتباط‌های داخلی و بین‌ماژولی اسناد

- Computer: `PC-B`
- Branch: `codex/pc-b-documents-connections`
- Base: `origin/develop@a56b62e`
- Pull Request: [#95](https://github.com/nirvanamahlou/Rubi/pull/95) → `develop`
- Status: `READY_FOR_REVIEW`

## هدف

هر سند باید بدون نمایش شناسه‌های فنی، ارتباط خود با دامنه و پرونده مبدأ را به زبان
فارسی نشان دهد. کاربر باید بتواند از سکشن Documents یا کارت ارتباط به مقصد منتشرشده
برود و با Back مرورگر به همان سند برگردد.

## Phase A — محدوده بدون تداخل

- نگاشت همه Domainهای قرارداد Documents به نام، توضیح، مسیر و سکشن داخلی فارسی.
- افزودن ورودی «رفتن به بخش مرتبط» به سکشن‌های دامنه‌ای Documents.
- تبدیل کارت‌های تب «ارتباطات» به مقصدهای قابل‌کلیک و دسترس‌پذیر.
- fallback روشن برای `documents-demo` و sourceهای قدیمی بر اساس Domain سند.
- حفظ لینک داخلی احراز‌شده Documents و جلوگیری از معرفی لینک عمومی/ناشناس.

فایل‌های Customers و Sales در PRهای فعال PC-A #85 و #90 تغییر نمی‌کنند. Phase A هیچ
قرارداد مشترک، API، Schema، Migration، Seed، Dependency یا Lockfile را تغییر نمی‌دهد.

## Phase B — پس از Handoff قراردادهای مبدأ

- مصرف exact-source filter منتشرشده Customer Documents از Public Contract.
- مصرف شناسه opaque و مسیر عمومی Sales پس از Merge قرارداد `sales.v1`.
- ثبت providerهای Reservations، Procurement، Finance، HR، Reporting و Brand فقط زمانی
  که ماژول مالک Public Reference Port واقعی منتشر کند.

Documents هیچ‌وقت برای ساخت گزینه پرونده یا نمایش ارتباط، جدول ماژول مبدأ را مستقیم
Query نمی‌کند. ماژول مبدأ مالک وجود رکورد، عنوان نمایشی، مجوز semantic و مسیر جزئیات
است؛ Documents مالک فایل، نسخه، محرمانگی، Scan، Archive و Audit باقی می‌ماند.

## محدودیت امنیتی

لینک عمومی/ناشناس یا زمان‌دار تا تعیین سیاست ابطال، retention و تصمیم
`DEC-OPEN-006` قابلیت تکمیل‌شده محسوب نمی‌شود. ارتباط فعلی فقط مسیر داخلی احراز‌شده
است و مقصد نیز مجوز خودش را دوباره کنترل می‌کند.

## نتیجه Phase A

- هر ده Domain قرارداد Documents یک تعریف کامل شامل نام سکشن، ماژول مالک، توضیح
  فارسی و مسیر داخلی آرشیو دارد.
- نمای کلی ۱۰ کارت رنگی دارد؛ ۹ کارت به Route واقعی ماژول مبدأ و کارت `GENERAL`
  فقط به آرشیو عمومی متصل است.
- هر سکشن دامنه‌ای توضیح رابطه و دکمه رفتن به ماژول خود را نشان می‌دهد. Domainهای
  Reporting، Brand و General نیز از کارت‌های نمای کلی با فیلتر Domain به «همه اسناد»
  می‌رسند.
- تب «ارتباطات» سند، نوع Relation و نام مبدأ را فارسی می‌کند، حالت بدون Relation
  دارد و لینک مقصد را با شناسه opaque سند/رابطه می‌سازد؛ `sourceEntityId` وارد URL
  نمی‌شود و عبارت فنی `documents-demo` به کاربر نمایش داده نمی‌شود.

## اعتبارسنجی و QA

- هر ۶۰۶ تست Web، شامل ۷ تست هدفمند ارتباطات Documents، موفق.
- Web lint و Web typecheck موفق.
- Production Build موفق با ۳۴ Route، شامل `/documents` و هر ۹ مقصد خارجی.
- Browser QA احراز‌شده روی `http://localhost:3100/documents`: نمایش ۱۵ سند داده
  آزمایشی، هر ۱۰ کارت ارتباط، بازشدن آرشیو مشتری و حالت «ابتدا فیلتر را انتخاب
  کنید»، رفتن به `/customers` و تب ارتباطات یک سند با دکمه مقصد تأیید شد.
