# DEC-OPEN-004 — ارز، Decimal، Rounding، FX، Tax و Recognition

- **Status:** PROPOSED
- **Owner:** مالک مالی با تایید مالک محصول/حقوقی
- **Proposer:** PC-A/FINANCE-001
- **Date:** 2026-08-24
- **Gate:** تا ACCEPTED شدن، FX authoritative، Tax/Recognition اجرایی و Migration ممنوع است.

## Context

فروش و خرید سفر می‌تواند با IRR، USD، EUR، TRY و AED باشد. خطای precision، ابهام
تومان/ریال، نرخ بی‌منبع یا قانون hardcoded مستقیماً مانده و سود را خراب می‌کند. هر
شخصیت حقوقی نیز ممکن است ارز پایه متفاوتی داشته باشد.

## Options

1. IRR ثابت و تومان در Storage؛ ساده ولی مبهم و تک‌ارزی.
2. number شناور و rounding سراسری؛ سریع ولی برای پول غیرقابل اتکا.
3. Decimal + Currency Code + Policy versioned برای هر ارز و Legal Entity.

## Proposed decision

گزینه ۳ پیشنهاد می‌شود:

- ارز پایه برای هر Legal Entity تنظیم‌پذیر و مقدار اولیه پیشنهادی IRR است.
- مقدار رسمی همیشه Currency Code دارد. تومان فقط Presentation است و canonical نیست.
- ارزهای اولیه IRR، USD، EUR، TRY و AED پشتیبانی می‌شوند.
- مبلغ و نرخ Decimal canonical هستند؛ number شناور برای amount/rate ممنوع است.
- policy اولیه پیشنهادی: scale حسابداری IRR برابر ۰ و ارزهای دیگر برابر ۲؛ نرخ FX تا
  ۱۸ رقم اعشار؛ IRR با HALF_UP و ارزهای دو اعشاری با HALF_EVEN.
- این policy پیش از ACCEPTED شدن authoritative نیست و Schema را تثبیت نمی‌کند.
- Exchange Rate شامل base/quote، rate، source، validAt UTC، وضعیت DRAFT/APPROVED،
  approver و approval time است. Draft منبع posting/report رسمی نیست.
- نرخ و rounding policy روی سند/line snapshot می‌شوند و اسناد قبلی بازنویسی نمی‌شوند.
- Tax و Revenue Recognition از Rule Reference versioned و effective-dated استفاده
  می‌کنند؛ نرخ، trigger یا فرمول در کد hardcode نمی‌شود.
- triggerهای پیشنهادی Recognition: activation قرارداد، delivery خدمت، پایان سفر و
  manual approval کنترل‌شده.

## Rationale

Decimal و Currency Code از float و ابهام ریال/تومان جلوگیری می‌کنند. Snapshot نرخ و
Rule Reference محاسبه را قابل بازتولید و تغییر قانون را بدون بازنویسی تاریخچه ممکن می‌کند.

## Consequences

- UI مبلغ رسمی و ارز را کنار هم نشان می‌دهد و تومان را صریح برچسب می‌زند.
- جمع ارزهای متفاوت بدون تبدیل snapshot ممنوع است.
- هر Legal Entity در هر بازه فقط یک ارز پایه موثر دارد.
- source trust، stale-rate و Recognition trigger باید قبل از اجرا تعیین شوند.

## Change and migration path

مالک مالی scale/rounding، منابع نرخ، stale window، Tax و Recognition را تایید می‌کند؛
سپس ADR پذیرفته‌شده، config contract و Migration افزایشی طراحی می‌شوند. تغییر آینده
effective-dated است و سند تاریخی snapshot قبلی را حفظ می‌کند.
