# تصمیم‌های معماری

## B2B-DOSSIER-REPORTS-001 — 2026-09-09

The dossier Reports/Audit UI consumes normalized metadata from B2B audit events and public Master Organization/Documents owner projections. It does not read another module's tables, change the central Reporting module or create financial events. Existing branch and source/domain permissions apply to every page. Snapshots stay server-side; the projection exposes changed field labels, action, actor and time, never private contact values, notes, document contents or credential fields. Export contains the same authorized filtered projection. Per-source keyset pages share a fixed upper timestamp, including a deterministic cross-source tie key; Tehran calendar-day filters include both day boundaries.

Inspection found that Documents permanent deletion removed its audit rows. To preserve the requested history without a new schema, deletion now removes versions and payload metadata but retains a minimal DELETED document, case identifiers and audit events. Detail/file/restore and list APIs exclude that tombstone, including explicit DELETED queries. Version references in retained audits are cleared before physical version removal; a deletion event is appended atomically with the tombstone. Already-erased historical events cannot be reconstructed. Existing owner file cleanup behavior remains; no local business record was deleted by this task. Finance preview data is never reported as real transactions.

## B2B-CONTRACT-CREDIT-DEMO-001 — 2026-09-09

Credit/guarantees moves beneath the commercial contract UI; existing credit authorization identifiers and approval rules remain independent. The owner requests synthetic guarantee and financial data. Guarantee drafts and proofs persist through B2B/Documents public services against explicitly synthetic agencies. Finance currently has a Phase A preview foundation and no posting/exposure adapter in this checkout, so the financial scenario is explicitly labelled as a UI preview and never supplied as authoritative exposure, receipt confirmation or ledger state. This satisfies the requested visual sample without crossing Finance ownership or changing account balances.

## B2B-CONTRACT-FORMS-002 — 2026-09-09

Master Data owns payment-method identity; B2B consumes its public directory and persists a nullable revision FK and label snapshot. Settlement mode remains PREPAID/CREDIT/MIXED. Optional v1 fields preserve older client writes and immutable historical revisions. The expanded agreement-type check is additive. Documents owns all inline uploads and file state; pending scans may be linked to drafts, while submission/approval always requires CLEAN and the existing scope/completeness/expiry checks. Removing the editable limit type preserves existing values and the HARD default; it does not silently alter credit enforcement. Shared calendar and selector behavior is opt-in for the affected forms.

## B2B-ORGANIZATION-USERS-001 — 2026-09-09

The owner explicitly limits per-user selection to the same agency's 360 dossier. Provide six view permissions and a standalone agency portal; do not grant global Rubi roles, administrative mutations, independent contract/credit approval, or access to other agencies. B2B stores membership and consumes exported IAM provisioning methods. A global B2B interceptor restricts any linked account, including inactive memberships and accounts subsequently granted global IAM roles, to its portal and own authentication/session endpoints. Each portal projection rechecks active membership, organization and selected section and derives organization/branch from the server. Existing staff accounts are never converted. Failed membership creation disables the new IAM account; B2B membership/audit are atomic, while IAM and B2B provisioning are separate public-service operations. Finance remains explicitly unavailable until its owner projection is connected; no fabricated balances. Role labels do not confer IAM privileges.

## B2B-UNIFIED-PROFILE-001 — 2026-09-09

The owner's unified-page request moves all organization profile entry actions into the profile/roles screen. Existing organization tabs become sections on that same page and popup editors preserve current data contracts. National ID remains the existing Master Data company field in step one and edit, not a duplicate identity field.

Implement signatory directory entries against existing Master Data contacts, following FR-PEO-02 document-type, limit/currency, date and proof requirements. Only B2B metadata is stored; public Master Data and Documents methods validate references. An incomplete proof permits saving an inactive entry only. No automatic IAM grant, portal account, independent approval or legal signature verification is implied. This bounded registration feature does not invent a new signatory-approval workflow. Existing cooperation agreement approval remains unchanged.

