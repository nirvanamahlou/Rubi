# Dashboard calculation feature audit — 2026-11-07

PC-C; follow-up on draft PR1436. Production inspection was read-only.

## Evidence

- ERP public schema metadata: 318 tables/views with 4,020 columns. PostgreSQL
  constraint catalogue: 721 foreign keys. No business records or credentials exported.
- The deployed ReportingNativeDashboard source matches the inspected five-reader
  composition: Sales contracts, Customers registrations, Leads, Sales receipts/refunds,
  and Sales paid-customer history. ReportingService selects this path before legacy facts.
  All five deployed reader files match the inspected repository reader files exactly
  after newline normalization.
- `sales_contracts` -> `sales_contract_price_components` supplies prices, discounts
  and currencies. `sales_contract_services.kind` supplies categories, not service revenue.
- `sales_contract_payment_entries` links to contracts and Finance settlement accounts;
  `sales_payment_refunds.paymentId` links to payment entries. Executed refunds also
  reference Finance revisions. Net sales deducts linked contract refunds; collection
  uses Finance-confirmed payment events, not the same contract-date sales cohort.
- Paid-customer history uses canonical contract customer IDs and Finance-confirmed
  payment dates. Lead conversion checks customer links and accepted Sales handoffs.
- Accounting tables exist, but the deployed native readers do not publish posted
  account balances, net profit or operating expense metrics. Existence is not activation.

## Corrections

Replace generic planned fact aliases in active widget explanations with the actual
input features. Do not label contract service kinds as recognized service revenue.
Do not label refunds consumed by net sales as collected/settled money. Sales counts,
prices, receipts, refunds, paid buyer history and lead handoffs have separate descriptions.
Service classifications appear only on service-breakdown charts. Time-series feature
lists cover the supported plotted metrics, including partial charts with no cost data.

For every other KPI/chart, preserve its required domain source specification and
explicitly state that active connection to the current native calculation is unconfirmed.
This prevents presenting hypothetical views or existing-but-unwired accounting tables
as live inputs. No calculation, API, access, schema or production data changes.

## Validation

58 Dashboard/i18n tests passed; one pre-existing skipped test. Four lineage regression
cases cover net sales versus collections, service breakdowns, unconnected accounting
and employee metrics, and lead/customer purchase-history dependencies. Scoped lint
passed. Production Web build, including TypeScript validation, passed on the final
source. Formatting and diff checks passed. No production publication.
