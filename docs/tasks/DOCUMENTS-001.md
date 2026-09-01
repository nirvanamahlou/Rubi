# DOCUMENTS-001 — Foundation ماژول اسناد و فایل‌ها

وضعیت: `READY_FOR_REVIEW / PHASE_A_COMPLETE`

مالک: `PC-B`

Branch: `codex/pc-b-documents-foundation`

Draft PR: `#61` → `develop`

Base: `origin/develop@1fd22efd836e16df5a62b73430444bd3f856f5e6`

تاریخ شروع: 2026-09-01

## رزرو و قفل‌ها

این سند رزرو ماژول‌محلی `DOCUMENTS-001` را ثبت می‌کند. در زمان شروع، Checkout اصلی
تمیز ولی روی Task فعال `codex/pc-b-master-data-catalog-usability` بود؛ بنابراین کار در
Worktree مستقل `C:/Users/admin/Rubi-documents-001` انجام شد و Checkout اصلی، داده محلی،
شاخه‌ها و تغییرات Taskهای دیگر دست‌نخورده ماندند.

قفل‌های فعلی طبق `WORK_ASSIGNMENTS.md`:

- Migration Owner: `ACTIVE — PC-B/MASTER-003`
- Master Data shared-contract/root export: `ACTIVE — PC-B/MASTER-003`
- Central status/docs: `ACTIVE — PC-B/MASTER-003`
- Dependency/Lockfile Owner: `RELEASED`

در نتیجه این Task مطابق دستور مالک فقط Phase A است و موارد زیر را تغییر نمی‌دهد:

- `packages/database/prisma/**`، Migration، Seed یا Prisma Client
- `packages/contracts/src/index.ts` یا Permission مرکزی IAM
- `package.json`، `pnpm-lock.yaml` یا Workspace config
- `WORK_ASSIGNMENTS.md`، `docs/PROJECT_STATUS.md` یا `PLANS.md`
- Ticket Catalog، Reservations، Customers، Finance، Master Data یا فایل‌های PC-A

انتقال یا آزادسازی خودکار هیچ قفلی انجام نشد. رزرو نهایی در اسناد مرکزی پس از Handoff
مالک قفل `MASTER-003` باید انجام شود.

## مرز دامنه

طبق [ADR-021](../DECISIONS.md) و
[مرز ماژول‌ها](../MODULE_BOUNDARIES.md)، Documents مالک این موارد است:

- فایل نهایی و Object Storage خصوصی
- Metadata، Referenceهای دامنه و نسخه‌های immutable
- سطح محرمانگی، Branch Scope و Access Policy
- تاریخچه مشاهده، دانلود، Upload، نسخه، Archive، Restore و تلاش ناموفق
- Archive، Retention intent، Legal Hold و تاریخ حذف پیشنهادی
- وضعیت اسکن امنیتی، قرنطینه و Adapter آنتی‌ویروس

Documents مالک Render، Issue، شماره‌گذاری، محتوای معنایی، محاسبات مالی، اجازه صدور یا
Branding نیست. ماژول تولیدکننده فایل نهایی و Metadata معتبر را تحویل می‌دهد. Documents
هیچ Query مستقیم به جدول ماژول تولیدکننده یا Legal Entity ندارد.

## خروجی Phase A

### Domain و Backend ماژول‌محلی

مسیر [apps/api/src/documents](../../apps/api/src/documents) شامل موارد زیر است:

- `DocumentAsset`
- `DocumentVersion`
- `DocumentReference`
- `DocumentAccessLog`
- `DocumentArchiveRecord`
- `DocumentRetentionPolicy`
- `DocumentLegalHold`
- `DocumentScanResult`
- `DocumentUploadSession`
- State Machine صریح Upload و Scan
- Version append-only و جلوگیری از reuse شناسه/Object Key
- Archive/Restore با Reason و Legal Hold gate
- Download gate برای Permission، Archive و `CLEAN`
- قرارداد خطای ماژول‌محلی برای Unauthorized، Forbidden، Validation، Conflict،
  Quarantine، Scan Required و Adapter Unavailable

Controller، Repository، Nest Module یا Persistence ساختگی ایجاد نشده است. عملیات
Application به‌صورت Port تعریف شده‌اند:

- `listDocuments`
- `getDocument`
- `createUploadSession`
- `completeUpload`
- `cancelUpload`
- `createVersion`
- `listVersions`
- `requestAuthorizedDownload`
- `archiveDocument`
- `restoreDocument`
- `listAccessHistory`
- `placeLegalHold`
- `releaseLegalHold`

Adapter Interfaceهای آینده:

- Object Storage خصوصی برای Upload/Download امضاشده و Verify checksum
- Antivirus برای Scan و Quarantine
- Worker برای orphan cleanup و retention review
- Audit برای مشاهده و دانلود حساس

Adapter پیش‌فرض Antivirus فقط
`AWAITING_ANTIVIRUS_ADAPTER` برمی‌گرداند و هرگز نتیجه `CLEAN` ساختگی نمی‌سازد.

