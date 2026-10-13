# MASTER-004 — Remaining Master Data Capabilities

- مالک پیشنهادی: `PC-B`
- وضعیت: `PLANNED`
- Branch: پس از Handoff آینده تعیین می‌شود
- پیش‌نیاز: Merge PRهای #25، #26 و #27 و فعال‌سازی رسمی Handoff بعدی

## محدوده برنامه‌ریزی‌شده

- کاتالوگ‌های تکمیلی اطلاعات پایه که در MASTER-003 Phase A تحویل نشده‌اند
- ادامه Suppliers/Accommodation پس از رفع قفل Migration
- اتصال واقعی Antivirus و Documents برای فایل‌ها و تصاویر
- PII encryption/unmask مخاطبان Master Data با Permission و Audit مستقل
- قابلیت‌های آینده UI، API، Reporting و Integration در مرز عمومی ماژول

## محدودیت تا بازگشت قفل

تا Handoff رسمی بعدی، این Task فقط مجاز به طراحی و تغییر فایل‌های محلی غیرمرکزی است و
حق تغییر یا ایجاد موارد زیر را ندارد:

- Prisma Schema، Migration یا Seed
- Master Data shared-contract یا root export
- Dependency، Manifest یا Lockfile
- `WORK_ASSIGNMENTS.md`، `PLANS.md` یا `docs/PROJECT_STATUS.md`
- Persistence یا Adapter ساختگی برای Antivirus، Documents یا Providerها

هیچ‌یک از قابلیت‌های این سند با Merge MASTER-003 Phase A تکمیل‌شده محسوب نمی‌شوند.
