# DEC-OPEN-001 — مرز Sub-ledger عملیاتی و حسابداری قانونی

- **Status:** PROPOSED
- **Owner:** مالک مالی و مالک محصول
- **Proposer:** PC-A/FINANCE-001
- **Date:** 2026-08-24
- **Gate:** تا ACCEPTED شدن، Prisma Model، Migration و posting اجرایی ممنوع است.

## Context

Rubi باید دریافت، پرداخت، فاکتور، تسویه، چک، مانده و سود سفر را با traceability کامل
نگه دارد. در مقابل، دفاتر و اظهارهای قانونی ممکن است در نرم‌افزار حسابداری مستقل باشند.
ثبت صرف سند تجاری، مانده معتبر نمی‌سازد و ورود زودهنگام به حسابداری قانونی نیز دامنه
مالیات، شماره‌گذاری و بستن رسمی را بدون شناخت کافی وارد CRM می‌کند.

## Options

1. فقط سند تجاری و Export خام؛ ساده ولی بدون دفتر دوطرفه معتبر.
2. Sub-ledger دوطرفه عملیاتی همراه Posting Batch برای حسابداری قانونی.
3. حسابداری قانونی کامل در Rubi؛ خارج از شناخت و Scope فعلی.

## Proposed decision

گزینه ۲ پیشنهاد می‌شود:

- Rubi مالک Sub-ledger عملیاتی و دفتر دوطرفه داخلی CRM است.
- Journal فقط با توازن Debit/Credit در ارز پایه قابل پیشنهاد برای posting است؛ posted
  immutable و اصلاح فقط با reversal/new entry خواهد بود.
- مانده، مطالبات، بدهی و سود از خطوط معتبر محاسبه می‌شوند و فیلد دستی ندارند.
- نرم‌افزار بیرونی مالک دفاتر، شماره، اظهار/مالیات، بستن و صورت‌های قانونی و payroll
  قانونی باقی می‌ماند.
- Posting Batch پیشنهادی versioned و idempotent است و Legal Entity، Fiscal Period،
  Base Currency، mapping version، source references، totals، checksum و trace دارد.
- وضعیت پیشنهادی Batch: DRAFT، VALIDATED، EXPORTED، ACCEPTED، REJECTED و SUPERSEDED.
- Connector فقط acknowledgement، external reference و خطای redacted برمی‌گرداند و
  اجازه تغییر مستقیم Journal داخلی ندارد.
- نگاشت حساب داخلی به قانونی versioned و خارج از Journal immutable نگه داشته می‌شود.

## Rationale

این انتخاب کنترل دوطرفه و گزارش معتبر عملیاتی را فراهم و هم‌زمان از تبدیل Rubi به ERP
قانونی بدون نیازمندی تاییدشده جلوگیری می‌کند. Posting Batch مرز ضدفساد دو مدل است.

## Consequences

- Account/Journal، balance، reversal، idempotency، reconciliation و audit لازم‌اند.
- قبول Batch به معنی قانونی‌شدن دفتر داخلی یا انتقال مالکیت داده نیست.
- خطای Connector نباید Journal posted یا عملیات سفر را rollback کند.
- Tax/Recognition و mapping اجرایی تا تصمیم مستقل مسدود می‌مانند.

## Change and migration path

پس از تایید مالک مالی، ADR پذیرفته‌شده این Proposal را supersede می‌کند. قرارداد Connector،
mapping و retention جداگانه تایید و فقط سپس Schema/Migration افزایشی طراحی می‌شوند.
