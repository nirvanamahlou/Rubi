# برنامه اجرای Rubi

این برنامه backlog سطح محصول را نگهداری می‌کند. اولویت‌ها: `P0` الزامی برای
foundation یا یکپارچگی مالی، `P1` الزامی برای نسخه عملیاتی، `P2` بهبود بعدی.

## دروازه‌های تصمیم پیش از Foundation

- [ ] `DEC-OPEN-001`: دامنه Sub-ledger و مرز اتصال حسابداری قانونی تایید شود.
- [ ] `DEC-OPEN-002`: دو دامنه سایت، برندها، درگاه‌ها و ارزهای قابل فروش مشخص شوند.
- [ ] `DEC-OPEN-003`: Providerهای موج اول و قابلیت واقعی هر API تعیین شوند.
- [ ] `DEC-OPEN-004`: قواعد نگهداری/رمزنگاری مدارک هویتی و محل میزبانی تصویب شود.
- [ ] `DEC-OPEN-005`: تقویم کاری، SLA و نقش‌های تایید مالی اولیه مشخص شوند.

## مراحل

### مرحله 1 — Bootstrap و طراحی (`P0`)

- [x] بررسی Repository و اتصال به `rubi`
- [x] PRD و محدوده محصول
- [x] معماری، مرز ماژول‌ها و تصمیم‌های اولیه
- [x] ERD و Data Dictionary اولیه
- [x] KPI Dictionary و قواعد گزارش‌گیری
- [x] API conventions، مدل امنیت و integration contracts
- [x] قرارداد همکاری PC-A/PC-B و backlog
- [ ] بازبینی و تایید اسناد توسط PC-B/مالک محصول

### مرحله 2 — Foundation (`P0`)

- [ ] Monorepo با `apps/web`، `apps/api`، `apps/worker` و packages مشترک
- [ ] نسخه‌های Node/package manager، lockfile، lint، format، typecheck و test
- [ ] Docker Compose برای PostgreSQL، Redis و MinIO؛ health checks
- [ ] Prisma schema baseline، migration و seed ایمن محیط توسعه
- [ ] Auth، refresh rotation، 2FA-ready sessions، users، roles و permissions
- [ ] Audit Log، structured logging، error model و correlation ID
- [ ] Master Data پایه و مدل Organization/Organization Role
- [ ] CI برای lint/typecheck/test/build و migration check

### مرحله 3 — CRM و فروش (`P1`)

- [ ] Customer 360، contacts، addresses، companions، consent و duplicate merge
- [ ] Leads، sources، pipeline، opportunities، activities و quotations
- [ ] تبدیل Lead → Customer → Opportunity → Quotation → Travel Order

### مرحله 4 — سفارش و رزرو (`P0/P1`)

- [ ] Travel Order، Order Item، passenger و service-specific reservations
- [ ] رزرو دستی، state machines، history و optimistic locking
- [ ] تولید بلیت/واچر داخلی مجاز، نسخه‌بندی، QR و archive
- [ ] invoice/payment linkage بدون تولید شماره رسمی جعلی e-ticket

### مرحله 5 — فروش آنلاین و Providerها (`P0`)

- [ ] Booking API مرکزی و احراز هویت جداگانه دو سایت
- [ ] Provider Adapter contract، normalization، mock/sandbox و external mapping
- [ ] Search cache، recheck، payment، booking، issue و webhook queues
- [ ] idempotency، timeout، retry، circuit breaker و rate limit
- [ ] سناریوی payment success + issue failure با task، retry و refund/manual follow-up

### مرحله 6 — خرید و مالی (`P0`)

- [ ] خرید سفر خودکار/دستی و زنجیره PR → PO → Receipt → Invoice → Payable
- [ ] Sales/Purchase invoices، receivable/payable، settlement، refund و commission
- [ ] Journal Entry/Lines دوطرفه و مانده محاسباتی حساب‌ها
- [ ] Bank/Cash accounts، transfers، reconciliation و چک/یادآوری سررسید

### مرحله 7 — عملیات ارتباطی (`P1`)

- [ ] Customer Service، SLA، escalation و satisfaction
- [ ] Marketing، segment، consent، campaign، UTM و attribution
- [ ] Agency/Corporate contracts، credit، agreed rates و settlement
- [ ] Tasks، approvals، automation rules/runs و notifications

### مرحله 8 — آمادگی انتشار (`P0/P1`)

- [ ] Reporting Views، dashboard، PDF/Excel/CSV/API exports
- [ ] تست امنیت، permission، payment/issue/refund failure و performance
- [ ] backup/restore drill، monitoring، Sentry و retention policy
- [ ] Staging deployment و smoke/E2E؛ production readiness review

## Definition of Ready

نیازمندی، معیار پذیرش، مالک، مرز ماژول، مدل داده، permissionها، سناریوهای شکست و
وابستگی‌ها مشخص شده و فایل‌های مشترک رزرو شده‌اند.

## Definition of Done

پیاده‌سازی، validation، permission، audit، migration، UI states، تست‌های مرتبط،
خروجی لازم و مستندات تکمیل شده؛ هیچ Secret وارد Git نشده و وضعیت/تخصیص به‌روز و
شاخه Push شده است.
