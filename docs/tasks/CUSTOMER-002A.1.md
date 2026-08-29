# CUSTOMER-002A.1 — Timeline, Filters and Privacy UX

- **Computer:** PC-A
- **Owner:** PC-A
- **Branch:** `codex/pc-a-customer-next`
- **Parent Branch:** `codex/pc-a-customer-operations`
- **Parent HEAD:** `5e9503d0b09560ed266aeaaa800d2fe701d1f712`
- **Parent PR:** #26
- **Started:** 2026-08-27
- **Status:** READY_FOR_REVIEW
- **Initial PR Base:** `codex/pc-a-customer-operations`
- **Draft Stacked PR:** #27
- **Implementation Commit:** `144be97`

## محدوده رزروشده

- API، Repository، Service و تست‌های `apps/api/src/customers/**`
- UI، Client و تست‌های `apps/web/src/modules/customers/**`
- قرارداد versioned ماژول Customers در `packages/contracts/src/customers/**` بدون تغییر Root Export
- اسناد همین Work Item و ردیف‌های وضعیت/تخصیص مرتبط

## قفل‌ها و ممنوعیت‌ها

- Migration Lock در اختیار `PC-B/MASTER-003` است.
- Prisma Schema، Migration، Seed، Dependency، manifest و Lockfile تغییر نمی‌کنند.
- هیچ فایل Master Data، Customer Affairs، Sales، Reservations یا Legal Entity تغییر نمی‌کند.
- Master Data فقط از Public API موجود مصرف می‌شود.
- Merge واقعی مشتری تا بسته‌شدن `DEC-OPEN-011` ممنوع است.

## هدف Slice

- تکمیل فیلترهای قابل پشتیبانی با مدل فعلی و حفظ state فیلتر هنگام بازگشت
- ارائه Read-only Status History و Customers-only Activity/Audit Timeline واقعی با Permission و Branch Scope
- تکمیل Privacy UX شامل masking پیش‌فرض، reveal دلیل‌دار و Audit‌شده، auto-remask و پاک‌سازی مقدار حساس
- تکمیل Customer 360 امن، فارسی، RTL، Responsive و دارای Loading/Empty/Error/Forbidden/Conflict/Retry

## BLOCKED_FOR_CUSTOMER_002B

موارد زیر با Persistence فعلی قابل تکمیل نیستند و هیچ‌کدام شبیه‌سازی نشده‌اند:

- نام لاتین: ستون و قرارداد پایدار ندارد.
- جنسیت: enum/ستون و تصمیم داده‌ای ندارد.
- یادداشت داخلی: aggregate، permission، retention و جدول/ستون ندارد.
- کد مستقل کسب‌وکاری: sequence/unique policy و ستون ندارد.
- Idempotency برای Mutationها: storage، fingerprint و unique scope ندارد.
- Address Masking کامل: Schema فقط `label` و `cityId` دارد و ciphertext/fingerprint/policy ندارد.
- Timeline بین‌ماژولی تماس عملیاتی/Ticket/Sales/Reservation: تا انتشار Public API/Event از ماژول مالک مسدود است و query مستقیم ممنوع می‌ماند.
- نرخ بازگشت و آخرین تاریخ خرید: Sales هنوز Public Customer Purchase Summary با purchase count/last purchase UTC منتشر نکرده است؛ مقدار ساختگی یا query مستقیم Sales ممنوع است.
- فیلتر شرکت «نیایش سیر سحر / جهان باستان»: این دو رکورد Legal Entity هستند و Customer در Schema فعلی FK شرکت صادرکننده ندارد؛ Branch Scope امنیتی نیز نباید به Legal Entity تبدیل یا جعل شود.
- مقدار رابطه مستقل `customer` برای مسافر: enum فعلی فقط `family/companion/guardian/dependent` دارد؛ UI از `companion` با عنوان «همراه مشتری» به‌عنوان پیش‌فرض معتبر استفاده می‌کند.
- دریافتی قرارداد مشتری: فقط قرارداد `receipt.create` وجود دارد و Public Finance/Sales Read Contract مبتنی بر Customer ID منتشر نشده است.
- تعداد خرید و تاریخچه سفر مشتری/مسافر: Public Summary Contract از Sales/Reservations وجود ندارد و Query مستقیم جدول‌های آن ماژول‌ها ممنوع است.
- خروجی گروهی تماس خام: به Permission اختصاصی Bulk Export، مقصد و دلیل ثبت‌شده و Audit گروهی نیاز دارد؛ Sensitive Reveal تک‌رکوردی نباید برای دورزدن این کنترل استفاده شود.
- مدارک سفر/هویتی شامل پاسپورت، شماره، کشور صادرکننده، تاریخ صدور/انقضا، ویزا و هشدار انقضا: مدل امن Persistence در Schema فعلی Customers وجود ندارد.
- نام و نام خانوادگی انگلیسی مطابق پاسپورت در مدل آینده مدارک سفر اجباری است؛ این مقادیر Restricted هستند و تا رفع Gate امنیت/قفل Migration ذخیره نمی‌شوند.
- پرونده ۳۶۰ بین‌ماژولی شامل درخواست، قرارداد، خدمت، بلیط، واچر، بیمه‌نامه، پرداخت، چک، تیکت و فایل: تا انتشار Customer-scoped Public Read Contract از ماژول مالک، فقط وضعیت اتصال نمایش داده می‌شود.
- Merge واقعی/Auto-merge: تا بسته‌شدن `DEC-OPEN-011` ممنوع است.

