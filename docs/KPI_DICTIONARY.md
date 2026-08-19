# KPI Dictionary اولیه

تعاریف زیر baseline است؛ tax/commission/FX policy باید قبل از Production تایید شود.

| KPI | تعریف/فرمول اولیه | Grain و شرط | Drill-down |
|---|---|---|---|
| Gross Sales | جمع sale total سفارش‌های واجد وضعیت فروش، پیش از refund | order/item؛ void/test حذف | order items |
| Net Sales | Gross Sales منهای completed refunds و تخفیف طبق policy | order/item + refund allocation | order/refund |
| Collected Amount | جمع payment ورودی `VERIFIED/SETTLED` پس از reversal | payment | payment/allocation |
| Refunded Amount | جمع refund `COMPLETED` | refund | refund/payment/order |
| Receivables | debit-credit posted حساب‌های دریافتنی تا as-of | account/counterparty | journal lines/invoices |
| Provider Payables | credit-debit posted حساب‌های پرداختنی Provider | provider/account | purchase invoices/journals |
| Account Balance | signed sum posted journal lines به تفکیک account/currency | account/currency | journal lines |
| Gross Profit | recognized sale revenue − matched purchase cost − direct adjustments | order item؛ policy FX صریح | item sales/purchase |
| New Orders | تعداد order ایجادشده در بازه | order.created_at | orders |
| Awaiting Payment | orderهایی با مبلغ outstanding و state فعال | order | orders/invoices |
| Awaiting Issue | paid/eligible reservation بدون issue نهایی | reservation/order | reservations/payments |
| Paid Not Issued | verified allocated payment و issue غیر `ISSUED` بعد از threshold | order/reservation | failure timeline |
| Issued Documents | تعداد document معتبر `ISSUED`، void خارج | issued document | document/reservation |
| Cancelled Orders | تعداد order با transition cancellation در بازه | order history | orders/reasons |
| Issue Failure Rate | issue operationهای final failed ÷ issue requests | provider operation | provider/error |
| Conversion Rate | تبدیل مرحله بعد ÷ ورودی مرحله، cohort/date basis صریح | lead/opportunity funnel | entities |
| Sales per Agent/Site | Net Sales با owner/channel snapshot زمان فروش | order/item | orders |
| Open Tickets | ticketهای غیر final در as-of | ticket | tickets |
| SLA Breach Rate | ticketهای breached ÷ ticketهای SLA-eligible | ticket | tickets/categories |
| Overdue Tasks | task باز با due_at گذشته از now | task | tasks/assignees |
| Campaign ROAS | attributed net revenue ÷ campaign spend | attribution model version | orders/touches |
| Due Checks | check فعال با due date در window | check | checks/counterparties |

## قواعد مشترک

- همه KPIهای مالی currency را جدا یا با FX basis تاییدشده convert می‌کنند؛ جمع ارزهای مختلف
  بدون تبدیل ممنوع است.
- date basis (`created`, `issued`, `paid`, `effective`) در عنوان/metadata گزارش روشن است.
- timezone پیش‌فرض شرکت قابل تنظیم و storage UTC است.
- تست/void/fraud/sandbox data با flag مشخص و به‌صورت پیش‌فرض خارج می‌شود.
- owner کسب‌وکار، SLA freshness و target هر KPI پیش از Dashboard production تعیین می‌شود.
