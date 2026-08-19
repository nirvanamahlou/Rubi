# معماری گزارش و خروجی

## اصل منبع داده

Dashboard و گزارش رسمی فقط از Reporting Viewهای تاییدشده تغذیه می‌شوند. Query روی جدول
عملیاتی برای گزارش ad-hoc ممکن است، اما نتیجه رسمی نیست تا grain، measure و reconciliation آن
تایید شود.

## Grainهای استاندارد

| View | Grain | measureهای مجاز نمونه |
|---|---|---|
| `reporting_order_facts` | یک Travel Order | sale total، paid/refunded allocated، gross profit |
| `reporting_order_item_facts` | یک Order Item | buy/sell/tax/discount/commission/margin |
| `reporting_reservation_facts` | یک Reservation | booking/issue counts و durations؛ amount pre-aggregated |
| `reporting_passenger_facts` | یک passenger در order | passenger count؛ مبلغ order مستقیم جمع نمی‌شود |
| `reporting_segment_facts` | یک segment | route/carrier count؛ مبلغ order مستقیم جمع نمی‌شود |
| `reporting_ticket_facts` | یک issued document/passenger | document count/status؛ allocated amount تعریف‌شده |
| `reporting_payment_facts` | یک payment transaction | verified amount، refund، gateway fee |
| `reporting_journal_balance_facts` | account/currency/day | posted debit/credit/balance movement |

در join چند grain، measure ابتدا در grain خودش aggregate و سپس join می‌شود. fixture تست باید
Order دارای چند passenger و segment داشته باشد تا duplication آشکار شود.

## فیلترهای مشترک

date range و date basis صریح، site/channel، branch، agent، service type، agency، Provider،
currency و status. timezone گزارش و FX basis همراه report metadata ثبت می‌شود.

## خروجی

- PDF برای سند رسمی/چاپ، Excel برای تحلیل، CSV برای انتقال و API برای سیستم دیگر
- permission snapshot و row/column masking؛ sensitive fields پیش‌فرض حذف
- creator، generatedAt، filters، timezone، currency/FX basis، data-as-of و report version
- فایل بزرگ به‌صورت job، ذخیره در Documents و download کوتاه‌عمر/audited
- template/branding مجزا برای دو سایت

## کنترل کیفیت و reconciliation

- فروش با invoice/order state مصوب و وصول با verified payment جدا گزارش می‌شود.
- refund بر اساس completed refund؛ درخواست refund جداست.
- Provider payable با approved purchase invoice/journal reconciliation می‌شود.
- balance فقط posted journal lines؛ draft/void خارج.
- هر KPI owner، grain، فرمول، exclusions، freshness و drill-down دارد.
- تغییر View/KPI versioned و با نمونه قبل/بعد review می‌شود.

تعاریف KPI در [KPI_DICTIONARY.md](KPI_DICTIONARY.md) است.
