# FINANCE-SOURCE-LINKS-1115 — PC-D

The owner requests accurate business contract/document numbers and readable exact linked records in the Finance areas affected by fiscal context. This task builds on published fiscal-context commit `40572a999` on its own branch `codex/pc-d-finance-source-links-1115`; it does not authorize a PR, merge, hosted CI dispatch or deployment.

## Result and public contracts

- Optional `references` on inbox, transaction history and financial-event projections contain actual contract IDs/numbers and journal IDs/book/period/numbers/dates/status. Arrays retain multiple related records, including receipt-allocation source/target contracts and grouped reservation purchases. No lookup by typed number, title or amount is used.
- A Sales-owned read port resolves payment-to-contract FKs and reads the exact contract with the existing saved-contract presenter. A Reservations-owned reference port resolves intake/purchase FKs. Finance accesses their public projections, not their private tables. Batched reference reads are bounded to 100 source descriptors per query group.
- `GET /finance/source-contracts/:id/read` requires `finance.read` and rechecks branch, selected issuer and Finance archive visibility. The reader shows the current stored contract version, parties/contact snapshot, itinerary, passengers, services, prices, balances, terms, receipts and notes. It does not fetch extra customer identity records or reconstruct historical signed PDFs.
- `GET /finance/accounting/books/:bookId/journals/:journalId/read` requires `finance.read` plus `finance.journal.read` and the native branch/company book guard. It reads the exact journal, its own fiscal year/date/status/reference, final and auxiliary numbers, account/detail codes and levels, descriptions, debit/credit, currency/amount/rate and exact Decimal totals.
- Only these exact GET viewers are independent of the active-year requirement. They neither switch the user's fiscal selection nor relax normal list, report, export or mutation guards. Opening an old document does not insert it into the current-year journal list.
- Inbox rows/details, General Details, receipt/payment history, financial events and Accounting sources use these readers. History/receipt/inbox exports add explicit text columns for actual contract and journal numbers. An unnumbered draft is not displayed as journal zero. Auxiliary and contract string numbers retain leading zeros.

## Corrections and compatibility

Sales receipt history now distinguishes the payment ID, parent contract ID and actual business contract number. Accounting source history prefers the real event-to-journal FK; an exact legacy source key is used only when the corresponding primary source lacks an event journal. Contract commitment journals remain available for prior-year open receipts, alongside their actual receipt journal where present. Operational free-text references are not mislabeled or linked as contracts; refund receipt FKs can resolve their real contract.

The DTO additions are optional for existing consumers. Native business commands, amounts, dates, archive policy, role grants, company hierarchy and fiscal selection persistence are preserved. There is no new migration, schema/dependency/lockfile change, backfill, operational data update or permission grant.

## Validation

Local validation covers exact-ID reading, issuer/branch/archive predicates, permission denial, leading zeros, allocation relationships, reservation FKs, actual-event versus legacy-journal precedence, missing references, large batches, current-year isolation, export numbers and readonly renderers. A dedicated PostgreSQL fixture (`rubi-company-ledger-test-1110`, isolated port55437) validates reading an old-year journal with 18-decimal amounts while current-year lists stay scoped and unauthorized actors are rejected. No operational runtime/database is used.

Broader Finance regression runs also identified outdated link expectations and a root-layer boundary issue introduced during implementation; those were corrected and the affected suites rerun. Final check results are recorded in `WORK_ASSIGNMENTS.md` and `docs/PROJECT_STATUS.md`. Hosted CI, merge and publication remain outside this task's authorization.
