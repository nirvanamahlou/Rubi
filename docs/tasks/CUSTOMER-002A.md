# CUSTOMER-002A — Customer Operations Enhancement

- **Computer:** PC-A
- **Owner:** PC-A
- **Branch:** codex/pc-a-customer-operations
- **Base commit:** b6da5d6300716a189958bc37d31ca195f0304dc5
- **Started:** 2026-08-27
- **Status:** DRAFT_PR_OPEN
- **Target:** develop
- **Draft PR:** #26
- **Schema/Migration/Dependency ownership:** NONE

## هدف و Scope

این Work Item فقط لایه عملیات Customers را روی Schema، Migration، قرارداد عمومی
customers.v2 و API موجود تکمیل می‌کند. هیچ Schema، Migration، Seed، Persistence،
Dependency، Lockfile، Shared Contract، Root Contract Export یا فایل مرکزی تغییر نمی‌کند.
Master Data فقط از Client عمومی آن مصرف می‌شود و هیچ Repository داخلی ماژول دیگر در
دسترس Customers قرار نگرفته است.

انتخاب Legal Entity بر دامنه مشتریان اثر ندارد. تمام فهرست، جست‌وجو، جزئیات و Mutationها
همچنان با Branch Scope محاسبه‌شده در Backend محدود می‌شوند.

## قابلیت‌های تکمیل‌شده

- فهرست عملیاتی با جست‌وجوی نام، تماس ماسک‌شده و کد کامل UUID مشتری، وضعیت، نقش،
  مرتب‌سازی، صفحه‌بندی، کد کوتاه نمایشی، آخرین تغییر و عملیات مشاهده/ویرایش/تغییر وضعیت.
- ایجاد و ویرایش شخص حقیقی و مشتری سازمانی با Optimistic Concurrency؛ Organization و
  نحوه آشنایی فقط از API عمومی Master Data انتخاب می‌شوند.
- Customer 360 شامل نمای کلی، تماس‌ها، نشانی‌ها، همراهان، تاریخچه رضایت، موارد مشابه و
  ورودی‌های صریح وضعیت/فعالیت/Audit است.
- تماس با نوع و برچسب، ذخیره رمزگذاری‌شده، fingerprint و مقدار ماسک‌شده؛ نمایش مقدار
  حساس فقط با Permission و یکی از دلیل‌های allowlist و Audit همان دلیل انجام می‌شود.
- نشانی با نوع، Country/City picker مبتنی بر Master Data عمومی و City FK موجود.
- همراه با جست‌وجوی Customer branch-scoped و کنترل self-reference/duplicate موجود.
- Consent با Channel، Source، Reason و Timestamp معتبر UTC ثبت می‌شود.
- تغییر وضعیت فقط پس از Confirm و با دلیل، Actor، UTC، Audit و کنترل Version انجام می‌شود.
- Duplicate Detection فقط Candidate محدود و branch-scoped می‌سازد؛ Review دستی
  confirmed-distinct یا merge-proposed ثبت می‌شود و دکمه Merge واقعی غیرفعال است.
- حالت‌های Loading، Empty، Unauthorized، Forbidden، Error، Success و Conflict از هم
  تفکیک شده‌اند و پیام عملیات از مسیر aria-live اعلام می‌شود.

## سخت‌سازی امنیتی

- Detail به‌صورت پیش‌فرض حتی برای دارنده Permission نیز ماسک می‌ماند.
- Reveal نیازمند customers.sensitive.read و Header دلیل با یکی از مقادیر
  customer-verification، support-request یا data-correction است.
- دلیل نامعتبر رد می‌شود و خطای Decryption به خطای امن و پایدار
  CUSTOMER_CONTACT_DECRYPTION_FAILED تبدیل می‌شود.
- مقدار کامل تماس هرگز وارد Audit نمی‌شود.
- خطاهای FK نامعتبر Master Data و Contact/Relationship تکراری به Code پایدار دامنه
  نگاشت می‌شوند.

## BLOCKED_FOR_CUSTOMER_002B

قابلیت‌های زیر عمداً پیاده‌سازی یا شبیه‌سازی نشده‌اند، چون Schema یا قرارداد مشترک فعلی
آن‌ها را پشتیبانی نمی‌کند:

- نام لاتین، جنسیت، یادداشت داخلی و کد مستقل کسب‌وکاری مشتری
- فیلتر نوع Customer و انتخاب تعاملی Branch در customers.v2
- Draft قبل از Create و Idempotency Key در قرارداد Mutation
- متن کامل نشانی و Policy دقیق Masking نشانی
- خواندن Status History و Customer Audit از API عمومی
- Activity Timeline بین‌ماژولی
- Merge واقعی یا Auto-merge تا بسته‌شدن DEC-OPEN-011

رکوردهای Status History و Audit در Persistence موجود ثبت می‌شوند، اما قرارداد عمومی فعلی
Endpoint خواندن آن‌ها را ندارد؛ UI این محدودیت را شفاف نشان می‌دهد و داده ساختگی نمی‌سازد.

## مرزهای تأییدشده

- Prisma Schema، Migration، Seed و Persistence: بدون تغییر
- Dependencies و pnpm-lock.yaml: بدون تغییر
- Master Data و Legal Entity: بدون تغییر
- Customer Affairs و App Shell: بدون تغییر
- packages/contracts و Root Export: بدون تغییر
- WORK_ASSIGNMENTS.md، PLANS.md و docs/PROJECT_STATUS.md: بدون تغییر
- Merge، Force Push، تغییر main/develop و حذف Source Branch: ممنوع

## کنترل‌های تحویل

- نصب frozen در شروع Task پاس شد و pnpm-lock.yaml تغییر نکرد.
- Lint کامل Monorepo پاس شد: ۶ Package دارای Script.
- Typecheck کامل Monorepo پاس شد.
- تست کامل Monorepo پاس شد: ۲۵۵ تست در ۶۷ فایل تست.
- تست‌های هدفمند Customers پاس شد: ۱۴۲ تست API و ۸۲ تست Web.
- تست Boundary جدید Customer Workspace پاس شد: ۴ تست.
- Production Build کامل Monorepo پاس شد.
- HTTP production smoke مسیر /customers پاس شد: Status 200، HTML معتبر و RTL.
- Prettier check تمام ۱۲ فایل این Task پاس شد.
- format:check کل Repository به‌دلیل Baseline قبلی ۲۰۹ فایل خارج از Scope ناموفق است؛
  هیچ‌کدام از فایل‌های CUSTOMER-002A در فهرست خطا نبود و فایل خارج از Scope اصلاح نشد.
- git diff --check و اسکن Scope، Secret و PII پاس شد.
- Prisma Schema، Migration، Seed، Persistence، Dependency، Lockfile، قرارداد مشترک،
  Master Data، Legal Entity، Customer Affairs، App Shell و فایل مرکزی تغییر نکردند.
- Dev/Production server موقت Smoke پس از کنترل متوقف شد.