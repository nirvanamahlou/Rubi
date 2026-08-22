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