### Permission Proposal

Permissionهای زیر فقط ماژول‌محلی هستند و IAM مرکزی تغییر نکرده است:

- `documents.read`
- `documents.upload`
- `documents.version.create`
- `documents.download`
- `documents.sensitive.read`
- `documents.sensitive.download`
- `documents.archive`
- `documents.restore`
- `documents.audit.read`
- `documents.retention.manage`
- `documents.legal_hold.manage`
- `documents.quarantine.manage`

Policy به‌صورت deny-by-default است. Actor ناموجود، Permission ناموجود یا Branch خارج از
Scope رد می‌شود. رکورد حساس بدون Permission به‌صورت Masked نمایش داده می‌شود و View یا
Download حساس Reason حداقل پنج‌نویسه‌ای می‌خواهد. در Phase B این تصمیم باید به Guard
عمومی IAM و Audit پایدار متصل شود.

### File Security Validation

- محدودیت پیش‌فرض اندازه Phase A: 25 MiB؛ مقدار نهایی باید Setting مصوب باشد.
- Allowlist فعلی: PDF، PNG، JPEG، TXT، CSV، DOCX و XLSX.
- فایل اجرایی و Macro شامل EXE، DLL، MSI، JS، JAR، BAT، CMD، PowerShell، VBS، SCR،
  DOCM، XLSM و PPTM رد می‌شود.
- MIME اعلام‌شده با MIME تشخیص‌داده‌شده و Magic Bytes تطبیق می‌یابد.
- SHA-256 با قالب 64 رقم Hex الزامی است.
- نام دانلود Normalize و پاک‌سازی می‌شود؛ Path Traversal و Content-Disposition unsafe
  پذیرفته نمی‌شود.
- Object Key فقط الگوی opaque تصادفی دارد و نام فایل اصلی در Storage Path نیست.
- Archive entry limit و expansion ratio برای مقابله با Archive Bomb کنترل می‌شوند.
- Signed URL بیش از 300 ثانیه معتبر نیست.
- فایل غیر-`CLEAN`، قرنطینه‌شده یا آرشیوشده قابل دانلود نیست.

Bucket عمومی، URL امضاشده، Secret، Metadata حساس یا Object Key واقعی در Log/Fixture
ثبت نمی‌شود.

### رابط `/documents`

[Workspace اسناد](../../apps/web/src/modules/documents) فارسی، RTL، Responsive و
desktop-first است و رنگ‌بندی جاری CRM را مصرف می‌کند. Route موجود
[`/documents`](<../../apps/web/src/app/(crm)/documents/page.tsx>) از Foundation عمومی به
Workspace اختصاصی متصل شد.

بخش‌ها:

1. داشبورد هشت KPI شامل فایل، سند جدید، اسکن، قرنطینه، محرمانه، آرشیو، حجم و انقضا
2. جدول کامل اسناد با Metadata موردنیاز و فیلتر/مرتب‌سازی/Pagination proposal
3. ده دسته قابل توسعه و مستقل از جدول ماژول تولیدکننده
4. Timeline نسخه‌ها، نسخه جاری و دانلود مجاز proposal
5. چهار سطح محرمانگی، Masking، Reason و Permission Matrix
6. وضعیت‌های Scan، Fail-closed download و Antivirus Adapter notice
7. Archive، Restore، Legal Hold، Retention و حذف دائمی غیرفعال
8. Access History با Actor، UTC، IP خلاصه، User Agent، Reason و Outcome

UI برای `Loading`، `Empty`، `Error`، `Unauthorized`، `Forbidden`, `Conflict` و
`Preview` سطح مستقل دارد. تمام داده‌ها synthetic و تمام شناسه‌ها با `preview-*` شروع
می‌شوند. Upload، Download، Unmask، Restore و Signed URL واقعی غیرفعال‌اند.

## قرارداد Persistence آینده — Proposal، بدون تغییر Prisma

طرح پیشنهادی Phase B:

| جدول | مسئولیت و Constraint اصلی |
| --- | --- |
| `document_assets` | UUID، display name، category code، branch FK عمومی، confidentiality، archive state، optimistic version |
| `document_versions` | FK asset، version number unique، opaque object key unique، size، MIME detected، SHA-256، immutable trigger/policy |
| `document_references` | source module/entity/id بدون FK مستقیم cross-module؛ uniqueness و resolver از Public Contract |
| `document_access_logs` | append-only، actor، action، outcome، UTC، IP/User-Agent خلاصه و reason redacted |
| `document_archive_records` | append-only Archive/Restore history |
| `document_retention_policies` | category/policy version؛ تا DEC-OPEN-006 فقط Draft/disabled |
| `document_legal_holds` | active/released history با actor/reason |
| `document_scan_results` | هر scan attempt، engine/adaptor reference، result، threat code redacted |
| `document_upload_sessions` | two-step upload، TTL، expected size/checksum، state و orphan cleanup |

Migration باید افزایشی، non-destructive و فقط پس از دریافت Migration Lock باشد. طراحی
Retention، Encryption key management، Residency و Permanent Delete تا حل
`DEC-OPEN-006` قابل نهایی‌شدن نیست.

