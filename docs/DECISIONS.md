# تصمیم‌های معماری

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