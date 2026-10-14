# Assistant deterministic views — 2026-10-14

## Inspection and source decisions

- Reporting catalog `receivables_payables`, `account_balances`, `due_checks`, and `cash_position` still declare PENDING_CONNECTION. Catalog definitions do not establish a connected operational producer.
- Dashboard monetary metrics read `reporting_travel_facts`; the current implementation describes travel demo rows and derives gross profit from sale minus purchase plus commission. This is not the approved accounting net-income source. Several conversion/employee counters use travel status proxies rather than registered CALL cohorts. Do not reuse these as assistant financial or lead facts.
- Accounting exposes authorized per-book trial-balance, turnover and analytical reports. They require a particular book and fiscal period; these are not yet an all-company cash/receivables/profit projection. A later integration must define the book scope and account classification, preserve per-currency accounting semantics, and reconcile the aggregate.
- Existing assistant Sales public reports and Customer Affairs registered-CALL cohort already provide bounded, versioned, authenticated evidence. Current contractual balance remains distinct from accounting receivables.
- No approved news feed or scenario sensitivity formula was discovered in the existing assistant contracts. These views remain explicit source/model gates, not fabricated results.

## Delivered scope

Overview and advisor load daily-summary; sales loads sales-analysis; finance loads receivables-follow-up automatically. Reuse the same validated action evidence renderer as the composer, including exact Decimal strings, independent currencies, current/previous periods, route counts, CALL conversion, confirmed/pending receipts, current contractual balances, source timestamps, limitations and deterministic personal priorities.

Every view/reload/permission-set change gives results a new identity, aborts old transport and hides old evidence until the matching result arrives. Failed requests hide prior results and retain distinct 401/403/429/unavailable states. Empty contractual totals show an explicit no-data state. Manual chat filters and provider activation are unchanged.

No new ERP API, database migration, model request, credentials, dependency or permission grant. Financial accounting integration, forecasts, news and scenario calculation are not claimed complete. Business reconciliation still requires reference data and domain owner sign-off.

## Acceptance

Run assistant Web tests, scoped lint, Web typecheck/build and all PR CI before develop merge. Verify merged-tree CI and localhost deployment separately. Synthetic fixtures only; no operational business writes.

Validation update:37 assistant Web tests and full Web typecheck pass. Production webpack compilation passes; final build stages and CI remain pending. No operational data used.
