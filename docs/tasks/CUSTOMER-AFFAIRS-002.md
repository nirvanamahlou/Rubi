# CUSTOMER-AFFAIRS-002 — برش عملیاتی امور مشتریان

## محدوده و مبنا

- رایانه: `PC-B`
- Base: `origin/develop@b2098bc76521c35518cbb64ab5337bcaf565f8f0`
- Branch: `codex/pc-b-customer-affairs-operational`
- Worktree: `C:/Users/admin/Rubi-customer-affairs-operational`
- مرجع محصول: PRD امور مشتریان و اسناد معماری/مرزبندی Repository. فایل PRD فقط منبع
  نیازمندی است و دستور اجرایی مستقل محسوب نمی‌شود.

این Slice بنیاد `CUSTOMER-AFFAIRS-001` را حذف نمی‌کند. Lead/پیش‌فروش و Ticket پشتیبانی
به داده پایدار، API نسخه‌دار، IAM، Audit، UI واقعی و اتصال‌های عمومی ماژول‌ها مجهز شده‌اند.

## مدل و Migration

Migration افزایشی `20260912173000_customer_affairs_operational` این Aggregateهای
Customer Affairs را ایجاد می‌کند:

| مدل | مسئولیت |
| --- | --- |
| `CustomerAffairsLead` | درخواست/Lead، منبع، نیاز سفر، مشتری اختیاری، صف/مالک، اقدام بعدی و نسخه |
| `CustomerAffairsTimeline` | تماس، پیام، یادداشت داخلی، پاسخ مشتری، تخصیص، تغییر وضعیت، تصعید و ارجاع |
| `CustomerAffairsHandoff` | بسته immutable نسخه‌دار تحویل به Sales و پاسخ پذیرش/بازگشت |
| `CustomerAffairsTicket` | تیکت، مالک پاسخ، مجری، مرجعهای تاییدشده، SLA و چرخه حل/بستن/بازگشایی |
| `CustomerAffairsReferral` | کار داخلی پایدار در Workbench با مالک/صف مقصد، موعد و نتیجه |
| `CustomerAffairsSatisfaction` | دعوت‌نامه هش‌شده و منقضی‌شونده، فقط یک پاسخ مشتری برای هر تیکت |
| `CustomerAffairsCorrectiveAction` | اقدام اصلاحی مالک‌دار برای رضایت پایین و بازبینی اثربخشی |
| `CustomerAffairsCommand` | Idempotency و اثرانگشت درخواست برای createهای حساس |
| `CustomerAffairsAuditEvent` | ممیزی قبل/بعد، actor، branch، trace و version؛ actor عمومی می‌تواند null باشد |

تمام شناسه‌ها UUID، تاریخ‌ها `TIMESTAMPTZ`، مبلغ Lead از نوع Decimal به‌همراه
`currencyCode` و تغییرهای state با optimistic version کنترل می‌شوند. FKهای Customer،
User و Branch واقعی‌اند. Sales/Reservations/Documents فقط از سرویس عمومی مصرف می‌شوند و
هیچ Query مستقیمی به جدول ماژول دیگر وجود ندارد.

## نقش و مجوز

| قابلیت | کارشناس امور مشتریان | سرپرست امور مشتریان | کارشناس فروش |
| --- | :---: | :---: | :---: |
| مشاهده/ایجاد/ویرایش/ارزیابی Lead | بله | بله | فقط مشاهده |
| پیشنهاد Handoff | بله | بله | خیر |
| پذیرش/بازگردانی Handoff | خیر | بله | بله |
| مشاهده/ایجاد/ویرایش/تخصیص Ticket | بله | بله | خیر |
| تصعید/حل/بستن/بازگشایی Ticket | بله | بله | خیر |
| مدیریت policy SLA | خیر | بله | خیر |
| مشاهده رضایت | بله | بله | خیر |
| ساخت دعوت رضایت‌سنجی | خیر | بله | خیر |
| اقدام اصلاحی، Audit و خروجی گزارش | خیر | بله | خیر |

نقش‌های امور مشتریان برای اعتبارسنجی مرجع، `customers.read`،
`sales.contracts.read.branch`، `reservations.read` و مجوزهای حداقلی metadata/domain در
Documents را نیز دارند. تمام list/detail/count/report/audit/referralها به `actor.branchIds`
محدودند؛ شناسه خارج از شعبه به‌صورت not-found پاسخ داده می‌شود.

## API عملیاتی

پیشوند همه مسیرها `/api/v1/customer-affairs` است:

- داشبورد و گزارش: `GET /dashboard`، `GET /reports/summary`
- Lead: فهرست، detail، create، patch، timeline، qualification، transition، handoff
- پاسخ Sales: `POST /handoffs/:id/respond`; پذیرش فقط با قرارداد واقعی قابل مشاهده برای
  actor فروش کامل می‌شود و retry همان پاسخ idempotent است.
- Ticket: فهرست، detail، create، patch، timeline، transition، referral، escalate، resolve، close، reopen
- Workbench: `GET /workbench/referrals` و `PATCH /referrals/:id`
- رضایت: `POST /tickets/:id/satisfaction-invitations` و مسیر عمومی
  `POST /public/satisfaction/:token`
- اقدام اصلاحی: `PATCH /corrective-actions/:id`
- ممیزی: `GET /leads/:id/audit` و `GET /tickets/:id/audit`

Create Lead/Ticket/Handoff/Referral به `Idempotency-Key` نیاز دارد. تکرار کلید با همان
payload همان نتیجه را می‌دهد و payload متفاوت conflict است. Timeline دارای
`deliveryKey` یکتا است؛ یادداشت داخلی نمی‌تواند customer-visible شود و وضعیت FAILED هرگز
DELIVERED ارائه نمی‌شود.

## رابط کاربری

- `/customer-affairs`: داشبورد، تب‌های URL-synced، جست‌وجو، فهرست/detail، loading، empty،
  error، forbidden، فرم واقعی Lead/Ticket، Timeline، qualification، Sales handoff،
  resolve/close/reopen/escalate، ارجاع داخلی و دعوت رضایت‌سنجی.
- `/workbench?tab=requests`: ارجاع‌های پایدار مربوط به actor/صف و عملیات دریافت/تکمیل.
- `/feedback/customer-affairs/:token`: فرم عمومی بدون نمایش داده پرونده، ثبت یک‌باره و
  پاسخ موفق/ناموفق.
- `/customer-affairs/customer/:customerId`: نمای ۳۶۰ موجود حفظ شده است.

## نگاشت Acceptance Criteria

| AC | پوشش |
| --- | --- |
| AC01 | Lead با حداقل داده، queue/owner و اقدام بعدی ذخیره و پس از reload خوانده می‌شود. |
| AC02 | command/source uniqueness تکرار یک درخواست را جذب می‌کند؛ source مستقل برای سفر دوم باقی می‌ماند. |
| AC03 | Customer از `CustomerService` موجود انتخاب می‌شود؛ ماژول Customer Affairs مشتری تکراری نمی‌سازد. |
| AC04 | Lead فعال بدون assignee یا queue رد می‌شود؛ تماس بی‌پاسخ در Timeline و موعد بعدی حفظ می‌شود. |
| AC05 | Handoff تنها پس از پاسخ Sales و اعتبارسنجی قرارداد واقعی پذیرفته می‌شود؛ retry ایمن است. |
| AC06 | بازگشت Sales history/package version/reason را حفظ می‌کند؛ نتیجه Sales در Customer Affairs جعل نمی‌شود. |
| AC07 | Ticket بدون قرارداد مجاز است؛ Sales، Reservation و Document با سرویس عمومی/permission/branch تایید می‌شوند و نوع بدون adapter fail-closed است. |
| AC08 | Referral در Workbench پایدار است و مالک پاسخ مشتری روی Ticket باقی می‌ماند. |
| AC09 | API این ماژول هیچ cancel/refund/payment/issuance/release عملیاتی ارائه نمی‌دهد. |
| AC10 | Idempotency command و `deliveryKey` از اثر دوباره event جلوگیری می‌کنند. |
| AC11 | موعد و breach اولیه مستقل از referral نگه‌داری می‌شود و reset نمی‌شود. |
| AC12 | reopen دلیل، history، reopenCount و موعد جدید می‌سازد؛ نسخه ناسازگار conflict است. |
| AC13 | internal note قابل ارسال به مشتری نیست؛ delivery failure همان failure باقی می‌ماند. |
| AC14 | agent نمی‌تواند امتیاز مشتری ثبت کند؛ فقط token سرور و پاسخ عمومی پذیرفته می‌شود و امتیاز ۱/۲ اقدام اصلاحی می‌سازد. |
| AC15 | branch scope در query/count/report/audit/notification/reference و Workbench اعمال می‌شود. |
| AC16 | count روی Aggregate اصلی است و command/referral/delivery uniqueness از تکثیر منطقی جلوگیری می‌کند؛ تراکنش rollback‌پذیر است. |