## B2B-PROFILE-CLARITY-001 — 2026-09-09

- پاسخ مالک محصول: گزینه‌های شعب، شعب آژانس طرف همکاری هستند. منبع آن‌ها آدرس‌های همان MasterOrganization و CRUD عمومی Master Data است. انتخاب نشانی صرفاً نمایش جزئیات است؛ شناسه نشانی به‌جای IAM branchId ارسال نمی‌شود. شعبه داخلی مسئول قرارداد و دسترسی‌ها جدا و روشن نمایش داده می‌شود.
- شناسه ملی شرکت، فیلد اختیاری `MasterOrganization.nationalId` برای شخصیت حقوقی است؛ ورود دستی ۱۱ رقم با تبدیل ارقام فارسی/عربی به لاتین، یکتا بین سازمان‌ها و قابل اصلاح با مجوز Master Data و version موجود. این ثبت، استعلام یا تأیید اصالت ثبتی نیست. کد ملی شخص حقیقی در این فیلد ذخیره نمی‌شود. رکوردهای قدیمی NULL می‌مانند و درخواست‌های قدیمی که فیلد را نمی‌فرستند مقدار آن را حفظ می‌کنند.
- تغییر قرارداد عمومی فقط افزودن attribute/value اختیاری است؛ producer اطلاعات پایه و consumer فرم و پرونده سازمان است. Migration افزایشی محدود به همین ستون، unique index و قید قالب/شخصیت است؛ پس از backup و rehearsal روی نسخه بازیابی‌شده اعمال می‌شود. هیچ migration تاریخی یا داده موجود بازنویسی نمی‌شود.
- مدیر حساب کاربر داخلی مسئول پیگیری آژانس است. وضعیت همکاری از پروفایل واقعی خوانده می‌شود؛ دکمه بررسی به گردش قرارداد موجود می‌رود و تأیید مستقل قرارداد، پروفایل در حال بررسی را فعال می‌کند. قواعد دسترسی و منع خودتأییدی بدون تغییر می‌مانند.

## B2B-AGENCIES-001 — اعتبار چندارزی و حذف هویت استفاده‌شده

- پاسخ صریح مالک در پیگیری PRD: **سقف جدا برای هر ارز؛ بدون تبدیل خودکار**. محاسبه اعتبار فقط Decimalهای هم‌ارز را ترکیب می‌کند؛ currency mismatch نتیجه قابل‌استفاده تولید نمی‌کند. مدل نهایی Policy باید ارز را در scope یکتا لحاظ کند؛ schema فعلی تک‌سیاستی به‌عنوان پیاده‌سازی چندارزی معرفی نمی‌شود.
- درخواست حذف دائمی داده با FR-ORG-04 چنین جمع می‌شود: رکورد بدون وابستگی از API نسخه‌دار و audited مالک قابل حذف است؛ FK محدودکننده هویت استفاده‌شده و تاریخچه تجاری حفظ می‌شود. هیچ حذف آبشاری قرارداد/سفارش/سند مالی مجاز نشده است.
- زمان تحقق پورسانت، تعداد مراحل/مجوزهای تأیید، ترکیب Exposure و سایر P0های باز سند با این پاسخ تعیین نشده‌اند. جزئیات و وضعیت واقعی پیاده‌سازی: `tasks/B2B-AGENCIES-001-PRD-COVERAGE.md`.

## SALES-OUTPUT-CLEANUP-0907 — customer copy vs operator guidance

At the user's request, operational issuance/context disclaimers and template generation metadata are removed from the customer-facing printed/PDF page. The same disclosures stay in the operator dialog; this layout-only change does not establish historical issuer binding, official issuance, archive completion, Finance payment confirmation or reservation fulfillment. Existing fail-closed API policies remain unchanged.

## SALES-CUSTOMER-PRICING-0907 — local additive upgrade gate

