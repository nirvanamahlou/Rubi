# Dashboard first paid customer — 2026-11-05

PC-C; base develop957ff4248; branch codex/pc-c-dashboard-first-contract-1105.

## Confirmed definition

The owner explicitly retained the paid-purchase condition and chose the month of
the first Finance-confirmed payment when the contract was confirmed earlier.
A successful purchase exists only after both contract and payment confirmation;
its timestamp is the later of those two events. Drafts, unpaid contracts and
pending/rejected payments do not establish successful purchase history. Later
cancellation or refund does not make an established buyer new again.

Count a canonical contracting buyer once in the selected `[from,to)` period when
there is an authorized successful purchase in that period and no earlier
successful purchase anywhere in the company. Earlier history must not disappear
when a branch is selected or the current evaluator has own/branch-only access.
Returning customers have an authorized purchase in the period and earlier paid
history anywhere in the company. Period boundaries continue to use Tehran and
the existing Persian calendar conversion.

## Implementation boundary

Sales owns both candidate selection and the historical existence query. Candidate
contracts retain all existing permission and branch restrictions. The secondary
query groups only those candidates' customer IDs; no earlier contract, owner,
branch, payment amount or customer details are returned to Reporting. Reporting
and charts continue to consume the existing aggregate response, with one event
at the first authorized successful purchase in the window. Branch/owner views
are distinct scoped cohorts and must not be added to derive company totals.

Identity is `SalesContract.customerId`, not payer, passengers, names or phone
numbers. This change does not merge duplicate customer records. The existing
lead-conversion public method and its permission-scoped paid evidence are
unchanged. No stored financial or customer facts are rewritten; historical
periods recalculate on read after deployment. No migration is needed.

## Validation and release

Focused tests cover hidden earlier purchases, delayed payment approval, unpaid
history, cancellation, duplicate contracts/receipts, exact period endpoints,
permissions and aggregate-only disclosure. A separate migrated PostgreSQL suite
is enabled by `NORA_RUN_REPORTING_POSTGRES_TESTS=1` in the database CI job.
Local runs require a disposable loopback `nora_ci` database.

This branch does not deploy or modify production business records.
