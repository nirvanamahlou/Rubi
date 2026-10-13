# معماری گزارش و خروجی

## اصل منبع داده

Dashboard و گزارش رسمی فقط از Reporting Viewهای تاییدشده تغذیه می‌شوند. Query روی جدول
عملیاتی برای گزارش ad-hoc ممکن است، اما نتیجه رسمی نیست تا grain، measure و reconciliation آن
تایید شود.

## Grainهای استاندارد

| View                              | Grain                                | measureهای مجاز نمونه                                          |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `reporting_sales_contract_facts`  | یک Sales Contract                    | sale total، paid/refunded allocated و gross margin             |
| `reporting_contract_service_facts` | یک Contract Service Item            | sell/tax/discount و approved net purchase/margin               |
| `reporting_reservation_facts`     | یک Reservation Operation             | booking/issue counts و durations؛ amount pre-aggregated        |
| `reporting_contract_passenger_facts` | یک passenger در قرارداد           | passenger count؛ مبلغ قرارداد مستقیم جمع نمی‌شود              |
| `reporting_ticket_inventory_facts` | یک departure/inventory snapshot     | total/held/sold/remaining و utilization                        |
| `reporting_manifest_facts`        | یک Manifest Version                  | passenger count، sent/ack duration و correction count          |
| `reporting_purchase_request_facts` | یک Purchase Request                 | quote، supplier discount، fee/tax، net purchase و status       |
| `reporting_supplier_discount_facts` | supplier/service/date              | negotiated discount و اثر آن بر margin                         |
| `reporting_segment_facts`         | یک segment                           | route/carrier count؛ مبلغ contract مستقیم جمع نمی‌شود          |
| `reporting_ticket_facts`          | یک issued document/passenger         | document count/status؛ allocated amount تعریف‌شده              |
| `reporting_payment_facts`         | یک payment transaction               | verified amount، refund، gateway fee                           |
| `reporting_journal_balance_facts` | account/currency/day                 | posted debit/credit/balance movement                           |
| `reporting_hr_headcount_facts`    | یک employee assignment در بازه معتبر | headcount، join/leave، branch/unit/position؛ بدون PII غیرضروری |
| `reporting_hr_time_facts`         | یک employee/work date/type تاییدشده  | attendance، leave، mission و overtime duration                 |

در join چند grain، measure ابتدا در grain خودش aggregate و سپس join می‌شود. fixture تست باید
Contract دارای چند passenger، service و Manifest row باشد تا duplication آشکار شود.

## فیلترهای مشترک

date range و date basis صریح، site/channel، branch، agent، service type، agency، Provider،
currency و status. timezone گزارش و FX basis همراه report metadata ثبت می‌شود.
گزارش HR علاوه بر فیلترهای عمومی می‌تواند واحد، سمت، مدیر، وضعیت استخدام و نوع
قرارداد/حضور را داشته باشد؛ فیلتر و drill-down آن تابع permission داده حساس است.

## خروجی

- PDF برای سند رسمی/چاپ، Excel برای تحلیل، CSV برای انتقال و API برای سیستم دیگر
- permission snapshot و row/column masking؛ sensitive fields پیش‌فرض حذف
- creator، generatedAt، filters، timezone، currency/FX basis، data-as-of و report version
- فایل بزرگ به‌صورت job، ذخیره در Documents و download کوتاه‌عمر/audited
- template/branding مجزا برای دو سایت

## کنترل کیفیت و reconciliation

- فروش با contract/invoice state مصوب و وصول با verified payment جدا گزارش می‌شود.
- refund بر اساس completed refund؛ درخواست refund جداست.
- Provider payable با approved purchase invoice/journal reconciliation می‌شود.
- margin برابر sale snapshot منهای approved net purchase است؛ supplier discount جداگانه
  گزارش می‌شود و نباید به‌صورت سود دستی ذخیره شود.
- balance فقط posted journal lines؛ draft/void خارج.
- هر KPI owner، grain، فرمول، exclusions، freshness و drill-down دارد.
- گزارش‌های HR به‌صورت پیش‌فرض aggregated/masked هستند؛ payroll input و پرونده فردی
  فقط با permission و audit جدا export می‌شود.
- تغییر View/KPI versioned و با نمونه قبل/بعد review می‌شود.

تعاریف KPI در [KPI_DICTIONARY.md](KPI_DICTIONARY.md) است.

## وضعیت زمان‌بندی گزارش

قابلیت زمان‌بندی گزارش بنا بر تصمیم مالک محصول از UI و API عمومی Reports حذف شده
است. مدل و جدول تاریخی فعلاً فقط برای جلوگیری از حذف داده نگه‌داری می‌شوند و هیچ
Endpoint عمومی برای خواندن، ایجاد یا تغییر زمان‌بندی وجود ندارد.

## محیط دموی محلی گزارش‌ها

- API نسخه‌دار Reports از مسیر `/api/v1/reports` و Projection تأییدشده
  `reporting.travel.facts.v1` داده را می‌خواند؛ مبلغ‌ها در Grain «یک آیتم سفارش سفر + ارز»
  جمع می‌شوند تا تعداد مسافر یا Segment باعث چندبرابرشدن مبلغ نشود.