The operational database has pre-existing file/checksum differences for master_data_foundation (20260823084001), legal_entity_context (20260825123000), and reservation_arrangements (20260906113000), plus LF/CRLF differences elsewhere. This task does not repair/rebaseline/rewrite any historical migration or owner data. Like the previous local rollout, permit only the single reviewed additive Sales passenger-price migration after a fresh backup restore rehearsal. Require every historical migration to be known/finished, reject any other pending migration, and compare all stored historical checksums plus business counts before/after. The new table depends only on the existing Sales passenger UUID key. Broader historical reconciliation remains outside this task.

## HOTEL-SALES-PRICING-0906 — 2026-09-06

- مالک محصول ورود قیمت روز فروش/توافقی هتل به‌صورت هر شب یا کل و ثبت بعدی هزینه خرید در رزرواسیون را تأیید کرد. انتقال محدود قفل Migration نیز صریحاً تأیید شد.
- هزینه ثبت‌شده در رزرواسیون سابقه عملیاتی خرید است؛ مالکیت تأیید خرید/بدهی در Procurement و Finance حفظ می‌شود. این ثبت هیچ financial release یا پرداخت تأییدشده تولید نمی‌کند.
- اختلاف روز فروش و توافق «تخفیف فروشنده» است؛ بدون قیمت اولیه کارگزار، هیچ مقدار ساختگی با نام تخفیف کارگزار تولید نمی‌شود. حاشیه هتل فقط در ارز یکسان و بر پایه هزینه ثبت‌شده نمایش داده می‌شود، نه سود قطعی کل قرارداد.

## اجرای موقت DOCUMENTS-002 — 2026-09-01

- ADR-002 و الزام S3/MinIO برای محیط تولید بدون تغییر باقی می‌ماند. Adapter فعلی Documents
  فقط برای Development/Test این Vertical Slice است و فایل را بیرون Database با AES-256-GCM،
  کلید مستقل، object key تصادفی و permission محدود نگه می‌دارد؛ معرفی آن به‌عنوان Storage
  تولید ممنوع است.
- تا اتصال Antivirus واقعی، هر نسخه جدید `AWAITING_ANTIVIRUS_ADAPTER` می‌ماند و دانلود
  آن fail-closed است. تغییر دستی Scan به `CLEAN` یا جعل پاسخ Scanner در Seed/UI ممنوع است.
- تصمیم `DEC-OPEN-006` درباره retention، residency و key management همچنان باز است؛ این
  Slice حذف دائمی، گردش کلید تولید یا تعهد نگهداری را حدس نمی‌زند.
- درخواست صریح مالک محصول در 2026-09-05 ورود دستی اختیاری شماره پاسپورت و تصویر
  اختیاری آن را برای Development/Test مجاز کرد. شماره فقط در مرز Customers با
  AES-256-GCM، HMAC دامنه‌جدا، Mask و Sensitive-read Audit نگهداری می‌شود و فایل از
  Public Contract ماژول Documents عبور می‌کند. این مجوز محدود، `DEC-OPEN-006` را برای
  Production، retention، residency یا گردش کلید حل‌شده اعلام نمی‌کند.

## Clarifications carried from the approved source tasks — 2026-08-31

- `TICKET-PRICING-002`: PR #46 records the owner's clarification that final sale
  prices are dynamic Sales quotation/contract snapshots. Ticket Catalog owns
  purchase/cost reference versions only, not a fixed sale amount. This supersedes
  older combined purchase/sale wording for Catalog; no Sales persistence or FX
  conversion is implemented by this integration. See `tasks/TICKET-CATALOG-001.md`.
- The same source handoff clarifies mixed-currency Sales: preserve separate
  Decimal/currency components for one ticket sale; never sum unlike currencies
  or invent an FX rate. Converted totals need the approved Finance policy and a
  rate snapshot. This is a Sales backlog requirement, not an implemented feature.
- PR #46 also records the owner's narrow IAM policy change: minimum password
  length 10, preserving uppercase/lowercase/digit/special-character checks and
  maximum 200. This integration carries that existing change to Web and API
  together; it does not reset passwords or provision application users.


