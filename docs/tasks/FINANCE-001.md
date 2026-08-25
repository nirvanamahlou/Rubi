# FINANCE-001 — Foundation مالی و حسابداری عملیاتی

- **Computer:** PC-A
- **Branch:** codex/pc-a-finance-foundation
- **Base:** a165923
- **Status:** DONE/MERGED
- **Date:** 2026-08-24
- **Persistence:** موکول به Task مستقل Phase B پس از Merge PR #21
- **PR:** #21 → develop؛ Merge `45c107e471d53d1c724303de02ba01a5e0e16b2a`
- **Schema/Migration/Dependency:** بدون تغییر

## هدف

ساخت Foundation حرفه‌ای Sub-ledger عملیاتی دوطرفه برای CRM گردشگری، همراه UI فارسی
و RTL، قرارداد عمومی versioned، Domain/Application Port و تست؛ بدون Prisma، Migration،
Repository، posting، FX authoritative، Tax/Recognition یا workflow اجرایی.

## Decision Gate

چهار Decision زیر با تأیید رسمی مالک محصول و کسب‌وکار در 2026-08-24 پذیرفته شدند:

- [DEC-OPEN-001](../decisions/DEC-OPEN-001-finance-ledger-boundary.md)
- [DEC-OPEN-004](../decisions/DEC-OPEN-004-money-fx-tax-recognition.md)
- [DEC-OPEN-005](../decisions/DEC-OPEN-005-finance-approval-matrix.md)
- [DEC-OPEN-016](../decisions/DEC-OPEN-016-financial-release-policy.md)

Gate معماری رفع شده است، اما FINANCE-001 همان Phase A بدون Persistence باقی می‌ماند.
پس از Merge PR #21، ایجاد Prisma Schema و Migration افزایشی مالی فقط در Task مستقل
Phase B، با رزرو مجدد قفل‌ها و اجرای Migration gate، مجاز خواهد بود.
## محدوده پیاده‌سازی

### Domain و Application

- Money و Decimal string بدون number شناور
- Currency Policy، Rounding و Exchange Rate snapshot پیشنهادی
- Account، Party Account، Dimension، Journal و Journal Line
- Receivable، Payable، Receipt، Payment، Transfer، Invoice و Settlement
- Check lifecycle دریافتی/پرداختی
- Approval proposal و Maker/Checker
- Financial Release policy سه‌گانه
- Fiscal Period، Budget و Closing State
- Permission Matrix deny-by-default
- expectedVersion و idempotency contract
- Query/Command/Configuration/Integration/Audit/Clock ports بدون implementation

### قرارداد عمومی

نسخه finance.v1-proposal شامل Money، Public Reference، Journal Draft، Approval و Release
request، event envelope و eventهای زیر است:

- ورودی از Sales: sales.contract.activated/amended v1
- ورودی از Reservations: reservation.travel_document.issued v1
- ورودی از Purchases: purchase.invoice_approved v1
- ورودی حداقلی Customers: customer.reference.resolved v1
- ورودی حداقلی HR: employee.payroll_input_approved v1
- خروجی Finance: finance.payment.confirmed، finance.financial_release.changed و
  finance.check.due_soon نسخه ۱

Finance هیچ import داخلی یا query مستقیم به Customers، Sales، Reservations، Procurement،
IAM، HR یا Master Data ندارد.

### UI مسیر /finance

Workspace اصلی شامل پنج Tab داشبورد، ۳۰ بخش، عملیات، آزادسازی و گزارش‌ها است. ۳۰ قابلیت
در شش گروه داخلی قابل جست‌وجو هستند و منوی اصلی ۱۷ بخشی تغییر نمی‌کند.

پوشش UI:

- کارت مانده بانک، صندوق، دریافتنی، پرداختنی، چک نزدیک سررسید و سود قرارداد
- فیلتر شعبه، دوره، ارز، وضعیت و طرف‌حساب
- مرتب‌سازی و Pagination
- جدول/card responsive
- فرم Create/View/Edit برای Journal، Receipt، Payment، Check، Invoice و Release
- Loading، Empty، Error، Forbidden و Preview
- سود قرارداد و تفکیک هزینه‌های گردشگری
- Timeline مالی و Audit intent
- route پیشنهادی Excel/PDF بدون ساخت فایل

تمام داده‌ها synthetic و با برچسب «نمونه طراحی و ذخیره‌نشده» هستند.

## قفل‌ها

- Migration Owner: `RELEASED` پس از Merge PR #21 و اثبات نبود FINANCE-002
- Dependency/Lockfile Owner: `RELEASED`؛ در این Task dependency لازم نشد
- Finance shared-contract/root export: مرز دامنه Finance و بدون انتقال مالکیت
- Central status docs: `RELEASED` و منتقل‌شده به PC-A/LEGAL-ENTITY-CONTEXT-001

دلیل انتقال: `FINANCE-001 merged via PR #21 and no active FINANCE-002 task exists`.

## خارج از Scope

- هر Prisma Model، Migration، Seed یا repository مالی
- Controller/API فعال و mutation بین‌ماژولی
- posting، rate authoritative، Tax/Recognition و workflow اجرایی
- فایل Excel/PDF واقعی یا جعلی
- credential، شماره حساب/کارت/CVV، PII مسافر یا داده مالی واقعی
- Merge، Force Push یا تغییر مستقیم develop/main

## Quality gate

- Money/Decimal/Rounding
- Journal balance و approval prerequisite
- Permission و Maker/Checker
- Check state transitions
- Financial Release basis و manager exception
- expectedVersion و idempotency
- public contract و boundary tests
- Web component/model tests
- lint، typecheck، test، build، Markdown links، scope/secret/PII و git diff check

## نتیجه Quality Gate

- lint کل Monorepo: پاس
- typecheck کل Monorepo: پاس
- test کل Monorepo: ۱۷۲ تست در ۵۱ فایل، همگی پاس
- Production Build: پاس؛ route استاتیک /finance تولید شد
- Markdown links و git diff check: پاس
- Prisma Model، Migration، Seed، Dependency و Lockfile: بدون تغییر
- browser visual QA: ابزار Browser به‌دلیل ACL محیط Windows اجرا نشد و route احرازنشده
  به login redirect شد؛ HTTP route و Production Build تایید شدند.
- dev server موقت Rubi روی پورت ۳۱۰۰ متوقف شد.