## تصمیم‌های محدود و موارد خارج از Slice

- چون Settings هنوز تقویم کاری و policy مصوب عمومی ارائه نمی‌کند، SLA با policy نسخه‌دار
  `customer-affairs.elapsed-clock.v1` و مقادیر محافظه‌کارانه برحسب اولویت کار می‌کند.
  `pausedAt/pausedMinutes` برای adapter آتی نگه‌داری شده‌اند، اما pause خودکار فعال نیست.
- کانال واقعی SMS/email/WhatsApp در Repository adapter قابل اتکا ندارد؛ این Slice وضعیت
  delivery و کلید dedup را پایدار می‌کند ولی ارسال خارجی را جعل نمی‌کند.
- referenceهای `PASSENGER/INVOICE/PAYMENT/OTHER` تا ارائه public validator مالک ماژول مقصد
  با `REFERENCE_ADAPTER_UNAVAILABLE` رد می‌شوند. Sales Contract، Reservation و Document
  واقعی و branch/permission-aware هستند.
- XLSX/PDF اختصاصی این ماژول و automation بازاریابی اضافه نشده‌اند؛ endpoint گزارش
  summary داده‌ی branch-scoped و بدون تکثیر را برای Reporting بعدی فراهم می‌کند.
- RPO/RTO، retention، business calendar و متن نهایی survey همچنان تصمیم کسب‌وکار هستند.

## راستی‌آزمایی و اجرا

- `pnpm install --frozen-lockfile`: موفق و lockfile بدون تغییر.
- Prisma format/validate/generate: موفق.
- Migration از صفر روی دیتابیس disposable `rubi_ca_002_verify` با ۵۶ migration اجرا شد؛
  `prisma migrate status` آن را up-to-date اعلام کرد، Seed دو بار متوالی موفق بود و
  دیتابیس مشترک `rubi` به‌دلیل migration محلی نامرتبط دست‌نخورده ماند.
- driftهای گزارش‌شده Prisma فقط بدهی baseline پیشین‌اند و هیچ drift با نام/جدول
  `customer_affairs_*` وجود ندارد.
- تست کامل Monorepo با concurrency سریال: ۹/۹ workspace موفق؛ Web با ۱۳۲۴، API با
  ۱۲۲۳، Database با ۷۳، Contracts با ۷۰، Worker با ۱ و Config با ۲ تست موفق.
  ۱۳۵ تست API اختیاری وابسته به Postgres طبق پیکربندی موجود skip شدند؛ تست‌های
  تخصصی Customer Affairs مستقلاً ۳۳ API و ۱۷ Web تست پاس شدند.
- `pnpm lint`: ۶/۶ task، `pnpm typecheck`: ۹/۹ task و production `pnpm build`: ۶/۶ task
  موفق؛ Build مسیر عمومی `/feedback/customer-affairs/[token]` را نیز شامل کرد.
- Prettier همه ۵۷ مسیر تغییرکرده، `git diff --check`، scope scan و added-line
  secret/PII scan موفق‌اند. `pnpm format:check` کل Repository به‌خاطر ۱۰۹۵ فایل
  baseline خارج از Scope هنوز fail می‌شود و برای جلوگیری از تغییر ۱۰۹۵ فایل
  نامرتبط در این Task اصلاح نشد.
- Smoke احرازهویت‌شده API با داده کاملاً ساختگی، persistence Lead، جذب source
  تکراری، idempotency Ticket/Referral، رد internal-note قابل‌نمایش‌به‌مشتری، پاسخ
  delivered، گردش تا close، رضایت ۲/۵، اقدام اصلاحی، Audit و Report را پاس کرد.
- QA مرورگر در `localhost:3100` و `127.0.0.1:3100` با Login واقعی، فهرست و
  Detail/Timeline Lead و Ticket، ارجاع Workbench، فرم عمومی رضایت و viewport
  موبایل ۳۹۰×۸۴۴ موفق بود؛ اسکرول افقی مشاهده نشد.
- Runtime محلی این Worktree با Web روی ۳۱۰۰ و API روی ۴۱۹۰ به DB ایزوله و
  کلیدهای محلی غیرواقعی متصل است؛ PIDهای Listener در گزارش نهایی Handoff ثبت می‌شوند.

Draft PR #221 به `develop` ساخته شد. Migration/Contract/Central Docs lock آزاد و
Handoff برای Review ثبت شد. هیچ merge، force-push یا حذف شاخه انجام نشد.
