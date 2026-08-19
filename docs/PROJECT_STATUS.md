# وضعیت پروژه

آخرین به‌روزرسانی: 2026-08-19 — PC-A

## خلاصه

- مرحله جاری: **مرحله 1 — Bootstrap و طراحی**
- وضعیت: **Bootstrap مستندات آماده Review؛ بدون کد اجرایی و بدون Migration**
- Repository: `Rubi`، Remote با نام `origin`
- Base: `origin/main` در Commit `bcfce0e` (`Initial commit`)
- شاخه فعال Bootstrap: `codex/pc-a-bootstrap-docs`
- محیط مسئول: `COMPUTER_ID=PC-A`

## تکمیل‌شده در این مرحله

- اتصال پوشه کاری به Remote موجود، بدون حذف/جایگزینی Remote
- استخراج نیازمندی‌های پرامپت مادر به PRD دائمی
- معماری Modular Monolith/Monorepo، مرز ماژول‌ها و جریان‌های حساس
- ERD، Data Dictionary و KPI Dictionary اولیه
- API، Security، Reporting، Integration و Deployment conventions
- قرارداد همکاری PC-A/PC-B، backlog و assignments

## هنوز انجام نشده

- هیچ application/package، dependency، lockfile، Docker service یا CI ساخته نشده است.
- Prisma schema، Migration و Seed وجود ندارد.
- `develop` هنوز ایجاد نشده و هیچ merge/deploy انجام نشده است.
- تصمیم‌های P0 بازِ `docs/DECISIONS.md` نیازمند پاسخ مالک محصول هستند.

## کنترل کیفیت این مرحله

- `git diff --check`: پاس (بدون خطای whitespace؛ فقط هشدار معمول LF/CRLF ویندوز)
- وجود همه فایل‌های الزامی: پاس
- resolution همه لینک‌های محلی Markdown: پاس
- تعادل code fenceها و بلوک‌های Mermaid: پاس
- تست نرم‌افزاری/build/migration: قابل اجرا نیست، چون این شاخه فقط مستندات است.

## Handoff به PC-B

1. `origin` را بررسی و `git fetch --prune origin` اجرا کند.
2. شاخه `codex/pc-a-bootstrap-docs` و همه اسناد `docs/` را review کند.
3. تصمیم‌های باز P0 را با مالک محصول نهایی کند؛ حدس در حوزه مالی/Provider نزند.
4. پیش از Foundation یک Work ID جدا و شاخه `codex/pc-b-<task>` رزرو کند.
5. برای اصلاحات Review، Work ID مستقل یا هماهنگی صریح با PC-A ثبت کند.

## ریسک‌ها و تصمیم‌های باز

- دامنه دقیق حسابداری عملیاتی و integration با حسابداری قانونی هنوز نهایی نیست.
- Providerها، Payment Gatewayها و مشخصات دو سایت اعلام نشده‌اند.
- محل میزبانی، RPO/RTO، retention و الزامات حقوقی PII نیازمند تایید هستند.
- سیاست مالی ارز، rounding، مالیات و شماره‌گذاری اسناد باید قبل از Migration تایید شود.
