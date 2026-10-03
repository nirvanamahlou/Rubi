# KPI Dictionary اولیه

تعاریف زیر baseline است؛ tax/commission/FX policy باید قبل از Production تایید شود.

| KPI                       | تعریف/فرمول اولیه                                                    | Grain و شرط                    | Drill-down                 |
| ------------------------- | -------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| Gross Sales               | جمع sale total قراردادهای واجد وضعیت فروش، پیش از refund             | contract/service؛ void/test حذف | contract service items     |
| Net Sales                 | Gross Sales منهای completed refunds و تخفیف طبق policy               | contract/service + refund allocation | contract/refund       |
| Collected Amount          | جمع payment ورودی `VERIFIED/SETTLED` پس از reversal                  | payment                        | payment/allocation         |
| Refunded Amount           | جمع refund `COMPLETED`                                               | refund                         | refund/payment/contract    |
| Receivables               | debit-credit posted حساب‌های دریافتنی تا as-of                       | account/counterparty           | journal lines/invoices     |
| Provider Payables         | credit-debit posted حساب‌های پرداختنی Provider                       | provider/account               | purchase invoices/journals |
| Account Balance           | signed sum posted journal lines به تفکیک account/currency            | account/currency               | journal lines              |
| Gross Profit              | recognized sale revenue − approved net purchase − direct adjustments | contract service؛ policy FX صریح | sales/purchase          |
| Supplier Discount         | جمع تخفیف approved کارگزار روی نسخه قیمت خرید                        | purchase request/version       | purchase price versions    |
| New Contracts             | تعداد قرارداد فعال‌شده در بازه                                      | contract.activated_at          | sales contracts            |
| Awaiting Payment          | قراردادهای فعال با مبلغ outstanding                                 | sales contract                 | contracts/invoices         |
| Awaiting Issue            | service item واجد اجرا بدون issue نهایی                              | reservation operation         | reservations               |
| Paid Not Issued           | verified allocated payment و issue غیر `ISSUED` بعد از threshold     | contract/reservation           | failure timeline           |
| Issued Documents          | تعداد document معتبر `ISSUED`، void خارج                             | issued document                | document/reservation       |
| Cancelled Contracts       | تعداد قرارداد با transition cancellation در بازه                    | contract history               | contracts/reasons          |
| Manifest On-time Rate     | Manifestهای ارسال‌شده پیش از deadline ÷ Manifestهای موعددار          | manifest version               | manifests                  |
| Issue Failure Rate        | issue operationهای final failed ÷ issue requests                     | provider operation             | provider/error             |
| Conversion Rate           | تبدیل مرحله بعد ÷ ورودی مرحله، cohort/date basis صریح                | lead/opportunity funnel        | entities                   |
| Sales per Agent/Site      | Net Sales با owner/channel snapshot زمان فروش                        | contract/service               | sales contracts            |
| Open Tickets              | ticketهای غیر final در as-of                                         | ticket                         | tickets                    |
| SLA Breach Rate           | ticketهای breached ÷ ticketهای SLA-eligible                          | ticket                         | tickets/categories         |
| Overdue Tasks             | task باز با due_at گذشته از now                                      | task                           | tasks/assignees            |
| Campaign ROAS             | attributed net revenue ÷ campaign spend                              | attribution model version      | contracts/touches          |
| Due Checks                | check فعال با due date در window                                     | check                          | checks/counterparties      |
| Active Headcount          | تعداد employee با assignment و employment status فعال در as-of       | employee/assignment؛ PII حذف   | branch/unit/position       |
| Attendance/Leave Duration | مدت تاییدشده حضور، غیبت، مرخصی و مأموریت در بازه                     | employee/work date/type        | HR time records            |
| Approved Overtime         | مجموع مدت اضافه‌کاری تاییدشده در بازه                                | employee/work date             | overtime approvals         |
| Expiring HR Records       | قراردادها، مدارک و گواهینامه‌های فعال با expiry در window            | employee/document/contract     | HR reminders               |

## قواعد مشترک

- همه KPIهای مالی currency را جدا یا با FX basis تاییدشده convert می‌کنند؛ جمع ارزهای مختلف
  بدون تبدیل ممنوع است.
- date basis (`created`, `issued`, `paid`, `effective`) در عنوان/metadata گزارش روشن است.
- timezone پیش‌فرض شرکت قابل تنظیم و storage UTC است.
- تست/void/fraud/sandbox data با flag مشخص و به‌صورت پیش‌فرض خارج می‌شود.
- owner کسب‌وکار، SLA freshness و target هر KPI پیش از Dashboard production تعیین می‌شود.
- KPIهای HR به‌صورت پیش‌فرض aggregate/masked هستند و drill-down فردی به permission و
  audit جدا نیاز دارد.
