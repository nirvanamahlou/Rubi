# MASTER-001 — Master Data Foundation

وضعیت: `IN_PROGRESS`  
مالک: `PC-B`  
Branch: `codex/pc-b-master-data-foundation`  
Base: `4342a91f11c042a97b9553a509c9b585bb48596e`

## هدف و Scope

Vertical Slice بدون persistence برای اطلاعات پایه: ساختار ماژول Web، UI فارسی/RTL،
Contractهای REST ماژول‌محلی، validation، Permission Matrix، حالت‌های Loading/Empty/Error/
Permission، تست و طراحی مسیر Excel/PDF.

فایل‌های رزروشده:

- `apps/web/src/app/(crm)/master-data/page.tsx`
- `apps/web/src/modules/master-data/**`
- `docs/tasks/MASTER-001.md`
- ردیف MASTER-001 در `WORK_ASSIGNMENTS.md`
- بخش MASTER-001 در `docs/PROJECT_STATUS.md`

Catalog شامل کشور/شهر، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل، organization با نقش
آژانس/شرکت، کارگزار، لیدر و نحوه آشنایی است. Reference Data حذف نمی‌شود و فقط inactive
می‌شود. Organization profile واحد و roleهای چندگانه دارد.

## Contract پیشنهادی

- prefix: `/api/v1/master-data`
- JSON انگلیسی `camelCase`، زمان RFC 3339 UTC و شناسه opaque
- allowlist برای filter/sort و pagination کنترل‌شده
- action صریح `activate`/`deactivate` به‌جای PATCH آزاد status
- envelope موفقیت/خطا مطابق `docs/API_CONVENTIONS.md`
- export بزرگ با `202 Accepted`، `operationId`، snapshot فیلتر/permission و artifact
  کوتاه‌عمر Documents

Contractها فعلاً فقط در `apps/web/src/modules/master-data/api` برای type safety، validation
و contract test هستند. انتقال به `packages/contracts/**` نیازمند رزرو و Handoff مستقل است.

## Permission Matrix پیشنهادی

| قابلیت | Permission | Viewer | Editor | Manager | Exporter |
| --- | --- | :---: | :---: | :---: | :---: |
| مشاهده | `master_data.read` | ✓ | ✓ | ✓ | ✓ |
| ایجاد | `master_data.create` | — | ✓ | ✓ | — |
| ویرایش | `master_data.update` | — | ✓ | ✓ | — |
| فعال/غیرفعال | `master_data.status.manage` | — | — | ✓ | — |
| Excel/PDF | `master_data.export` | — | — | ✓ | ✓ |

Authorization باید deny-by-default و در use case علاوه بر route guard اعمال شود.

## Handoff با IAM-001

Producer: `PC-A/IAM-001`؛ Consumer: `PC-B/MASTER-001`.

نیازهای consumer پیش از Contract مشترک:

- permission code و scopeهای company/branch/organization به‌صورت versioned
- actor reference حداقلی برای `createdBy`، `updatedBy` و audit mutation/export
- پاسخ permission denied بدون import/query مستقیم IAM
- branch reference عمومی بدون تکرار ساختار داخلی IAM

تا انتشار این Contract، UI فقط permission state را طراحی می‌کند و هیچ فایل IAM تغییر
نمی‌کند.

## Blocked by Migration Lock

Migration و Dependency/Lockfile Owner برابر `PC-A/IAM-001` است؛ موارد مسدود:

- Prisma model/schema/Migration/seed و repository واقعی
- Backend متکی به persistence
- نرخ ارز authoritative تا حل `DEC-OPEN-004`
- نصب library یا تغییر manifest/lockfile
- انتقال Contract به package مشترک بدون Handoff

هر Preview با برچسب «نمونه طراحی و ذخیره‌نشده» است؛ mutation/export فایل ساختگی تولید
نمی‌کند. Export نهایی باید با permission snapshot و audit، Worker و Documents انجام شود.

## Quality Gate

lint، typecheck، تست Catalog/validation/permission/contract، build، Prettier scope،
`git diff --check`، secret scan و کنترل عدم تغییر Prisma/manifest/lockfile.