## هماهنگی MASTER-003-CATALOG-USABILITY — 2026-08-31

مبنای اولیه بررسی Handoff origin/develop پس از #41 بود؛ بررسی نهایی Merge #58 / e25f288
را نشان داد. Handoff جدید صراحتاً قفل‌های توسعه PC-B را حفظ می‌کند و تنها رزرو integration
پس از Merge خاتمه می‌یابد؛ رزرو محدود کار جاری زیر PC-B/MASTER-003 ادامه دارد.
درخواست جدید مالک با حفظ نسخه‌های تحویلی روی شاخه مستقل از #57 اجرا می‌شود؛ ادغام
develop یا تغییر والدها جزو این کار نیست. فقط قرارداد Master Data و اسناد اعلام‌شده
در WORK_ASSIGNMENTS برای این اصلاح رزرو شده‌اند. پس از تطبیق ماکاپ، قفل محدود Schema/Migration
برای افزودن ترتیب کشور با پیش‌فرض صفر و قید عدد صحیح نامنفی به همین Work Item اضافه شد؛ Calendar دست نمی‌خورد.
ستون‌های وابسته به ماژول‌های دیگر بدون Public Contract مقدار واقعی ندارند؛ مقدار ناموجود
با وضعیت انتظار نمایش داده می‌شود، نه صفر یا اتصال ساختگی. داده نمونه فقط با منشأ آزمایشی
و بدون دست‌کاری داده کاربر واقع‌گراتر می‌شود؛ نرخ ارز و PII واقعی همچنان ممنوع‌اند.

## تصمیم‌های پذیرفته‌شده در Bootstrap