## فرض‌ها و معیارهای عملیاتی پیشنهادی

اطلاعات ظرفیت قطعی در اسناد پروژه موجود نیست؛ این اعداد معیار طراحی Phase B و نه SLO
مصوب هستند:

- الگو: Modular Monolith موجود؛ Shared tenant با Branch Scope امنیتی
- حساسیت: PII/Confidential، بدون PCI/CVV
- بار طراحی اولیه: نسبت Read/Write حدود 10:1 و کمتر از 100 QPS در p99؛ نیازمند تأیید
- API metadata: p50 ≤ 150ms، p95 ≤ 500ms، p99 ≤ 900ms بدون Object Storage/Antivirus
- Signed URL authorization: p95 ≤ 350ms بدون احتساب دانلود باینری
- Availability proposal: 99.9%؛ error-budget consumer پیشنهادی: Operations Platform Owner
- RPO proposal: 15 دقیقه metadata و Object Versioning؛ RTO proposal: 4 ساعت
- UI auth-walled روی desktop/corporate network؛ LCP p75 ≤ 2.5s، INP ≤ 200ms، CLS ≤ 0.1
- JS route budget پیشنهادی: حداکثر 180KB gzip incremental
- Lighthouse floor پیشنهادی: Accessibility ≥ 95، Performance ≥ 85
- WCAG 2.2 AA؛ مالک Accessibility هنوز باید تعیین شود

اعداد RPO/RTO/Availability طبق `DEC-OPEN-007` باز هستند و بدون تأیید مالک عملیات تعهد
محصول محسوب نمی‌شوند.

## تست‌ها و Quality Gate

تست‌های هدفمند Phase A پوشش می‌دهند:

- State Machine و Transition نامعتبر
- Version immutability و عدم overwrite تاریخچه
- Archive/Restore و Legal Hold
- Deny-by-default، Permission حساس، Reason و Branch Scope ضد IDOR
- Quarantine، Pending Scan و ممنوعیت Download
- Extension، MIME، Magic Bytes، SHA-256، Size، Macro، Path Traversal و Archive Bomb
- Signed URL TTL و Object Key opaque
- Pagination، Filter و Sort allowlist
- UI stateها، داده synthetic، دسته‌ها و نبود اتصال Persistence
- نبود Controller/Repository/Prisma/Nest در ماژول Phase A

نتیجه Gateهای نهایی:

- Targeted Documents: 27 تست در 8 فایل، همگی موفق
- Full Monorepo: 1,284 تست موفق؛ 66 تست opt-in PostgreSQL مطابق اجرای عمومی Skip و صفر Fail
- Full Monorepo Typecheck: 9/9 Task موفق
- Full Monorepo Lint: 6/6 Task موفق
- Production Build: 6/6 Task موفق؛ Route استاتیک `/documents` در 34 صفحه تولیدی ساخته شد
- Production HTTP smoke: `/login` برابر 200 با RTL؛ `/documents` بدون Session برابر 307 به Login
- Artifact smoke: متن Dashboard، Antivirus state و Preview badge در خروجی Production وجود دارد
- هیچ Server آزمایشی پس از Smoke روشن نماند

`git diff --check`، Scope scan، Secret/PII scan و Markdown link check در Gate نهایی پیش
از Commit و Push اجرا می‌شوند و نتیجه آن‌ها در گزارش PR درج می‌شود.

## قابلیت‌های Deferred / Blocked

- Prisma Schema، Migration، Seed و Repository واقعی: مسدود با Migration Lock
- IAM Permission مرکزی و Root Contract export: مسدود با قفل قرارداد مرکزی
- Object Storage/MinIO و Signed URL واقعی: Phase B، نیازمند Persistence و Security review
- Antivirus و Quarantine worker واقعی: Adapter/Infrastructure Task مستقل
- Retention، Residency، KMS و Permanent Delete: مسدود با `DEC-OPEN-006`
- SLO، Hosting، RPO/RTO و backup policy: مسدود با `DEC-OPEN-007`
- اتصال Legal Entity، Sales، Reservations، Finance و HR: فقط از Public Contractهای
  versioned در Task هماهنگ‌شده producer/consumer

## Handoff لازم برای Phase B

1. `MASTER-003` باید قفل‌های Migration/Contract/Central Docs را با Handoff صریح آزاد کند.
2. `DOCUMENTS-002` باید Migration، Documents shared contract، IAM permission و Central
   Docs را مستقل رزرو کند.
3. Security/Product باید DEC-OPEN-006 و Operations باید DEC-OPEN-007 را تصمیم‌گیری کنند.
4. قرارداد storage encryption، bucket policy، object versioning، backup و lifecycle
   با Infra مرور شود.
5. Antivirus product/engine، timeout، retry، quarantine release و failure policy تصویب شود.
6. Producer/consumerهای Legal Entities، Sales، Reservations، Finance و HR برای قرارداد
   Reference و Metadata versioned هماهنگ شوند.
