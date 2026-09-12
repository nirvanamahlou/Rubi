# FINANCE-002A — Accounting and Finance Inbox

- **Computer:** PC-A
- **Branch:** `codex/pc-a-finance-core-accounting`
- **Base:** `origin/develop@4717b13`
- **Status:** READY_FOR_REVIEW / PERSISTENCE_BLOCKED
- **Date:** 2026-09-12
- **Web/API smoke ports:** 3200 / 4200
- **PR:** Draft #153 → `develop`
- **Commits:** `d513e08` (reservation)، `6de5d94` (implementation)

## هدف

تکمیل دو صفحه مستقل «حسابداری» در `/finance` و «کارتابل درخواست‌ها» در
`/finance/requests`، با دو ورودی مستقل در گروه «مالی»،
گسترش Domain/Application حسابداری و پیاده‌سازی جریان‌های قابل آزمون دریافت و پرداخت،
بدون نقض مرز ماژول‌ها یا اعلام Persistence غیرواقعی.

## وضعیت Gate و قفل‌ها

- `FINANCE-001` با PR #21 و Merge `45c107e` در `develop` موجود است.
- `DEC-OPEN-001`، `DEC-OPEN-004`، `DEC-OPEN-005` و `DEC-OPEN-016` پذیرفته شده‌اند.
- Migration/Central Docs و قراردادهای IAM/Sales/Travel نزد Task فعال رزرواسیون است.
- در این Task تغییر Prisma Schema، Migration، Seed، Permission grant، Root contract
  export، Dependency یا Lockfile مجاز نیست.
- هیچ فایل، Worktree، Branch، Process، Database یا Port متعلق به رزرواسیون تغییر نمی‌کند.

## محدوده مجاز

- مدل حساب، دوره مالی، Journal/Line، توازن، Posting و Maker/Checker در Domain/Application.
- قراردادهای versioned و سازگار Finance برای receipt verification، payment request،
  correction، rejection، completion و financial release.
- UI فارسی RTL و Responsive با دو Workspace مستقل، درخت حساب‌ها، دفاتر و کارتابل.
- Dialogهای تأیید دریافت/پرداخت با الزام حساب مقصد/مبدأ، طرف‌حساب، مبلغ Decimal، ارز،
  زمان UTC، مرجع، کارمزد، بررسی رسید، دلیل و optimistic version/idempotency.
- stateهای Loading، Empty، Error، Unauthorized، Forbidden، Conflict و Success؛ Success
  فقط برای validation محلی و هرگز به‌عنوان ثبت عملیاتی نمایش داده نمی‌شود.
- تست‌های invariant، boundary، contract و component در محدوده Finance.

## مرز Persistence

تا آزادشدن Migration lock هیچ Repository، Controller فعال، in-memory persistence،
Receipt/Payment/Journal ثبت‌شده یا Event منتشرشده ساخته نمی‌شود. UI داده نمونه را با برچسب
صریح Preview نمایش می‌دهد و mutation صرفاً validation می‌شود. قابلیت‌های نیازمند تراکنش،
Audit پایدار، Outbox/Inbox و اسناد Documents در گزارش نهایی `BLOCKED_BY_MIGRATION_LOCK`
می‌مانند و به‌عنوان تکمیل‌شده اعلام نمی‌شوند.

## قرارداد Producer / Consumer

- Sales → Finance: `finance.receipt-verification-request.v1`
- Finance → Sales: `finance.receipt-confirmed.v1`، `finance.receipt-rejected.v1` و
  `finance.financial-release-changed.v1`
- Procurement/Reservations → Finance: `finance.payment-request.v1`
- Finance → producer: `finance.payment-approved.v1`، `finance.payment-completed.v1`،
  `finance.payment-rejected.v1` و `finance.correction-requested.v1`
- Finance internal source: `finance.accounting-source.v1`

همه پیام‌ها envelope نسخه‌دار، Reference/Snapshot حداقلی و بدون PII غیرضروری دارند.
افزودن فیلد فقط به‌صورت backward-compatible انجام می‌شود؛ حذف/تغییر معنای فیلد نیازمند
نسخه جدید است. هیچ مصرف‌کننده‌ای جدول داخلی ماژول دیگر را Query نمی‌کند.

## خارج از محدوده این Slice

- Persistence و API عملیاتی تا Handoff قفل Migration
- Bank reconciliation، انتقال، چک، Invoice/AR/AP، بودجه، دارایی ثابت و گزارش رسمی
- PDF/Excel واقعی تا اتصال عمومی Documents/Exports
- نرخ FX authoritative، اتصال بانکی، Payment Gateway و هر داده واقعی مالی
- Merge یا تغییر مستقیم `develop`/`main`

## Quality Gate

- تست ساختار حساب و جلوگیری از حذف حساب دارای گردش
- توازن Journal، ممنوعیت Posting دوره بسته و Maker/Checker
- الزام حساب مقصد Receipt و حساب مبدأ/طرف‌حساب Payment
- دلیل اجباری Reject/Correction، Idempotency و optimistic conflict
- Allocation بیش از مبلغ، permission و boundary import
- Web/API lint، typecheck، targeted tests و production build
- Smoke روی Web 3200 و API 4200 بدون دست‌زدن به listenerهای دیگر
- `git diff --check` و scan محدوده، Secret، PII و Card/CVV

## نتیجه پیاده‌سازی

