# برنامه اجرای Rubi

این برنامه backlog سطح محصول را نگهداری می‌کند. اولویت‌ها: `P0` الزامی برای
foundation یا یکپارچگی مالی، `P1` الزامی برای نسخه عملیاتی، `P2` بهبود بعدی.

## دروازه‌های تصمیم پیش از Foundation

- [ ] `DEC-OPEN-001`: دامنه Sub-ledger و مرز اتصال حسابداری قانونی تایید شود.
- [ ] `DEC-OPEN-002`: دو دامنه سایت، برندها، درگاه‌ها و ارزهای قابل فروش مشخص شوند.
- [ ] `DEC-OPEN-003`: Providerهای موج اول و قابلیت واقعی هر API تعیین شوند.
- [ ] `DEC-OPEN-004`: قواعد نگهداری/رمزنگاری مدارک هویتی و محل میزبانی تصویب شود.
- [ ] `DEC-OPEN-005`: تقویم کاری، SLA و نقش‌های تایید مالی اولیه مشخص شوند.
- [ ] `DEC-OPEN-013`: سیاست HR، تقویم/شیفت، payroll input و retention پرسنلی مشخص شوند.

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
- [ ] `ARCH-001`: ادغام معماری تاییدشده فروش/رزرواسیون/بلیت/خرید/مالی در اسناد مرجع

### مرحله 2 — Foundation (`P0`)

- [x] Monorepo با `apps/web`، `apps/api`، `apps/worker` و packages مشترک
- [x] نسخه‌های Node/package manager، lockfile، lint، format، typecheck و test
- [x] Docker Compose برای PostgreSQL، Redis و MinIO؛ health checks
- [x] Prisma Client/PostgreSQL datasource بدون مدل یا Migration تجاری
- [ ] Prisma schema baseline، migration و seed ایمن محیط توسعه
- [ ] `IAM-001`: Auth، refresh rotation، 2FA-ready sessions، users، roles، permissions،
      branch access و Audit رخدادهای امنیتی
- [ ] `MASTER-001`: Master Data پایه، Organization/Organization Role و reference dataهای
      Sprint اول
- [ ] CI برای lint/typecheck/test/build و migration check

## Sprint اول — Foundation (`P0`)

مبنای برنامه: `origin/develop` در Commit
`c4f8bdea79b81abc7fc8c518bc83e7f765383bd3`. ثبت این بخش فقط برنامه‌ریزی است و مجوز
ایجاد کد، Schema، Migration یا Dependency در Branch مستنداتی را نمی‌دهد.

### `IAM-001` — PC-A — `PLANNED`

- Branch آینده: `codex/pc-a-iam-foundation`
- خروجی: ورود/خروج امن، User، Role، Permission، Session، password policy، branch access،
  کنترل دسترسی Backend و Frontend، Audit امنیتی، API، Database، Frontend و Test کامل.
- قفل‌ها از شروع Sprint برای این Task رزرو هستند: Migration Owner، Dependency/Lockfile
  Owner و قراردادهای مشترک IAM همگی PC-A.
- مرز فایل: مسیرهای IAM در API/Web، قراردادهای IAM، Prisma schema/migrations تاییدشده،
  تست و اسناد همان Task. فهرست دقیق فایل‌های مرکزی پیش از اولین تغییر ثبت می‌شود.
- Handoff: قرارداد versioned برای branch reference، authorization، actor و audit به
  `MASTER-001` تحویل می‌شود؛ consumer فقط public contract را مصرف می‌کند.
- پایان Task: تست permission/security، migration validation، lint/typecheck/test/build،
  ثبت hash و آزادسازی صریح هر قفل تکمیل‌شده.

### `MASTER-001` — PC-B — `PLANNED`

- Branch آینده: `codex/pc-b-master-data-foundation`
- خروجی: کشور/شهر، ارز/نرخ ارز، بانک، بیمه، ایرلاین، هتل، آژانس/شرکت، کارگزار،
  لیدر، نحوه آشنایی، active/inactive، جست‌وجو/فیلتر، Excel/PDF، Frontend، API Contract
  و Test.
- مرز فایل اولیه: UI و تست Master Data در `apps/web/**`، مستند/تعریف API Contract و
  mockهای بدون persistence. فایل مشترک دقیق پیش از تغییر رزرو می‌شود.
