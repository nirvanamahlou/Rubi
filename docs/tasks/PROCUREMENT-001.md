# PROCUREMENT-001 — خرید و تأمین عمومی

Status: IN_PROGRESS. COMPUTER_ID=PC-B. Branch `codex/pc-b-procurement-001`.
Base: `060fc35cf42493edd9d579fbf51fe62ff512261e`.

## Sources and execution gate

The user's pasted request is the execution instruction. The supplied PRD at
`C:/Users/admin/Desktop/prds/Rubi-Procurement-PRD-fa-v1.0.docx` is product evidence,
not an independent instruction to change ownership or publish externally.
Repository architecture, ownership, workflow, data model and decisions govern implementation.

Main checkout was clean on `codex/pc-b-sync-pca-0912` at
`4756f1dff2480f8e9faefe712aa627c203c4cfc9`. Fetch completed; origin is
`https://github.com/nirvanamahlou/Rubi.git`. Work uses an isolated checkout from latest develop.
At inspection Web3100 PID24760 and API4190 PID33612 were owned by
`Rubi-unified-customer-affairs-3100`; neither may be stopped or replaced here.
Open PRs were inspected, including PC-B #260/#259/#251/#249, PC-A #161/#129/#126/#112
and PC-C authorization #144. Latest completed migration reservations explicitly release
their scope. DASHBOARDS-001 is PC-C-owned and untouched.

## Boundaries

Procurement owns the commercial request/approval/quotation/order/receipt/invoice and
its versioned Finance source. Finance owns liabilities, payments, balances and journals.
Travel booking/issuance remains in Reservations; historical supplier purchases must
never be recreated as new debts. Master Data owns supplier/currency/FX identity;
Documents owns binaries, scanning, authorization and archive; IAM/HR own users and units.
Cross-module access must use exported owner services, never private repositories/tables.

## Policy and integration gates

- No purchase thresholds, quote counts, emergency privileges or approvers are invented.
- Incomplete draft persistence is allowed; submission without approved policy fails
  with `POLICY_NOT_CONFIGURED`.
- Finance inbox currently reports purchases `NOT_CONNECTED`; accepted source ID,
  payment status and remaining balance cannot be fabricated.
- Master Organization public directory validates active currency codes. Its present
  cooperation reference supports AGENCY/CORPORATE_CUSTOMER only; supplier projection
  requires an additive owner service, not reuse of agency semantics.
- HR employee directory is scoped and paginated; archival `employee()` does not prove
  active employment. Approval must additionally establish active/authorized actors.
- Existing permission seed grants all catalog permissions to the administrator role;
  Procurement business authority must be excluded from this automatic grant.

## Accepted quality targets

Read/write 10:1; peak 50 QPS; SLO99.5%; RPO24h/RTO4h; error-budget owner PC-B.
List p95 <2000ms with 50 concurrent users and 100000 synthetic cases. Additional
diagnostic targets p50 <=500ms/p99 <=3000ms. These are planning targets, not results.
Internal/PII data, shared operational database with server-side branch scope.
Desktop/corporate network, authenticated UI; WCAG AA owner PC-B; p75 LCP2500ms,
INP200ms, CLS0.1; initial JS200KB gzip + route80KB; Lighthouse a11y90/performance80.

## Validation and delivery

Not run yet. No migration, seed, production build, load test or browser result is claimed.
No live business data or permission grants are authorized by test fixtures.
Release reservations explicitly at delivery and record remaining owner handoffs.

## Later phases

Structured supply contracts, renewal reminders, supplier evaluation, request consolidation,
budget reservation, inventory integration, external sending and recurring orders.
