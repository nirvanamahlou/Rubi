# MASTER-003 Phase A Handoff

- مالک فعلی: `PC-B/MASTER-003`
- Branch: `codex/pc-b-master-data-advanced`
- Pull Request: [#25](https://github.com/nirvanamahlou/Rubi/pull/25)
- وضعیت Phase A: `DONE / READY_FOR_REVIEW`
- وضعیت کل Master Data: تکمیل‌نشده؛ ادامه در `MASTER-004`

## محدوده تحویل Phase A

- نرخ ارز پیشرفته و کاملاً `non-authoritative` با گردش Maker/Checker
- Import امن هتل، Preview/Commit اتمیک و آزمون فایل واقعی ۲۲ هتل
- کاتالوگ‌های پیاده‌سازی‌شده، فرم‌ها و UI متصل موجود
- خروجی مستقیم XLSX با Permission/Audit؛ PDF آرشیوی همچنان Deferred
- Runtime DTO validation، کنترل OOXML و immutability نرخ Approved/Rejected

ادامه Suppliers روی Branch مستقل `codex/pc-b-master-data-suppliers` وارد PR #25
نمی‌شود و با وضعیت `PAUSED_FOR_CUSTOMER_002B_MIGRATION_HANDOFF` باقی می‌ماند.

## ترتیب اتمیک Handoff

1. PR #25 Merge شود و Master Data shared-contract/root export آن پایدار گردد.
2. PR #26 مربوط به CUSTOMER-002A روی `develop` Merge شود.
3. PR #27 پس از Parent خود Merge شود.
4. Handoff نهایی، فعال‌شدن قفل‌های رزروشده برای `PC-A/CUSTOMER-002B` را ثبت کند.

تا تکمیل هر چهار مرحله، رزرو زیر فقط Reservation است و مالکیت عملیاتی ایجاد نمی‌کند.

| قفل | وضعیت پس از Gate نهایی |
| --- | --- |
| Migration Owner | `PC-A/CUSTOMER-002B — ACTIVE` |
| Central Sprint Docs | `PC-A/CUSTOMER-002B — ACTIVE` |
| Customer shared-contract/root export | `PC-A/CUSTOMER-002B — ACTIVE` |
| Master Data shared-contract/root export | `RELEASED / STABLE_AFTER_PR25` |
| Dependency/Lockfile Owner | `RELEASED` |

## محدودیت PC-B تا Handoff بعدی

`MASTER-003E-SUPPLIERS` و `MASTER-004` حق ایجاد یا Merge کردن Prisma Schema،
Migration، Seed، Root Contract، Dependency/Lockfile یا تغییر اسناد مرکزی را ندارند.
مصرف قرارداد پایدار Master Data مجاز است، اما تغییر موازی آن مجاز نیست.
