# WORKBENCH-038 — My Performance

PC-B · `codex/pc-b-workbench-my-performance` · 2026-09-13

## Behavior and public boundaries

`GET /api/v1/workbench/performance?days=30|90|365` is authenticated,
`private, no-store` and read-only. It never accepts an employee/user ID.
The `performance` Workbench tab uses native Rubi controls and theme tokens.

- HR exports `HrSelfPerformanceService`. Employee selection requires the unique
  authenticated user link, current branches and non-deleted records, even for admins.
  An unlinked account returns an explicit unlinked state.
- HR returns ten own leave requests, ten own shift/roster records, current
  Gregorian-year ledger balances through `HrService.leaveBalances`, and the latest
  approved own payroll payslip. Record statuses and dates remain visible.
- Self-payslip policy: `hr.self` or `hr.sensitive`, plus existing HR access and exact
  employee ownership, permits narrow approved payslip fields and currency. It does
  not grant access to draft payroll, colleagues, bank details, workflow payloads or
  general sensitive HR endpoints. A payslip is explicitly not proof of bank transfer.
  No seed or existing permission definition is modified.
- Sales uses `SalesService.list` with original actor permissions plus explicit own
  owner and allowed-branch filters. At most 1,000 contracts across branches bound
  work; truncation is explicit in the response and UI. Amounts and unique customers
  use confirmed/sent/in-progress/completed contracts, excluding draft/pending/cancelled.
  Customers are customers of those own contracts, not all CRM customers. Money is
  summed with Decimal separately per currency, never Number.
- Activity consumes IAM's last 100 successful self events, HR's last 100 self-authored
  in-branch operations, status history of at most 20 own contracts through
  `SalesService.history`, and own in-branch customer activity for those contracts
  through `CustomerService.activity` only with `customers.read`. Colleagues' actions
  never count. Entity IDs and audit payloads are omitted. Cards follow permissions.
  Counts concern retrieved events, not exhaustive productivity/all-time totals.
  Finance/Reservations count only available common audit events; no fabricated
  financial payment count or complete reservation workload metric is provided.

HR, Sales and Activity report independent access/error states. Producer errors do
not become zero figures or expose server error text. The range changes job stats;
latest HR records and annual balances are labelled separately. No cross-module
table queries, schema, migration or dependency changes.

## Validation and delivery

Tests cover admin/self and branch isolation, unlinked employees, approved-only
payslips, payload minimization, unauthorized module calls, Decimal/currency accuracy,
contract states, partial limits, own customer/contract history, invalid ranges and
authenticated no-cache client behavior.

18 targeted API tests and 49 Workbench Web tests pass. Scoped ESLint, API/Web
TypeScript checks and production builds pass; Web produces 46 routes. The final
HR null-date ordering adjustment also passed its 14-test API rerun and typecheck.

Activation needs both the new API and Web build. Shared 3100/4190 processes and
operational data are unchanged. WORKBENCH-037's greeting cleanup and restored unit
directory remain included.
