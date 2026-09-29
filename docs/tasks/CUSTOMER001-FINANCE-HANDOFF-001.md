# CUSTOMER001-FINANCE-HANDOFF-001 — تحویل CUSTOMER-001 به FINANCE-001

- **Computer:** PC-A
- **Branch:** `codex/pc-a-customer-finance-handoff`
- **Base:** `7d0a4f42e978b468263efdc83f780fa656fbd613`
- **Status:** READY_FOR_REVIEW
- **Type:** فقط مستندات؛ بدون کد، Schema، Migration، Dependency یا Lockfile

## Merge تاییدشده

- PR شماره ۱۹ با Source HEAD `19cb597cd9c4137021bc53e3f85d4cd682de51de` و
  Merge Commit `7d0a4f42e978b468263efdc83f780fa656fbd613` وارد `develop` شد.
- `CUSTOMER-001 Phase B` برابر `DONE/MERGED` است؛ Migration اصلی آن immutable باقی
  مانده و Migration سخت‌سازی افزایشی با migration gate موفق ادغام شده است.
- قرارداد عمومی `customers.v2` و consumerهای فعلی پایدارند و این Handoff آن‌ها را
  بازنویسی یا به Finance منتقل نمی‌کند.

## قفل‌های آزادشده از CUSTOMER-001

- Migration Owner
- Dependency/Lockfile Owner؛ CUSTOMER-001 بدون تغییر dependency یا lockfile ادغام شد
- Customer shared-contract و root export
- Central Sprint status docs

مالکیت PC-A/CUSTOMER-001 بر چهار قفل بالا با Merge PR #19 و این Handoff پایان می‌یابد.
تاریخچه Migrationهای Customer و قرارداد `customers.v2` همچنان immutable و تحت مرز
ماژول Customers باقی می‌مانند.

## قفل‌های رزروشده برای PC-A/FINANCE-001

- Migration Owner برای Prisma و Migrationهای Finance، مشروط به عبور از Decision Gate
- Dependency/Lockfile Owner فقط پس از ثبت dependency، فایل دقیق و دلیل واقعی
- Finance shared-contract و root export در `packages/contracts/src/finance/**`
- Central Sprint status docs شامل `WORK_ASSIGNMENTS.md`، `PLANS.md` و
  `docs/PROJECT_STATUS.md`

رزرو Migration مجوز ایجاد Schema نیست. تا حل و ثبت تصمیم‌های P0، این قفل فقط از
تعارض مالکیت جلوگیری می‌کند و هیچ Migration مالی نباید ساخته شود.

## Decision Gate الزامی

موارد زیر باید در `docs/DECISIONS.md` حل و ثبت شوند:

- `DEC-OPEN-001`: مرز Sub-ledger و قرارداد اتصال به حسابداری قانونی
- `DEC-OPEN-004`: ارز، precision/rounding، FX source، tax و recognition
- `DEC-OPEN-005`: approval matrix برای purchase/payment/refund/journal
- `DEC-OPEN-016`: سیاست financial release و استثناهای مجاز

تا عبور از این Gate، posting schema، Journal Migration، FX authoritative، tax/recognition،
approval workflow و financial release policy اجرایی ممنوع‌اند.

## محدوده مجاز FINANCE-001 Foundation

- تحلیل و تثبیت مرز Sub-ledger عملیاتی؛ حسابداری قانونی و payroll کامل خارج از Scope
- طراحی Domain/Application و state machineهای Invoice، Payment، Refund، Settlement،
  Journal، Check و Financial Release بدون Persistence
- تعریف producer/consumer، reference، event و backward-compatibility قراردادها
- طراحی UI فارسی/RTL و stateهای loading/empty/error/forbidden بدون داده واقعی مالی
- استفاده فقط از قرارداد عمومی Sales، Reservations، Procurement، IAM و HR payroll input

Finance حق query مستقیم جدول‌ها یا Repositoryهای Customers، Sales، Reservations،
Procurement، IAM یا HR را ندارد. هیچ balance دستی ذخیره یا ویرایش نمی‌شود و طراحی
آینده باید مانده را از postingهای معتبر محاسبه کند.

## موارد خارج از این Handoff

- هر تغییر Prisma Schema، Migration یا Seed
- افزودن dependency، manifest یا lockfile
- gateway/provider adapter واقعی یا credential
- داده واقعی مشتری، حساب بانکی، چک، کارت، CVV یا PII
- انتقال قفل به PC-B یا رزرو قفل برای Task مالی دیگر
- Merge مستقیم به `develop`/`main`، force push یا حذف Source Branch

## کنترل تحویل

- Prettier روی اسناد تغییرکرده
- بررسی لینک‌های Markdown و fenceها
- `git diff --check` و Scope scan
- Secret/PII scan
- بدون تست یا build نرم‌افزاری، چون تغییر فقط مستندات است
- Commit کوچک، Push معمولی و Draft PR مستقل به `develop`
