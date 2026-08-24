# FINANCE-001 — Foundation مالی و حسابداری عملیاتی

- **Computer:** PC-A
- **Branch:** codex/pc-a-finance-foundation
- **Base:** a165923
- **Status:** IN_PROGRESS
- **Date:** 2026-08-24
- **Persistence:** مسدود با Decision Gate

## هدف

ساخت Foundation حرفه‌ای Sub-ledger عملیاتی دوطرفه برای CRM گردشگری، همراه UI فارسی
و RTL، قرارداد عمومی versioned، Domain/Application Port و تست؛ بدون Prisma، Migration،
Repository، posting، FX authoritative، Tax/Recognition یا workflow اجرایی.

## Decision Gate

چهار Proposal زیر ثبت شده‌اند و هنوز Gate را باز نمی‌کنند:

- [DEC-OPEN-001](../decisions/DEC-OPEN-001-finance-ledger-boundary.md)
- [DEC-OPEN-004](../decisions/DEC-OPEN-004-money-fx-tax-recognition.md)
- [DEC-OPEN-005](../decisions/DEC-OPEN-005-finance-approval-matrix.md)
- [DEC-OPEN-016](../decisions/DEC-OPEN-016-financial-release-policy.md)

تا ACCEPTED شدن همه موارد، Schema/Migration و قابلیت اجرایی ممنوع می‌ماند.

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

- Migration Owner: رزروشده ولی غیرفعال تا Decision Gate
- Dependency/Lockfile Owner: مشروط؛ در این Task dependency لازم نشد
- Finance shared-contract/root export: PC-A/FINANCE-001
- Central status docs: PC-A/FINANCE-001

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