- `/finance` دو کارت اصلی و واضح «حسابداری» و «مالی / کارتابل درخواست‌ها» دارد.
- Workspace قبلی FINANCE-001 حذف نشده و زیر فضای حسابداری حفظ شده است.
- درخت چهارسطحی حساب و جزئیات nature، posting، currency، active و مانده محاسباتی
  نمایش داده می‌شود؛ ایجاد حساب تا Migration واقعی عمداً غیرفعال است.
- Domain حسابداری hierarchy، حذف حساب دارای گردش، دوره بسته، Maker/Checker، optimistic
  version، allocation، receipt destination، payment source/party، UTC و دلیل رد/اصلاح
  را enforce می‌کند.
- کارتابل هشت KPI، جست‌وجو/وضعیت، کارت Responsive، Dialog دریافت/پرداخت، کنترل فایل
  رسید، کارمزد و tracking دارد. Idempotency و Version در state داخلی حفظ می‌شوند و
  به‌عنوان فیلد فنی به کاربر نمایش داده نمی‌شوند. نتیجه فقط validation محلی است.
- قراردادهای `finance.*.v1` برای درخواست/نتیجه Receipt و Payment و Accounting Source
  افزایشی و backward-compatible منتشر شدند؛ هیچ Root export یا producer داخلی تغییر نکرد.

## نتیجه کنترل کیفیت

- Contracts: ۶۴ تست در ۱۴ فایل، همگی پاس؛ lint، typecheck و build پاس.
- API Finance: ۱۹ تست هدفمند در ۳ فایل، همگی پاس؛ lint، typecheck و production build پاس.
- Web Finance: ۱۴ تست هدفمند در ۳ فایل، همگی پاس؛ lint، typecheck و production build
  پاس؛ `/finance` در build شامل ۴۰ route تولید شد.
- Smoke: Web روی 3200، redirect احراز هویت `/finance` برابر 307 و `/login` برابر 200؛
  API روی 4200 و `/api/v1/health` برابر 200. فقط Processهای همین Task متوقف شدند.
- `git diff --check` پاس؛ Prisma Schema/Migration/Seed، Dependency/Lockfile، فایل‌های
  رزرواسیون و داده عملیاتی بدون تغییر.

## موارد باقی‌مانده و Handoff

- Migration lock و Central Docs/Shared IAM-Sales-Travel contracts نزد Task رزرواسیون
  باقی مانده و به این Task منتقل نشده است.
- پس از آزادسازی صریح قفل، یک Task مستقل Persistence باید Schema/Migration افزایشی،
  repository تراکنشی، Audit، Inbox/Outbox، Permission seed و Controller واقعی را بسازد.
- همان Task باید migration خالی PostgreSQL، seed دوباره‌پذیر، تست هم‌زمانی اتمیک و
  Smoke authenticated Receipt/Payment/Posting را انجام دهد؛ این PR نباید پیش از آن
  به‌عنوان Finance عملیاتی معرفی شود.

## پیگیری فرم قرارداد و پرداخت جزئی — 2026-09-12

- نام قرارداد، خدمت، مشتری/کارگزار، مبلغ تعهد، پرداخت‌های تأییدشده قبلی و مانده جاری
  هم روی کارت و هم در Dialog قابل مشاهده‌اند.
- حساب مقصد دریافت و حساب مبدأ پرداخت مستقیماً از حساب‌های Preview کدینگ انتخاب می‌شود؛
  فقط حساب فعال، Detail، قابل Posting و هم‌ارز درخواست در فهرست می‌آید.
- پرداخت این نوبت می‌تواند چند ردیف مبلغ و شماره پیگیری داشته باشد؛ افزودن/حذف ردیف،
  جمع Decimal بدون تبدیل به Number، مانده بعد از عملیات و منع بیش‌پرداخت پیاده شد.
- Browser هر دو Dialog، انتخاب حساب EUR و افزودن/حذف ردیف پرداخت را تأیید کرد. ۳۲ تست
  هدفمند Web، typecheck، lint محدود و Production Build با ۴۱ مسیر موفق‌اند.
- این اتصال فقط مدل و validation فرم است. ایجاد Receipt/Payment/Journal و تغییر مانده
  واقعی تا Persistence تراکنشی، Audit، Outbox و Migration مستقل همچنان مسدود است.
- Commit پیگیری `70fde9b` روی origin Push و در Draft PR #153 ثبت شد.

## پیگیری فیش همراه و توضیح اختیاری — 2026-09-12

- توضیح مالی دیگر required نیست و متن خالی validation دریافت/پرداخت را رد نمی‌کند.
- هر درخواست می‌تواند Snapshot مدارک همراه با reference، نام فایل، نوع، MIME، حجم، زمان
  UTC و وضعیت Scan داشته باشد. Dialog همان metadata را نمایش می‌دهد؛ اگر مدرکی نرسیده
  باشد، حالت خالی صریح دیده می‌شود.
- باینری، signed URL یا فایل جعلی در Finance ساخته یا کپی نمی‌شود. نمایش/دانلود واقعی
  فایل در Phase Persistence باید از Public Contract مجاز Documents و کنترل Scan/Permission
  استفاده کند.
- ۳۳ تست هدفمند Web، typecheck، lint محدود و Production Build با ۴۱ مسیر موفق‌اند.
  Browser نمایش کارت فیش، metadata/Scan، حالت label اختیاری و چیدمان Responsive را
  تأیید کرد؛ Console خطای مرتبط نداشت.
