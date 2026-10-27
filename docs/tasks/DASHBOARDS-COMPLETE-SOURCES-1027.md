# DASHBOARDS-COMPLETE-SOURCES-1027

PC-C; base develop `5fbda3e3f8ec497e73a30a2f1be4acccbf4b6550`.
Owner requests full production data-source inspection, correct Dashboard KPI/chart
outputs, and a develop PR/merge after all final-head CI passes. This is a continuation,
not a certification that the full Dashboard is already operational.

## Verified production inventory

Read-only PostgreSQL transaction inspected the complete public-table inventory,
column types/nullability, constraints, foreign keys, indexes and exact table counts. Private receipts remain outside Git
in the access-restricted backup folder. No row identities, credentials, personal data,
or monetary business values are included here. Do not use pg_stat estimates to decide
that a source is empty: several populated tables had stale zero estimates.

- Native Sales contracts, price components, passenger/service allocations and
  Reservations intake/workflow records are populated.
- Customer identities and HR employee/record data are populated independently.
- `reporting_travel_facts` is empty. No approved dashboard/report view exists there.
- Sales payment entries exist, but the earlier verified confirmed-receipt/refund
  report is empty. Scheduled amounts must not be reported as collected cash.
- Accounting books, accounts, journals and lines are empty. Four settlement-account
  definitions are not four balances and cannot establish an opening balance.
- Supplier-payment and confirmed ticket-cost revisions are empty. A purchase entry
  alone does not establish complete matched/approved costs for every sold service.
- The latest recorded deployment was `5314830983e47a81c1ea1927d63b8b5c716b1cf8`,
  preceding the dashboard PR1182 merge. A Git merge alone never updates that runtime.

## Bounded changes underway

- Correct gross sales to precede source discounts; net sales still deducts source
  discounts and completed allocated refunds exactly once.
- Publish discount amount and distinct finalized-contract counts from the Sales
  public dashboard source, preserving own/branch/all permissions and currency scope.
- New Sales-owned leaf aggregate for Finance-confirmed receipt events and executed
  refunds. Uses confirmation/refund event dates, not contract creation dates. Requires
  `sales.payments.read` plus scoped Sales access; does not expose row identities.
- Reporting composes those public results independently. Unsupported filters fail
  closed; inaccessible or truncated data cannot become zero. Empty authorized sources
  may correctly return zero. No schema, migration, permission or dependency changes.
- Add new-order count using creation date, independently of confirmed sales.
- Fix actual registry visual IDs: executive-trend, sales-collection-trend,
  finalized-sales-trend, discount-trend and executive-lead-acquisition. Metric
  series are nested inside their currency series; the Web renderer selects both
  together. Missing profit is disclosed rather than converted to a zero line.
- Expose unavailable visual coverage and a visible missing-data explanation.
  Finalized-sales trend deliberately shows money only; volume remains a separate
  KPI, not a misleading mixed-unit series on one axis.

## Remaining acceptance work

1. Complete the widget-by-widget source matrix: registry includes Sales, Finance,
   Accounting, Procurement, Reservations, Inventory, Customer Affairs, HR and Marketing.
   Never claim all widgets are connected based only on the executive sales chart.
2. Reuse/coordinate the independently published Reports public projections; its
   `REPORTING-LIVE-SOURCES-1027` branch still owns travel-report contract/preview/export
   sections. Do not overwrite or silently import its unmerged changes.
3. Wire remaining real dimension/trend charts with numerator/denominator, per-currency
   series and exact period semantics. Composite-service sales lack an automatic
   per-service allocation policy; never duplicate an entire contract for each service.
4. Preserve approved profit policy: recognized sale minus matched approved cost.
   The owner was asked whether incomplete cost should remain unavailable or a separately
   labelled estimate is required. Missing costs cannot be assumed zero.
5. Source-aware filters, unavailable reasons, date/branch/own-scope regressions and
   authenticated browser reconciliation remain necessary.
6. Full lint/typecheck/build, target PostgreSQL reconciliation, full final-head CI,
   PR and authorized merge. Deployment is a separate root-approved pinned plan with
   backup/rollback. This work has not changed the running ERP or localhost.

## Candidate verification (not a production rollout)

- 72 focused API tests; 34 Web dashboard tests passed, one existing skipped test.
- API and Web typechecks and scoped lint passed. API emitted build passed.
- Web production webpack build passed (66 pages); the normal source tree and
  current localhost runtime are untouched.
- Internal native-module smoke against production in an explicit read-only
  transaction returns nine KPI IDs and four requested actual-registry chart IDs.
  Gross profit remains unavailable. This is not an authenticated HTTP/UI test.
- Independent aggregate SQL reconciles gross sales and discounts for all three
  returned source-currency groups, plus the new-order count. Monetary values,
  passenger data and credentials never leave the private diagnostic process.
- No PR/merge/deploy yet: the owner's gate is completion followed by all final-head
  CI. The source/task branch can be published for handoff without claiming that gate.

Pending owner choices: approved-cost-only profit versus separately labelled estimate;
and keeping unallocated multi-service contracts in a distinct composite-services
bucket versus requiring explicit per-service sale-price allocation first.