| ID      | تصمیم                                                                                              | دلیل/پیامد                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | Modular Monolith در Monorepo                                                                       | transaction و توسعه ساده‌تر؛ مرز ماژول با contract/test enforce می‌شود                                                        |
| ADR-002 | PostgreSQL سیستم ثبت، Redis موقت، S3/MinIO فایل                                                    | جلوگیری از چند source of truth                                                                                                |
| ADR-003 | دو سایت فقط Booking API مرکزی                                                                      | امنیت، pricing و Provider abstraction مرکزی                                                                                   |
| ADR-004 | Adapter و مدل normalized برای هر Provider                                                          | جلوگیری از نشت schema بیرونی به domain                                                                                        |
| ADR-005 | فروش، خرید و finance ledger جدا ولی FK-linked                                                      | margin/reconciliation معتبر و جلوگیری از اختلاط grain                                                                         |
| ADR-006 | payment، booking و issue state مستقل                                                               | نمایش دقیق paid-not-issued و recovery                                                                                         |
| ADR-007 | journal دوطرفه و balance محاسباتی                                                                  | auditability؛ posted entries immutable/reversed                                                                               |
| ADR-008 | Reporting Views با grain صریح                                                                      | جلوگیری از تکثیر مبلغ و KPI ناسازگار                                                                                          |
| ADR-009 | UTC در storage و شمسی فقط presentation                                                             | interoperability و محاسبه صحیح زمان                                                                                           |
| ADR-010 | Outbox/Inbox و handler idempotent                                                                  | side effect قابل بازیابی و delivery at-least-once                                                                             |
| ADR-011 | Organization مشترک با چند Role                                                                     | حذف duplicate agency/provider/corporate identity                                                                              |
| ADR-012 | اسناد در domain تولید معنایی و در Documents archive/render می‌شوند                                 | منوی صدور مستقل ایجاد نمی‌شود؛ version/access مرکزی                                                                           |
| ADR-013 | Toolchain پایه Node 24، pnpm 11، Turborepo 2 و TypeScript 6 است                                    | نسخه‌ها pin و در lockfile ثبت می‌شوند؛ TypeScript 7 تا سازگاری lint ecosystem استفاده نمی‌شود                                 |
| ADR-014 | Prisma 7 با `prisma.config.ts`، generator جدید `prisma-client` و adapter PostgreSQL استفاده می‌شود | URL فقط از environment می‌آید؛ schema Technical Bootstrap بدون model معتبر می‌ماند                                            |
| ADR-015 | Worker در این مرحله Nest standalone با BullMQ/ioredis است                                          | فقط اتصال/health queue دارد و هیچ job تجاری یا retry policy حدس‌زده نمی‌شود                                                   |
| ADR-016 | Compose محلی PostgreSQL، Redis و MinIO را فقط روی loopback منتشر می‌کند                            | network پروژه نام‌دار است؛ Nginx تا تعیین domain/topology اضافه نمی‌شود                                                       |
| ADR-017 | PC-A و PC-B هر دو Full-Stack و مالک همه لایه‌های ماژول‌های تخصیص‌یافته‌اند                         | تقسیم ثابت Backend/Frontend حذف می‌شود؛ Migration، Dependency/Lockfile، فایل مرکزی و قرارداد مشترک قفل هماهنگی دارند          |
| ADR-018 | Human Resources ماژول مستقل و Employee جدا از Customer/Passenger است                               | حریم خصوصی و lifecycle استخدام حفظ می‌شود؛ Finance فقط ورودی تاییدشده پرداخت را می‌گیرد و payroll قانونی کامل نسخه اولیه نیست |
| ADR-019 | IAM از Argon2id، access JWT کوتاه‌عمر و refresh opaque چرخشی با Hash ذخیره‌شده استفاده می‌کند          | token خام در DB نیست؛ reuse کل family را revoke می‌کند؛ RBAC و branch scope از قرارداد عمومی منتشر می‌شوند                    |
| ADR-020 | فروش مالک قرارداد و تخصیص passenger/service؛ Ticket Catalog مالک تعریف بلیت؛ Reservations مالک اجرا/صدور/Manifest؛ Procurement مالک خرید؛ Finance مالک release تحویل است | حذف ورود تکراری و جلوگیری از اختلاط فروش/عملیات/خرید/مالی؛ شرح کامل در `TRAVEL_WORKFLOW_ARCHITECTURE.md` |
| ADR-021 | ماژول تولیدکننده مالک Render و Issue سند است؛ Documents فقط فایل نهایی، نسخه، محرمانگی، دسترسی و Archive را مالک است | ADR-012 را در بخش Render supersede می‌کند؛ Metadata هویت صادرکننده از `legal-entities.v1` گرفته می‌شود و هیچ منوی صدور مستقل یا query مستقیم جدول Legal Entity ایجاد نمی‌شود |
| ADR-022 | Master Data فایل XLSX گذرای فیلترشده را مستقیم Render و Download می‌کند؛ PDF و آرشیو پایدار همچنان از Documents/Worker عبور می‌کنند | خروجی Excel عملیاتی بدون جعل Artifact فعال می‌شود؛ سقف ۱۰٬۰۰۰ ردیف، Permission، Audit و ایمنی Formula Injection اجباری است |
| ADR-023 | Snapshot فروش در Reservations تغییرناپذیر می‌ماند؛ رزرواسیون فقط چیدمان اجرایی هتل را برای همان مسافران به‌صورت append-only و versioned اصلاح می‌کند | نیاز عملیات به تغییر اتاق/تخت و اعضای هتل بدون انتقال مالکیت قرارداد؛ تغییر مسافر یا ظرفیت صندلی همچنان اصلاح Sales و کنترل Ticket Catalog است |

## تصمیم‌های باز

