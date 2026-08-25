# MASTER-003 — Advanced Master Data Management

- وضعیت: `IN_PROGRESS`
- مالک: `PC-B`
- Branch: `codex/pc-b-master-data-advanced`
- Base: `b6da5d6300716a189958bc37d31ca195f0304dc5`
- پیش‌نیاز: PR #24 با Source HEAD `6f475c0` و Merge Commit `b6da5d6` ادغام شده است.
- Dependency/Lockfile Owner: `RELEASED`؛ فقط در صورت اثبات نیاز Dependency جدید Excel رزرو می‌شود.

## انتقال اتمیک قفل‌ها

قفل‌های Migration، Legal Entity shared-contract و اسناد مرکزی متعلق به
`PC-A/LEGAL-ENTITY-CONTEXT-001` با دلیل `DONE/MERGED via PR #24` آزاد شدند.

قفل‌های فعال این Task:

- Migration Owner: `PC-B/MASTER-003`
- Master Data shared-contract/root export: `PC-B/MASTER-003`
- Central Sprint status docs: `PC-B/MASTER-003`

## محدوده

توسعه افزایشی MASTER-002 برای تکمیل Master Data به‌صورت Full-Stack، بدون بازسازی یا
دورزدن Persistence، API، Contract و UI سالم موجود. دامنه شامل کاتالوگ‌های مالی،
جغرافیا، سازمان/تأمین‌کننده، اقامت، حمل‌ونقل هوایی، بیمه، خدمات سفر و مراجع فروش است.

## مرزهای قطعی

- اطلاعات پایه میان هر دو Legal Entity و شعب مجاز مشترک است و با selector شرکت فیلتر نمی‌شود.
- Customer/Passenger، Sales، Reservations، Ticket Catalog، Procurement، Finance،
  Integrations، Documents و Human Resources مالک داده‌های عملیاتی خود باقی می‌مانند.
- ارتباط بین ماژول‌ها فقط از Public Contract، Port یا Event نسخه‌دار انجام می‌شود.
- حذف فیزیکی Reference مصرف‌شده، داده واقعی PII، Credential، کارت و CVV ممنوع است.
- نرخ Master Data با `isAuthoritative=false` مرجع داخلی است؛ نرخ Posting مالی فقط از Finance می‌آید.

## Quality Gate هدف

Frozen install، Prisma format/validate/generate، Migration روی PostgreSQL تازه، Seed دوبار،
lint، typecheck، تست کامل، Production Build، Smoke احرازشده `/master-data`، کنترل Scope،
Secret/PII/Card/CVV، `git diff --check` و Markdown links.

## وضعیت تحویل

Migrationها، مدل‌ها، APIها، Permissionها، Import Excel، کنترل‌های امنیتی، Export، تست‌ها،
تصمیم‌های باز، Draft PR و وضعیت Working Tree در پایان Task در همین سند ثبت می‌شوند.