- محدودیت موقت: تا آزادسازی صریح PC-A هیچ Prisma Migration، تغییر Prisma schema،
  manifest یا `pnpm-lock.yaml` ایجاد نمی‌شود. بخش‌های بدون Migration می‌توانند موازی
  توسعه یابند.
- Handoff: نیازهای branch access، actor/audit و permission به PC-A اعلام و فقط از قرارداد
  عمومی IAM مصرف می‌شوند. نرخ ارز authoritative تا حل `DEC-OPEN-004` نهایی نمی‌شود.
- پس از آزادسازی: PC-B آخرین `origin/develop` و وضعیت قفل‌ها را بررسی و پیش از Schema یا
  Dependency احتمالی یک رزرو مستقل ثبت می‌کند.

### ترتیب اجرا و ادغام

1. این برنامه با Draft PR و Review وارد `develop` می‌شود.
2. هر Task Branch مستقل خود را از آخرین `origin/develop` می‌سازد و ابتدا وضعیت را
   `IN_PROGRESS` می‌کند.
3. `IAM-001` مالک یگانه Migration/Dependency است؛ `MASTER-001` فقط مسیر بدون قفل را
   موازی اجرا می‌کند.
4. هر PR ابتدا به `develop` می‌رود؛ هیچ‌کدام مجاز به Merge خودکار، Force Push یا تغییر
   مستقیم `main`/`develop` نیستند.

### مرحله 3 — CRM و فروش (`P1`)

- [ ] Customer 360، contacts، addresses، companions، consent و duplicate merge
- [ ] Customer Affairs: request/lead، qualification، activities و پشتیبانی قبل/بعد فروش
- [ ] Sales Contract: quotation/version، party/payer/passenger و contract documents
- [ ] تخصیص passenger به ticket/hotel/room/insurance/tour فقط در Sales
- [ ] جریان Request → Availability/Hold → Contract → Finance + Reservation Execution

### مرحله 4 — تعریف بلیت و عملیات رزرواسیون (`P0/P1`)

- [ ] Ticket Catalog: flight/fare version، sale window و inventory/Hold بدون صدور passenger
- [ ] Reservation execution snapshot، availability/Hold و optimistic locking
- [ ] صدور بلیت API/دستی/ظرفیت شرکت، PNR و lifecycle تغییر/استرداد
- [ ] Manifest قالب‌محور و زمان‌بندی‌شده با نسخه اصلاحی/الحاقی
- [ ] فرم هتل/تایید کارگزار/واچر و Adapter بیمه سامان
- [ ] financial release و delivery state مستقل بدون شماره رسمی جعلی e-ticket

### مرحله 5 — فروش آنلاین و Providerها (`P0`)

- [ ] Booking API مرکزی و احراز هویت جداگانه دو سایت
- [ ] Provider Adapter contract، normalization، mock/sandbox و external mapping
- [ ] Search cache، recheck، payment، booking، issue و webhook queues
- [ ] idempotency، timeout، retry، circuit breaker و rate limit
- [ ] سناریوی payment success + issue failure با task، retry و refund/manual follow-up

### مرحله 6 — خرید و مالی (`P0`)

- [ ] Purchase Request از Reservations با contract/service/passenger/supplier reference
- [ ] supplier quote/discount، net purchase versioned و margin محاسباتی
- [ ] خرید سفر خودکار/دستی و زنجیره PR → PO → Receipt → Invoice → Payable
- [ ] Sales/Purchase invoices، receivable/payable، settlement، refund و commission
- [ ] Journal Entry/Lines دوطرفه و مانده محاسباتی حساب‌ها
- [ ] Bank/Cash accounts، transfers، reconciliation و چک/یادآوری سررسید
- [ ] Financial Release برای تحویل بلیت/واچر/بیمه به فروش

### مرحله 7 — عملیات ارتباطی (`P1`)

- [ ] Customer Service، SLA، escalation و satisfaction
- [ ] Marketing، segment، consent، campaign، UTM و attribution
- [ ] Agency/Corporate contracts، credit، agreed rates و settlement
- [ ] HR: پرونده مستقل کارمند، ساختار سازمانی، قرارداد، حضور/شیفت، مرخصی/ماموریت و اضافه‌کاری
- [ ] HR: ارزیابی، آموزش/گواهینامه، تجهیزات/اسناد، یادآوری و گزارش Permission-aware
- [ ] قرارداد تاییدشده HR → Finance برای ورودی پرداخت؛ payroll قانونی کامل خارج از محدوده
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
