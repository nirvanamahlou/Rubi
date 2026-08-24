# MASTER002-HANDOFF-001 — تحویل MASTER-002 به CUSTOMER-001 فاز B

- وضعیت: `READY_FOR_REVIEW`
- مالک: `PC-A`
- Branch: `codex/pc-a-master-002-handoff`
- Base: `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
- نوع: فقط مستندات؛ بدون کد، Schema، Migration، Dependency یا Lockfile

## Mergeهای تاییدشده

- PR شماره ۱۵ با Merge Commit `ddfebb369de67cb7ff45bd15a06841d3251c945a`
  وارد `origin/develop` شد؛ `MASTER-002` برابر `DONE` است.
- PR شماره ۱۶ با Merge Commit `9fb1cb33cef9bfbbb998d4e3ce823688e7700a31`
  وارد `origin/develop` شد؛ `CUSTOMER-001` فاز A برابر `DONE/MERGED` است.
- وضعیت کلی `CUSTOMER-001` تا تکمیل فاز B برابر `IN_PROGRESS` می‌ماند.

## قفل‌های آزادشده از PC-B/MASTER-002

- Migration Owner
- Dependency/Lockfile Owner
- Master shared-contract و root export
- Central Sprint status docs

آزادسازی چهار قفل بالا بر مبنای Merge `ddfebb3` است و مالکیت PC-B/MASTER-002
بر این منابع پایان یافته است.

## قفل‌های رزروشده برای PC-A/CUSTOMER-001 فاز B

- Migration Owner برای Prisma و Migrationهای دامنه Customers
- Dependency/Lockfile Owner فقط در صورت نیاز واقعی؛ پیش از آن هیچ manifest یا
  `pnpm-lock.yaml` تغییر نمی‌کند
- Customer shared-contract و root export هماهنگ‌شده
- Central Sprint status docs

قفل Dependency/Lockfile رزرو مشروط است: فعال‌شدن آن نیازمند ثبت dependency، فایل دقیق
و دلیل واقعی در Task فاز B است. سه قفل دیگر با این Handoff فعال‌اند.

## مرز قطعی فاز B

- فاز B فقط دامنه Customers را پوشش می‌دهد.
- تغییر فایل‌های داخلی IAM یا Master Data ممنوع است.
- Master Data فقط از قرارداد عمومی `@rubi/contracts` مصرف می‌شود؛ import، query یا
  وابستگی به مدل، Repository یا فایل داخلی Master Data مجاز نیست.
- ذخیره مقدار یا فایل مدارک هویتی حساس تا تصمیم قطعی PII ممنوع است.
- Duplicate auto-merge ممنوع است؛ فقط Candidate Detection و Review دستی همراه Permission
  و Audit مجاز است.
- نرخ ارز authoritative و تولید واقعی Excel/PDF خارج از این Handoff باقی می‌مانند.

## ایمنی دیتابیس محلی

Migration اطلاعات پایه قبلاً برای Preview با نسخه پیش از اصلاح روی دیتابیس محلی اعمال
شده است. هیچ Volume یا داده‌ای حذف نمی‌شود و تاریخچه Migration دستی دست‌کاری نمی‌شود.
Migrationهای بعدی فقط روی PostgreSQL ایزوله و تازه تست می‌شوند.

## کنترل این Task

- Prettier فقط روی شش فایل مستنداتی این Task
- `git diff --check`
- بررسی لینک‌های Markdown
- بررسی Scope و Secret
- بدون تست یا build نرم‌افزاری
- Push معمولی و Draft PR به `develop`
- بدون Merge، Force Push یا تغییر `main`
