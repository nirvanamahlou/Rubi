# DOCUMENTS-006 — ارتباط‌های داخلی و بین‌ماژولی اسناد

- Computer: `PC-B`
- Branch: `codex/pc-b-documents-connections`
- Base: `origin/develop@a56b62e`
- Status: `IN_PROGRESS`

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
