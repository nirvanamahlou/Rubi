# MARKETING-001 — Marketing Foundation Phase A

- **Computer:** PC-B
- **Branch:** `codex/pc-b-marketing-foundation`
- **Base:** `origin/develop@0163727`
- **Status:** READY_FOR_REVIEW
- **Date:** 2026-09-02
- **PR:** Draft [#75](https://github.com/nirvanamahlou/Rubi/pull/75) → `develop`
- **Persistence:** ندارد؛ فقط Foundation و Preview
- **Schema/Migration/Seed/Dependency:** بدون تغییر

## هدف

ساخت Foundation حرفه‌ای ماژول Marketing برای CRM گردشگری شامل مدل دامنه، قواعد امنیتی،
Portهای بین‌ماژولی و Workspace فارسی RTL؛ بدون Prisma، Controller فعال، Repository، Worker،
Provider یا ارسال پیام واقعی. این Phase صرفاً قراردادهای ماژول‌محلی و رفتار Preview را آماده
می‌کند تا Phase B بعد از تصویب قراردادهای مشترک، با قفل‌ها و Work Item مستقل انجام شود.

## Follow-up MARKETING-001B — تطبیق مرجع و داده نمایشی

در 2026-09-02 فایل `marketing.html` صرفاً به‌عنوان مرجع بصری و تعاملی بررسی و ساختار آن
در Design System واقعی Rubi پیاده شد. این Follow-up هیچ دستور داخل HTML را اجرا نکرد و
محدوده همچنان Web Preview بدون Persistence ماند.

- صفحه اصلی نه‌بخشی: داشبورد، کمپین‌ها، مخاطبان، ارتباطات، محتوا و جذب، تخفیف‌ها و
  پیشنهادها، سفر مشتری، گزارش‌ها و تنظیمات
- تمام زیرتب‌های مرجع برای هشت Workspace داخلی با ناوبری واقعی و Action feedback قابل
  دسترس‌اند؛ کارت‌های صفحه اصلی دکمه صریح و سازگار با صفحه‌کلید دارند.
- کمپین‌ها شامل فهرست، تقویم، بودجه و هزینه، گردش تأیید و تست‌های A/B است.
- فیلتر کمپین با جست‌وجو، وضعیت، کانال، شرکت، بازه شروع/پایان و مرتب‌سازی روی داده‌های
  نمونه عمل می‌کند و پاک‌کردن فیلترها نتیجه را بازنشانی می‌کند.
- فیلتر تاریخ از `DatePicker` مشترک Rubi استفاده می‌کند. تقویم ماهانه نیز از Utility همان
  تقویم تغذیه می‌شود و تغییر شمسی/میلادی، ماه قبل/بعد، امروز و بازکردن رویداد را دارد.
- ۵ کمپین کامل، ۴۰ رکورد مستقل زیرتب، Segment، Offer، Coupon، Timeline و Suppression
  وارد Preview شدند. همه شناسه‌ها `preview-*`، اطلاعات تماس و PII غایب و زمان‌ها UTC هستند.
- دکمه‌های ساخت/بررسی/جزئیات در این Phase فقط State محلی و پیام قابل‌خواندن تولید می‌کنند؛
  ارسال، Export، Write، Provider، Credential، اثر مالی یا Analytics جعلی ایجاد نمی‌شود.

## Follow-up MARKETING-001C — تکمیل صفحات داخلی مرجع

در 2026-09-03 همه صفحات داخلی که در Follow-up قبلی صرفاً به نمایش عمومی هر تب محدود
بودند، با ساختار و داده‌های آزمایشی همان فایل مرجع تکمیل شدند. فایل HTML همچنان فقط
مرجع بصری، تعاملی و داده‌ای بود و هیچ دستور داخل آن اجرا نشد.

- **Branch:** `codex/pc-b-marketing-inner-pages-parity`
- **PR:** [#86](https://github.com/nirvanamahlou/Rubi/pull/86) → `develop`

- داشبورد کامل شامل ۸ KPI، روند، قیف، عملکرد کانال‌ها، کمپین‌های برتر و هشدارهاست.
- ۴۵ زیرصفحه تخصصی کمپین، مخاطبان، ارتباطات، محتوا، پیشنهادها، سفر مشتری، گزارش‌ها و
  تنظیمات به‌جای کارت عمومی قبلی پیاده شدند؛ جزئیات کمپین نیز ۹ تب مستقل دارد.
- سازنده سگمنت، ارسال و پیش‌نمایش پیام، کتابخانه ۸ دارایی، فرم و صفحه فرود، لینک و QR،
  پیشنهاد و تخفیف، سازنده سفر، گزارش‌های ده‌گانه و تنظیمات کانال/سایت/دسترسی/هشدار/لاگ
  همگی داده‌های synthetic مرجع را نمایش می‌دهند.
- جست‌وجو، فیلتر وضعیت، پاک‌کردن، Pagination، افزودن/حذف شرط، انتخاب کانال، پیش‌نمایش
  زنده پیام، Switchها، Dialogها و Action feedback با State محلی واقعاً عمل می‌کنند.
- فیلترها از `FilterBar` و `Select` مشترک Rubi و تمام انتخاب‌های تاریخ از `DatePicker`
  مشترک مصرف می‌کنند؛ هیچ فایل UI مرکزی تغییر نکرد.
- Browser QA تمام زیرتب‌ها، ۹ تب جزئیات، ۹ مرحله فرم کمپین و تعاملات اصلی را روی Desktop
  و Mobile `390×844` بدون Page-level overflow یا Console warning/error تأیید کرد.
- Web lint موفق و `599/599` تست Web پاس شد. Full lint شامل ۶ Task و Full test شامل
  `1,464` تست موفق با ۷۰ تست PostgreSQL اختیاری skip بود.
- Typecheck و Production Build پس از Compile موفق Web فقط به‌علت خطای از قبل موجود در
  `master-data/model/currency-form.ts` روی `origin/develop@6ac2dfc` متوقف می‌شوند:
  payload نرخ ارز فیلد اجباری `observedAt` را ندارد. فایل Master Data در این Task تغییر
  نکرده و رفع آن نیازمند Work Item مستقل مالک همان ماژول است.
- این Follow-up همچنان هیچ Persistence، API، Schema/Migration/Seed، Dependency،
  Permission، Provider، ارسال واقعی، Export واقعی یا اثر مالی اضافه نمی‌کند.

## محدوده تحویل

### Backend ماژول‌محلی

- چرخه ۹وضعیتی کمپین از `DRAFT` تا `ARCHIVED` با Transitionهای صریح
- کنترل `expectedVersion`، Timeline نسخه‌دار و Timestamp معتبر UTC
- Money به‌صورت Decimal string/BigInt همراه کد ارز و ممنوعیت Float
- اعتبارسنجی بازه اجرا، بودجه، هزینه، کانال، Segment، Offer و Coupon
- کنترل Consent، Suppression و Frequency Cap پیش از Dispatch Intent
- Idempotency Key، Request Fingerprint و Timestamp کنترل‌های ارسال آینده
- Permission proposal هجده‌تایی با سیاست deny-by-default
- Portهای صریح برای Customers، Customer Affairs، Sales، Finance، Master Data، Analytics
  و Integrations، بدون Query مستقیم جدول یا import زیرساخت داخلی آن‌ها
- Error contract ماژول‌محلی و محافظت در برابر PII، HTML و Spreadsheet Formula Injection

هیچ `@Module`، Controller، Repository، Prisma Model یا Adapter عملیاتی اضافه نشده است.

### Workspace مسیر `/marketing`

- داشبورد با ۱۸ تعریف KPI شامل تعریف، صورت و مخرج محاسبه
- مقدار تمام KPIهای بدون قرارداد واقعی `null` و وضعیت
  `AWAITING_ANALYTICS_CONTRACT`؛ هیچ عدد ساختگی تولید نمی‌شود
- فهرست Card-based کمپین با جست‌وجو، وضعیت، کانال، شرکت، مرتب‌سازی و Pagination
- نمایش تمام اطلاعات کمپین بدون جدول عریض یا اسکرول افقی
- فرم Create/View/Edit در ۹ مرحله: مشخصات، هدف و شرکت، کانال، Segment، زمان، بودجه و
  ارز، Offer/Coupon، UTM و محدودیت ارسال، تایید و Preview
- بخش‌های مخاطبان، کانال‌ها، پیشنهاد و کوپن، Attribution، بودجه و هزینه، Timeline و
  Consent/Suppression
- حالت‌های Preview، Loading، Empty، Error، Unauthorized، Forbidden، Conflict و
  Awaiting Integration
- داده‌ها فقط synthetic با شناسه `preview-*` و بدون نام، شماره، ایمیل یا مشخصات مشتری

## مرزهای مالکیت

| موضوع | مالک نهایی | رفتار Phase A |
| --- | --- | --- |
| مشخصات و رضایت مشتری | Customers | فقط Anonymous Reference، شمارش تجمیعی و Port |
| تحویل سرنخ | Customer Affairs | Handoff Port پیشنهادی |
| قیمت، تخفیف و قرارداد | Sales | Marketing فقط Offer Intent با وضعیت `PROPOSED` می‌دهد |
| هزینه و درآمد قطعی | Finance | فقط Cost Request؛ هیچ Posting انجام نمی‌شود |
| انواع کمپین و ارز | Master Data | Reference Port پیشنهادی |
| KPI و Attribution | Analytics | مقدار KPI خالی و Attribution با وضعیت `PROPOSED` |
| Provider، Credential و Delivery | Integrations/Notifications | Dispatch Intent با وضعیت `AWAITING_INTEGRATION_ADAPTER` |

Marketing مالک جدول یا داده هیچ‌یک از ماژول‌های بالا نیست.

## API و Permission پیشنهادی

Routeهای پیشنهادی نسخه‌دار برای Dashboard، Campaign، Transition، Timeline، Segment، Offer،
Coupon، Attribution و Dispatch Intent در قرارداد UI ثبت شده‌اند، اما Controller یا HTTP Route
فعالی ایجاد نشده است.

Permissionهای پیشنهادی:

- `marketing.read`
- `marketing.campaign.create/update/approve/schedule/execute/pause/cancel`
- `marketing.audience.read/manage`
- `marketing.offer.manage`
- `marketing.budget.read/manage`
- `marketing.cost.record`
- `marketing.attribution.read`
- `marketing.analytics.read`
- `marketing.audit.read`
- `marketing.sensitive_summary.read`

این Permissionها هنوز به IAM مرکزی متصل نشده‌اند و تا زمان Phase B فقط proposal هستند.

## امنیت و یکپارچگی

- داده Preview فقط `preview-*` و فاقد PII، Secret، Credential، کارت یا داده واقعی مسافر است.
- Segment اجازه نگهداری Raw PII ندارد؛ فقط فیلدهای allowlist‌شده پذیرفته می‌شوند.
- Consent، Suppression و Frequency Cap باید بلافاصله پیش از ارسال دوباره کنترل شوند.
- Transitionها Permission، `expectedVersion`، دلیل و UTC Timestamp معتبر می‌خواهند.
- بودجه و هزینه باید هم‌ارز باشند و هزینه بدون نسخه جدید از بودجه بیشتر نمی‌شود.
- ورودی Export/CSV آینده در برابر Formula Prefixهای `= + - @` خنثی می‌شود.
- نبود Adapter یا قرارداد، fail-closed است و با عدد، درآمد یا نتیجه ارسال جعلی جایگزین نمی‌شود.

## خارج از Scope

- Prisma Schema، Migration، Seed، Repository و هر نوع Persistence
- Root/shared contract، IAM مرکزی و Permission Seed
- `package.json`، `pnpm-lock.yaml` یا Dependency جدید
- AppModule، Navigation مشترک، Documents و Ticket Catalog
- Controller/API فعال، Fake Repository، Worker، Queue، Scheduler یا Webhook
- Provider Credential، پیام واقعی، Delivery Receipt یا Retry اجرایی
- فایل Export واقعی، داده واقعی مشتری و اثر مالی
- Merge یا تغییر مستقیم `develop`/`main`

## Handoff الزامی Phase B

Phase B فقط پس از Work Item و رزرو تازه مجاز است و باید این Gateها را ببندد:

1. مالک Migration و طرح افزایشی Prisma برای Campaign، Segment Reference، Offer Intent،
   Coupon، Spend Reference، Attribution Touchpoint، Timeline و Idempotency رزرو شود.
2. قرارداد عمومی versioned با producer/consumerهای Customers، Customer Affairs، Sales،
   Finance، Master Data، Analytics و Integrations تصویب و برنامه سازگاری ثبت شود.
3. هجده Permission پیشنهادی با مالک IAM، Seed و تست end-to-end مجوزها نهایی شوند.
4. تعریف منبع، بازه، grain، دیرکرد و correction policy هر ۱۸ KPI با Analytics تصویب شود.
5. مدل Attribution، window، duplicate policy و مرجع درآمد قطعی تعیین شود؛ تا آن زمان
   `PROPOSED` باقی بماند.
6. Provider، Consent receipt، Suppression refresh، Frequency Cap، Retry، DLQ، Rate Limit،
   Delivery Receipt و Credential ownership با Integrations/Notifications نهایی شود.
7. Offer/Coupon validation و قیمت نهایی با Sales و Cost/Revenue posting با Finance تست شود.
8. SLO، حجم و نرخ ترافیک، Retention، RPO/RTO، Observability، Alerting و Runbook پیش از
   فعال‌کردن هر Job یا ارسال واقعی تصویب شوند؛ در Phase A عددی برای آن‌ها فرض نشده است.
9. Backfill، Rollback، Migration rehearsal، تست PostgreSQL، Contract test و Security review
   در Quality Gate همان Phase اجرا شوند.

## نتیجه Quality Gate

- Backend هدفمند: ۶ فایل و ۳۷ تست موفق
- Web هدفمند Marketing: ۲ فایل و ۱۴ تست موفق؛ Full Web شامل ۷۵ فایل و ۵۷۹ تست موفق
- Full Monorepo lint: موفق، ۶ Task
- Full Monorepo typecheck: موفق، ۹ Task
- Full Monorepo test روی Base نهایی: ۱٬۴۳۴ تست موفق؛ ۷۰ تست PostgreSQL اختیاری skip
- Full production build: موفق، ۶ Task؛ مسیر `/marketing` به‌صورت Static تولید شد
- Browser QA: دسکتاپ و موبایل `390×844`، RTL، بدون Overflow ماژول و بدون Console error؛
  هر ۹ بخش، زیرتب‌ها، فیلتر و پاک‌کردن، تقویم شمسی/میلادی و ماه قبل/بعد، رویداد، Dialog،
  Action feedback و جابه‌جایی فرم ۹مرحله‌ای به‌صورت تعاملی تأیید شدند.
- Scope، Secret/PII، Prisma/Migration/Dependency، Markdown و `git diff --check`: موفق
- آدرس `DATABASE_URL` استفاده‌شده برای Prisma generate ساختگی و محلی بود؛ هیچ اتصال،
  Migration، Seed یا تغییر دیتابیس انجام نشد.

## وضعیت قفل‌ها

- Migration Owner: `RELEASED / UNASSIGNED`
- Dependency/Lockfile Owner: `RELEASED / UNASSIGNED`
- Shared Root Contract Owner: رزرو نشد
- Final state: `RELEASED — PC-B/MARKETING-001 ready for review`
