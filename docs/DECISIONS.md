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

## تصمیم‌های باز

| ID           | اولویت | سوال/مالک لازم                                                                                         | اثر در صورت بازماندن                                  |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| DEC-OPEN-001 | P0     | مرز دقیق Sub-ledger و contract حسابداری قانونی؟ مالک مالی                                              | chart/mapping/posting schema                          |
| DEC-OPEN-002 | P0     | دو سایت: دامنه، برند، channel، ارز، markup و gateway؟ مالک محصول                                       | channel/config/branding                               |
| DEC-OPEN-003 | P0     | Providerهای موج اول و capability/SLA واقعی؟ عملیات سفر                                                 | adapter و reservation states                          |
| DEC-OPEN-004 | P0     | ارزها، precision/rounding، FX source، tax و recognition؟ مالی                                          | Money/journal/reporting                               |
| DEC-OPEN-005 | P0     | approval matrix برای purchase/payment/refund/journal؟ مالی/امنیت                                       | RBAC/workflow                                         |
| DEC-OPEN-006 | P0     | PII/document retention، residency و key management؟ حقوقی/امنیت                                        | data/security/deployment                              |
| DEC-OPEN-007 | P0     | hosting، RPO/RTO، availability و traffic؟ عملیات                                                       | topology/backup/capacity                              |
| DEC-OPEN-008 | P1     | B2B credit exposure و blocking policy؟ فروش B2B/مالی                                                   | order authorization                                   |
| DEC-OPEN-009 | P1     | SLA تقویم کاری، تعطیلات و escalation؟ پشتیبانی                                                         | settings/automation                                   |
| DEC-OPEN-010 | P1     | numbering scope اسناد و الزامات رسمی PDF؟ مالی/حقوقی                                                   | constraints/templates                                 |
| DEC-OPEN-011 | P1     | Customer duplicate/merge authority و matching thresholds؟ CRM                                          | privacy/audit/workflow                                |
| DEC-OPEN-012 | P1     | attribution model و campaign cost source؟ مارکتینگ                                                     | KPI/reporting                                         |
| DEC-OPEN-013 | P1     | تقویم/شیفت، سیاست حضور و مرخصی، حداقل payroll input و retention پرونده پرسنلی؟ منابع انسانی/مالی/حقوقی | HR workflow، permission، reporting و Finance contract |

## روش ثبت تصمیم بعدی

هر تصمیم باید Context، گزینه‌ها، انتخاب، دلیل، consequences، owner/date و migration/reversal plan
داشته باشد. تغییر تصمیم پذیرفته‌شده با ADR جدید supersede می‌شود و تاریخچه حذف نمی‌شود.
