# IAM002-HANDOFF-001 — آغاز توسعه مستقل Sprint دوم

- وضعیت: `DONE`
- مالک: `PC-A`
- Branch: `codex/pc-a-iam-002-handoff`
- Base: `d1f1133801663d651ae02e3570b806acb641dfe8`
- نوع: فقط مستندات؛ بدون کد، Schema، Migration، Dependency یا Lockfile
- Merge Commit: `0af31c2ce5d474b5a8826d15673a49f3448e7207`

## نتیجه IAM-002

PR شماره ۱۱ با Merge Commit `d1f1133` وارد `develop` شد. نسخه دوم قرارداد IAM شامل
۱۷ Permission عمومی است و تست Contract، Guard، Seed تکرارپذیر، lint، typecheck، test و
build آن پاس شده‌اند. قفل `IAM shared-contract` آزاد شد.

## مجوز شروع موازی

### PC-B — MASTER-002

- Branch: `codex/pc-b-master-data-persistence`
- اجرای Full-Stack اطلاعات پایه مجاز است.
- PC-B تنها مالک Migration، Dependency/Lockfile و Master shared-contract این موج است.
- نرخ ارز authoritative و artifact واقعی Excel/PDF همچنان تابع محدودیت‌های ثبت‌شده است.

### PC-A — CUSTOMER-001 فاز A

- Branch: `codex/pc-a-customer-foundation`
- UI، state، DTO/application design و تست دامنه بدون Persistence مجاز است.
- تغییر Prisma، Migration، Dependency/Lockfile، root contract export و فایل‌های IAM یا
  Master Data ممنوع است.
- فاز B فقط پس از Merge MASTER-002 و Handoff مستقل Migration آغاز می‌شود.

## شرط پایان Handoff

پس از ادغام این سند، هر دو کامپیوتر باید `develop` را با Fast-forward دریافت کنند و هر
Task را در چت، Branch، Commit و PR مستقل اجرا کنند. هیچ‌کدام شاخه دیگری را Merge یا فایل
رزروشده طرف مقابل را ویرایش نمی‌کند.