| ID           | اولویت | سوال/مالک لازم                                                                                         | اثر در صورت بازماندن                                  |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| DEC-OPEN-002 | P0     | دو سایت: دامنه، برند، channel، ارز، markup و gateway؟ مالک محصول                                       | channel/config/branding                               |
| DEC-OPEN-003 | P0     | Providerهای موج اول و capability/SLA واقعی؟ عملیات سفر                                                 | adapter و reservation states                          |
| DEC-OPEN-006 | P0     | PII/document retention، residency و key management؟ حقوقی/امنیت                                        | data/security/deployment                              |
| DEC-OPEN-007 | P0     | hosting، RPO/RTO، availability و traffic؟ عملیات                                                       | topology/backup/capacity                              |
| DEC-OPEN-008 | P1     | B2B credit exposure و blocking policy؟ فروش B2B/مالی                                                   | order authorization                                   |
| DEC-OPEN-009 | P1     | SLA تقویم کاری، تعطیلات و escalation؟ پشتیبانی                                                         | settings/automation                                   |
| DEC-OPEN-010 | P1     | Prefix و Sequence اتمیک هر نوع سند در scope شرکت صادرکننده و الزامات رسمی PDF؟ مالی/حقوقی             | unique constraints/templates؛ اجرای Sequence به Task بعدی موکول است |
| DEC-OPEN-011 | P1     | Customer duplicate/merge authority و matching thresholds؟ CRM                                          | privacy/audit/workflow                                |
| DEC-OPEN-012 | P1     | attribution model و campaign cost source؟ مارکتینگ                                                     | KPI/reporting                                         |
| DEC-OPEN-013 | P1     | تقویم/شیفت، سیاست حضور و مرخصی، حداقل payroll input و retention پرونده پرسنلی؟ منابع انسانی/مالی/حقوقی | HR workflow، permission، reporting و Finance contract |
| DEC-OPEN-014 | P0     | مشخصات واقعی API بیمه سامان، sandbox، طرح‌ها، cancel/refund و SLA؟ عملیات سفر/بیمه                     | Insurance adapter و state/error mapping               |
| DEC-OPEN-015 | P0     | قالب Excel، تناوب ارسال، کانال انتقال و acknowledgement هر ایرلاین؟ رزرواسیون                          | Manifest template/version/schedule                    |

## روش ثبت تصمیم بعدی

هر تصمیم باید Context، گزینه‌ها، انتخاب، دلیل، consequences، owner/date و migration/reversal plan
داشته باشد. تغییر تصمیم پذیرفته‌شده با ADR جدید supersede می‌شود و تاریخچه حذف نمی‌شود.

## تصمیم‌های پذیرفته‌شده FINANCE-001

مالک محصول و کسب‌وکار در 2026-08-24 هر چهار Decision Record زیر را رسماً پذیرفت:

- [DEC-OPEN-001 — مرز Sub-ledger و حسابداری قانونی](decisions/DEC-OPEN-001-finance-ledger-boundary.md)
- [DEC-OPEN-004 — Money، FX، Tax و Recognition](decisions/DEC-OPEN-004-money-fx-tax-recognition.md)
- [DEC-OPEN-005 — Approval Matrix و Maker/Checker](decisions/DEC-OPEN-005-finance-approval-matrix.md)
- [DEC-OPEN-016 — Financial Release](decisions/DEC-OPEN-016-financial-release-policy.md)

این چهار مورد دیگر تصمیم باز نیستند. پذیرش آن‌ها فقط Gate معماری را رفع می‌کند؛ در
FINANCE-001 Phase A هیچ Prisma Schema، Migration، Repository، Persistence، Dependency یا
Lockfile تغییر نمی‌کند. پس از Merge PR #21، ایجاد Schema و Migration افزایشی مالی فقط در
Task مستقل Phase B، با رزرو مجدد قفل‌ها و Migration gate کامل، مجاز خواهد بود.

## B2B-CONTRACT-CREDIT-001 — decisions confirmed by owner

- A single independent reviewer approves contract/credit changes using the corresponding permission; the proposer cannot approve their own request. Confirmed explicitly in this task on the Screenshot527 follow-up.
- Each currency has a separate credit limit; no implicit FX conversion. Contract/policy drafts have no effective financial authority before approval. Submitted/approved content is versioned and preserved, and edits require a new draft/revision.
- Evolve existing B2B profile/agreement/credit persistence and public routes. Organization identity remains in Master Data, binary/version storage in Documents, and exposure/payment/deposit balances in Finance. This scope completes the contract/credit wizard and its management workflow, not every independent PRD module.