## قابلیت‌های تکمیل‌شده

- فهرست با search، نوع شخص/سازمان، وضعیت، نقش، Branch مجاز، نحوه آشنایی، بازه ایجاد/ویرایش، Sort Allowlist، جهت sort و pagination واقعی.
- Dashboard KPI با تعداد مشتری حقیقی، تعداد مسافر و مشتری جدید سه ماه اخیر از همان where فیلترشده و Branch Scope واقعی؛ نرخ بازگشت تا قرارداد Sales صریحاً unavailable است.
- ایجاد مشتری جدید فقط Person/Customer است؛ همراهان Person/Passenger ساخته می‌شوند و در صورت انتخاب سازمان از Public Master Data، `organizationId` واقعی دریافت می‌کنند.
- فرم ایجاد هر مسافر بخش «اطلاعات تکمیلی» دارد و تاریخ تولد، تلفن، ایمیل، سازمان و رابطه را با Persistence فعلی واقعاً ثبت می‌کند؛ ایمیل و تلفن در نمایش عادی Masked می‌مانند.
- ورود XLSX بزرگ نشست منقضی را یک‌بار از Refresh Cookie تمدید و درخواست را Retry می‌کند، پیشرفت ردیف‌ها را نشان می‌دهد و مقدار نامعتبر ستون‌های اختیاری مانند ایمیل را بدون حذف کل مشتری گزارش/نادیده می‌گیرد.
- همه ورودی‌های تاریخ Customers از کنترل آبی مشترک با سوییچ شمسی/میلادی استفاده و همچنان ISO date را به API ارسال می‌کنند.
- Branch filter فقط در دامنه `actor.branchIds` پذیرفته می‌شود و tampering با 403 رد می‌شود.
- فیلترهای غیرحساس و Deep Link مبتنی بر UUID/tab در URL می‌مانند؛ search احتمالی PII فقط در حافظه صفحه است.
- Read-only Status History با from/to، actor، reason code، UTC، Permission و Branch Scope.
- Activity Timeline فقط از Audit واقعی Customers برای create/update/contact/address/companion/consent/status/duplicate/sensitive-view.
- Audit API حداقلی با `customers.read + iam.audit.read`؛ snapshotها از query خوانده یا به Client برگردانده نمی‌شوند.
- تماس پیش‌فرض masked، reveal فقط با permission و reason allowlist، Audit، refresh timeline و auto-remask پس از ۶۰ ثانیه/blur/hidden/تغییر tab.
- همه requestهای Customers با `cache: no-store` و GETهای حساس با `Cache-Control: private, no-store` پاسخ می‌گیرند.
- Customer 360 فارسی/RTL/Responsive با Deep Link امن، tab فعال، Skeleton، Empty، Error/Retry، Forbidden و Conflict موجود.
- خروجی صفحه فیلترشده با فرمت واقعی XLSX و بدون اطلاعات تماس؛ ورود گروهی XLSX با قالب دانلودی که فقط ستون «نام مشتری» را اجباری می‌کند.
- تب «پرونده ۳۶۰ درجه» با فهرست کامل مدارک سفر، سوابق تجاری/مالی/پشتیبانی/اسناد و مسیر Timeline؛ هر بخش فاقد قرارداد عمومی بدون داده ساختگی با وضعیت اتصال مشخص نمایش داده می‌شود.
- نام هر شخص در فهرست، کنترل Keyboard-accessible برای بازکردن همان پرونده ۳۶۰ است و عنوان پرونده براساس نقش مشتری، مسافر یا هر دو نمایش داده می‌شود.
- قرارداد `customers.v2` فقط با extension اختیاری و backward-compatible توسعه یافت؛ Customer Affairs بدون تغییر باقی ماند.

## کنترل کیفیت

- Frozen install: پاس؛ lockfile بدون تغییر.
- API Customers: ۵۲ تست در ۸ فایل، پاس.
- Web Customers: ۱۴ تست در ۳ فایل، پاس.
- Contract tests: ۱۵ تست در ۶ فایل، پاس.
- lint کامل: ۶ package دارای script، پاس.
- typecheck کامل: ۹ task، پاس.
- تست کامل: ۲۶۹ تست در ۶۷ فایل، پاس.
- Production Build: ۶ task، پاس؛ route `/customers` تولید شد.
- Smoke احراز‌شده `/customers`: HTTP 200، RTL و عنوان معتبر، بدون redirect به login.
- `git diff --check`، scoped Prettier، Secret scan و Production Privacy scan: پاس.
- Prisma Schema/Migration/Seed، Dependency/Lockfile و همه فایل‌های Master Data: بدون تغییر.

## قانون Merge

PR #27 به PR #26 وابسته است و پیش از آن Merge نمی‌شود. پس از Merge والد، Base از
`codex/pc-a-customer-operations` به `develop` تغییر می‌کند و Gateهای affected دوباره
اجرا می‌شوند. Source Branch حذف و Force Push نمی‌شود.