- جدول Preview همه ستون‌های پاسخ Projection را نمایش می‌دهد و مرتب‌سازی هر ستون از
  فلش همان سرستون به Backend ارسال می‌شود. صفحه‌بندی پس از مرتب‌سازی اعمال می‌شود.
- داده دموی قبلی با دستور `pnpm reporting:demo:import -- <absolute-fixture-path>` به‌صورت
  idempotent وارد PostgreSQL محلی می‌شود. Fixture باید ignored و خارج از Git بماند؛
  importer هیچ داده نمونه‌ای را در Seed عمومی یا Repository نگه نمی‌دارد.
- خروجی CSV، XLSX و PDF در Backend ساخته می‌شود، metadata آن در PostgreSQL ثبت و فایل
  از abstraction ماژول Documents نگه‌داری/دانلود می‌شود.
- فرم پیکربندی Reports فقط خروجی Excel (`XLSX`) درخواست می‌کند. فایل Excel در سطر اول
  نام گزارش و زمان تولید UTC، در سطرهای دوم و سوم عنوان و مقدار فیلترهای ثبت‌شده در
  snapshot، و از سطر چهارم جدول کامل ردیف‌های مجاز گزارش را نشان می‌دهد. کد گزارش و
  نام Projection در محتوای workbook نمایش داده نمی‌شوند؛ snapshot و شناسه فنی همچنان
  در metadata/audit سمت سرور باقی می‌مانند. ستون‌های عددی با فرمت هزارگان Excel
  ذخیره می‌شوند؛ شناسه‌ها متن‌اند و مبالغ فراتر از دقت ۱۵رقمی Excel برای حفظ مقدار
  دقیق به‌صورت متن گروه‌بندی‌شده صادر می‌شوند.

### دادهٔ دموی Dashboard و Reports

- `pnpm reporting:demo:generate` فقط در PostgreSQL محلی، ۱۸۰ رخداد واقعی‌نمای سفر
  با کانال فروش، خدمت، Provider، مسیر، وضعیت رزرو/صدور/پرداخت و دو ارز می‌سازد.
  هیچ رکورد تولیدشده یا فایل fixture در Git ثبت نمی‌شود.
- Dashboard از Projection نسخه‌دار `reporting.dashboard.travel.v1` و grain
  `reporting.travel.facts.v1` می‌خواند. فقط شاخص‌ها/نمودارهای قابل محاسبه از fact سفر
  و ۱۲ گزارش سفر دارای ابعاد تعریف‌شده Preview/Export می‌شوند. ارزها در KPI مستقل
  هستند و نمودار مبلغ، یک ارز را نمایش می‌دهد؛ IRR در داده دمو پیش‌فرض است.
- گزارش‌های چک، دفتر مالی، HR، SLA و سایر حوزه‌های فاقد Public Projection مالک دامنه
  تا اتصال Producer اختصاصی «در انتظار منبع» می‌مانند؛ fact سفر جایگزین آن داده‌ها نیست.
- برای بررسی read-only پوشش داده دمو در بازه ماه، از داخل `packages/database` فرمان
  `node scripts/dashboard-reporting-local-demo.mjs --inspect` را اجرا کنید.
- پیش از deploy یا برای پاک‌سازی، `pnpm reporting:demo:clear` را اجرا کنید. این فرمان
  فقط رکوردهایی با پیشوند `LOCAL_DEMO_DASHBOARD_REPORTING_` را حذف می‌کند و به هیچ
  دادهٔ عملیاتی، کاربر، شعبه یا خروجی کاربر دست نمی‌زند.

## اشتراک‌گذاری مستقیم گزارش ذخیره‌شده

- اشتراک‌گذاری از فرم پیکربندی یا ردیف گزارش در «گزارش‌های من» انجام می‌شود و هر
  دریافت‌کننده با یک grant صریح در `reporting_saved_report_shares` ثبت می‌شود؛ حالت
  عمومی TEAM مبنای دسترسی کاربران جدید نیست.
- فقط مالک گزارش با مجوز `reporting.share` می‌تواند فهرست دریافت‌کنندگان را تغییر دهد.
  این مجوز به‌صورت پیش‌فرض به Roleهایی داده می‌شود که `reporting.manage` دارند.
- دریافت‌کننده باید فعال، دارای `reporting.read` و مجوز دامنه همان گزارش باشد. برای
  مالک فاقد `reporting.manage`، فهرست انتخاب به کاربران دارای شعبه مشترک محدود است.
- Filter State همراه گزارش ذخیره می‌شود؛ هنگام اجرای گزارش اشتراکی، Permission و Scope
  شعبه دریافت‌کننده دوباره سمت سرور enforce می‌شود و grant اشتراک Scope داده را گسترش
  نمی‌دهد.
- شمارنده و صفحه «اشتراک‌گذاری‌شده با من» فقط grantهای صریح کاربر جاری را نمایش می‌دهد.
