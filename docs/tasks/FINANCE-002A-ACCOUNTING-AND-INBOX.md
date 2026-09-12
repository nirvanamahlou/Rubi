# FINANCE-002A — Accounting and Finance Inbox

- **Computer:** PC-A
- **Branch:** `codex/pc-a-finance-core-accounting`
- **Base:** `origin/develop@4717b13`
- **Status:** IN_PROGRESS
- **Date:** 2026-09-12
- **Web/API smoke ports:** 3200 / 4200

## هدف

تکمیل ساختار دو فضای مستقل «حسابداری» و «مالی / کارتابل درخواست‌ها» در `/finance`،
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
