# MASTER-005 — Excel Import persistence visibility

## Scope

- مالک اجرا: `PC-B`
- Branch: `codex/pc-b-master-data-excel-import`
- دامنه: ورود گروهی هتل از Excel در اطلاعات پایه
- خارج از دامنه: Customer Excel Import، Schema/Migration/Seed، قرارداد مشترک و فایل‌های PC-A

## Data flow

1. فایل `.xlsx` با قالب دقیق `HOTEL_IMPORT_V1` به Preview ارسال می‌شود.
2. Backend نوع فایل، ساختار ZIP، Header، Formula، Link خارجی، Macro، Scope کشور/شهر و داده هر ردیف را اعتبارسنجی می‌کند.
3. Commit با Preview Token و Idempotency Key انجام می‌شود.
4. همه ردیف‌های معتبر و ارتباط‌های مرجع در یک تراکنش ثبت می‌شوند؛ در خطا هیچ ثبت ناقصی باقی نمی‌ماند.
5. پس از موفقیت، UI فهرست هتل‌های کشور/شهر انتخاب‌شده را با وضعیت «همه» باز می‌کند تا رکورد ایجادشده یا به‌روزشده فوراً دیده شود.

## Verification

- Parser و Permission: `20/20`
- Service persistence: `1/1`؛ ایجاد هتل و Auditهای `master_data.hotel_import.create` و `master_data.hotel_import.commit`
- Accommodation Workspace: `5/5`
- API/Web lint و typecheck: موفق
- API/Web production build: موفق؛ Web شامل ۳۴ Route

هیچ Migration جدید یا تغییر مستقیم دیتابیس برای این اصلاح لازم نیست.
