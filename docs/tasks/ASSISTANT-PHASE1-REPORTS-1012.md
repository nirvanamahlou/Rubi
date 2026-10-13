# Assistant Phase1 — first Sales-owned real read source

PC-C; base developeab0ad6c; owner explicitly advances to Phase1 on2026-10-12.
Business definitions are approved; final source/business acceptance, policy
refinements and deployment remain separate. V1 still sends no data to a model.

## Accepted requirements

Sales means valid confirmed contracts, counted by creation date. Draft/cancelled
contracts are excluded. Discounts do not eliminate sales; approved refunds reduce
sales amounts. Counts are distinct contracts for each route, with passengers
separate; multi-route membership is not additive to unique contract totals.
Seven completed Tehran civil days compare with the previous seven; Jalali display.
Currencies are never summed or converted. CEO default is all collection data but
existing server authorization is never bypassed. Contact conversion uses unique
contacted leads and confirmed-contract conversion as of observation time. Finance
receivables and operational contract balances remain differently named. Overdue
and next-seven-day receivables are separate; Finance owns the accounting source.
Read on request, show observation/source-update times and explain missing sources.

## Source discovery and contract

The inspected Reporting implementation reads reporting_travel_facts, created by
20260912120000_reporting_demo_workspace. Its READY metadata is not proof that
sales.reporting.organization.v2 is connected to real Sales contracts. The
assistant must not present that demo fact table as actual company sales.

New ERP GET /sales/assistant/weekly belongs to SalesModule and reads only its own
SalesContract aggregate through DatabaseService. Native sales.contracts.read.all
is required; administrator label, assistant screen grant and client context are
not substitutes. No query parameters, selected user/company/branch or dates are
accepted. AuthGuard validates identity; no new permission/role grant is introduced.

Select only contract IDs, timestamps, current lifecycle status, primary route IDs
and passenger counts. No passenger/customer names, phone, bank data, notes or
financial rows. Non-null past confirmedAt and eligible current status are required.
Two windows use CREATED_AT. This is current eligibility as of the request, not
historical lifecycle backtesting. More than5000 matching rows returns a cap error,
never a truncated financial/contract total. Route city names come only from the
existing public MasterData detail contract, with100 unique lookups and8 workers;
missing labels remain null and explicitly incomplete. No MasterData table query.

Version1 sales.assistant.weekly.v1 returns ALL_AUTHORIZED_SALES scope, Tehran
windows, unique contract/passenger counts, primary-route aggregates, observation
and latest selected Sales update times, bounded coverage and explicit missing
net/refund, contacted-lead cohort and multiple-route projections. These missing
metrics are not zero. Net money is intentionally not reconstructed from receipts,
contract totals or the demo table. No monetary field is published until its
approved refund/currency projection is ready.

Independent GET /v1/assistant/actions/sales-analysis uses only the fixed ERP
route, selected access cookie and bounded reads. It requires the native all-read
grant before/after reading, including final release, verifies/reconciles the
source and strips all extra fields. Response is PARTIAL with validated counts or
BLOCKED with a safe reason (API missing, source not ready, cap, oversized/invalid
response, timeout/unavailable). All-unavailable never becomes zero. Existing SELF
snapshot/daily summary and Finance receivables gate remain compatible.

## Acceptance and remaining source work

- Check Tehran midnight/window boundaries, current confirmation/lifecycle and
  duplicate contracts/passenger independence; reject cap/query/permission abuse.
- Native service verifies source counts, no demo routes, extra-field stripping,
  grant revocation and no cached/foreign-user data. Web validates the envelope.
- API/Web lint/typecheck/build and all final-head CI before authorized develop merge.
- No schema/migration/dependency/operational-data changes. ERP API runtime must
  publish the new controller before live counts are available; missing route is
  explicitly diagnosed. Do not replace the shared ERP runtime or apply unrelated
  migrations merely to obtain this endpoint. Deployment is a separate handoff.
- Remaining Phase1: Finance-approved refund/net-sales source, true multi-route
  Sales projection, contacted-lead conversion from CRM/Calls owner, receivables
  producer and real business-reference reconciliation. Whole Phase1 is not complete.
