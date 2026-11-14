# Reports and Dashboard source activation — 2026-11-14

COMPUTER_ID=PC-C (helper computer). Owner assigns implementation of both panels
to PC-C. Base `origin/develop@ea83ec5b3`; branch
`codex/pc-c-report-dashboard-activation-1114`. Prior Nora branch is preserved.

## Delivered source changes

Three existing chart slots now consume existing owner-public Dashboard contracts:

| Chart | Page | Measure and limits |
| --- | --- | --- |
| customer-destination-distribution | customer-behavior-analysis | One finalized contract per destination, independent of the number of currencies. Passenger count is explicitly withheld. Same-name destinations remain distinct without exposing grouping keys. |
| workforce-performance | workforce-hr | Actual accepted daily overtime in hours. No invented appraisal/performance score or conversion from workdays. |
| support-time-trend | support-service-quality | Daily arithmetic mean of actual first-response durations in minutes, grouped by response date in Tehran. Unanswered requests and unobserved days never become zero-minute responses. Resolution duration remains withheld. |

Native producer permission, branch, date-basis, filter and row-limit checks remain
unchanged. Failed/missing sources do not become zero. The existing Web chart
consumer renders the returned unit, series and limitation notices. No dashboard
layout, operational UI, Call Center design, public DTO or KPI definition changed.
No new KPI is claimed: this unit activates three previously unwired charts.

The reusable readiness probe now enumerates all six native Sales reports, uses the
actual Documents-list/Support source permissions for its explicit infrastructure
actor, and reconciles purchases against the public eligible-contract cohort. Its
independent Decimal purchase reference consumes exact amountsByCurrency rather
than trying to parse the consolidated table's multi-currency presentation label.
This fixes the probe; it does not change operational permissions or purchase data.

## Live read-only evidence

Inspected the existing `rubi-erp` SSH target on 2026-11-14. Running API/Web/Worker
images identify source `69c0251f480b08dcc6c7b73faad56026ae22e5b3`, the release
commit in the fetched develop merge. The running services were not replaced.

The catalogue/count scan covered **331 public tables**, **4145 columns**, **753
foreign keys**, with **165 populated tables**. Counts are per-table observations
during the scan, not one guaranteed cross-table snapshot and not proof of valid
business measures. Server receipt:
`/home/rubi-deploy/reports-source-audit-20261114T131542Z.json`.
The scan reads names/types/constraint definitions and exact row counts only;
business rows and credentials are not exported. This is source-readiness profiling,
not a claim that every business record has undergone exhaustive correctness review.

The new candidate probe runs inside a READ ONLY / REPEATABLE READ transaction in
an isolated Node process against the current server database, without bootstrapping
the application. Its aggregate-only receipt at `2026-11-14T13:23:53Z` confirms:

- Destination chart: **414** finalized contract observations, **14** destination
  groups. Monetary contract observations are not used as a count denominator.
- Overtime chart: **149** valid employee/day observations, **13** real date points.
  Values retain source hours; no evaluation score is added.
- Support chart: **0** qualifying support responses; the chart is connected and
  empty. Existing Call Center/internal requests are not relabelled as support.
- All three owner readers reject absent permissions and unsupported provider
  filters before any database access. The application user's own permissions still
  determine which results can be displayed; infrastructure-probe rights are never
  assigned to an account or used to impersonate one.

The refreshed report probe at `2026-11-14T13:28:49Z` verified all **21 executable
source routes**, generated each XLSX in memory and checked source-column parity:

| Report source code | Output groups/rows |
| --- | ---: |
| sales_by_organization | 3 |
| route_passengers | 14 |
| sales_contract_pipeline | 2 |
| sales_by_service_route | 25 |
| agency_performance | 94 |
| future_travel_commitments | 1 |
| payments_refunds | 1 |
| customer_service_sla | 5 |
| workbench_due_actions | 0 |
| hr_record_expiry | 4 |
| cancellations_refunds | 4 |
| purchase_by_supplier | 30 |
| reservation_delivery_readiness | 411 |
| reservation_cycle_time | 10 |
| tickets_manifest | 10 |
| ticket_capacity | 196 |
| hotel_rate_comparison | 13 |
| customer_portfolio_growth | 4 |
| hr_performance | 254 |
| document_compliance | 1 |
| export_audit | 0 |

Purchase totals match the independently computed current-purchase reference in
each currency. Zero personal-calendar/own-audit results belong to the synthetic
infrastructure actor, not a claim that every real user's calendar/audit is empty.
API source coverage does not add reports to navigation or broaden account access.

Aggregate receipts are retained outside Git under
`tmp/report-activation-1114/`. Reproduction sources:
`scripts/reporting/dashboard-activation-1114.ts`,
`scripts/reporting/readiness-audit.ts`, and
`scripts/reporting/inspect-production.py`. Bundled candidate code is compiled only
in the short-lived Node process; no container application files are overwritten.

## Sources still insufficient

- Accounting journals/lines remain empty. Registered Finance events and bank
  directory entries cannot establish posted balances, expenses or profit.
- Leads/handoffs, marketing costs/conversion events, B2B agreements/credit policies
  and HR leave entries remain empty. Existing independent support/attendance/Sales
  outputs do not establish conversion, credit exposure, approved leave or ROAS.
- Service purchase records exist, but are not approved matched direct expenses.
  No gross/net profit, cash balance, provider payable or cross-currency sum is
  fabricated. Partial chart series remain explicit in notices.

## Verification and publication

- Reporting API: **191 passed**, one existing opt-in skip.
- Dashboard Web model/render tests: **23 passed**, one existing skip; the three
  new render cases exercise the actual destination, HR and Support pages.
- Scoped API/Web ESLint, API/Web TypeScript and API/Web production builds pass.
  The first standalone Web typecheck saw generated types from the previous Nora
  branch; the production build regenerated them and the subsequent typecheck passes.
- Both probe scripts pass a separate TypeScript check with workspace module paths.
- No migration, schema, dependency, business-data write, listener replacement,
  deployment, merge or authenticated-browser acceptance is claimed.

Publication scope is the Reporting API aggregation change. Existing Web consumers
already support these chart responses. Before activation: review the PR, require
all current-head hosted gates, then obtain explicit merge/deploy approval under
AGENTS.md. Preserve current release source overlays/environment/mounts, use the
existing server deployment lock and backup/rollback process, and verify the three
pages with the intended real account after activation. No database migration or
backfill is required. Rollback restores the prior API release without data changes.
