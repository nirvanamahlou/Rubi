# Account structure and report evidence, 2026-10-11

Owner: PC-A. Branch: `codex/pc-a-coa-reports-year-end-1011`. Base: `68987832`.

## Implemented in this work item

- Removed the hardcoded account-group list. The tree now displays the active book's persisted roots directly, supports code/title ordering, and selects the root to create a group.
- Replaced the combined search input with the observed code, title and account-level filters and an explicit search action.
- Added `AccountingChartReport`, using the source's group/general/subsidiary/structural format choices, checkbox defaults and tax-type dependency. It reads persisted book data and authorized mapping targets; no source account data or invented operational records are embedded in code.
- The report preserves hierarchy, resolves detail-type and counterpart references, expands subsidiary features into the three observed columns, and scopes printing to the result.

## Integration boundary

`PC-B Finances` owns the active accounting workspace, service, contracts, parity definitions and migration changes. By explicit coordination, that chat will connect the new component to `general-ledger/reports/chart-structure` after reviewing the commit. This branch does not change those locked files or the shared Rubi runtime/database. The component accepts `{ book: AccountingSnapshotV1 }`.

## Source evidence

Read-only browser inspection of the authenticated source on 2026-10-11 expanded all account branches: 222 distinct account codes in 13 groups. The one-page assigned-detail-type report exposed nine subsidiary assignments. Raw names, screenshots and DOM captures remain outside Git under the current chat's `work/source`; the user-facing JSON export and hashed evidence index are in `outputs`.

The reports menu has 19 entries. Captured forms include chart, balance and secondary filters, matrix, legal ledgers, ledgers, debit/credit notice, nature conflict for a period and during a period, comparative, dormant, aging, analysis, voucher items, comprehensive, electronic books and account browser. A loading-state document-browser JSON and two stale statutory captures are explicitly rejected in the index; they are not evidence of complete form parity.

Generated chart output verified grouped account headings, assigned-detail sections and the subsidiary report's feature columns. Counterpart report generation fails in source with the `Sys_CompanyName` parameter error. Output pagination and print-engine parity across all formats remain unverified.

## Year-end observations and blockers

- Closing-template form has code/title (required), active, second-language title, default description and second-language description, notes, a counterpart grid (subsidiary, detail levels 4/5/6, percentage) and a closable grid (include/exclude, subsidiary, detail levels 4/5/6). The generic existing template form is not exact parity.
- Closing wizard stages: introduction, closing-template selection, exchange rates, voucher preview, completion. Advancing in fiscal 2026 returns “در دوره مالی جاری سند قطعی وجود ندارد”.
- Nature-adjustment stages: introduction, voucher specifications, accounts without counterpart, voucher preview, completion. Advancing returns “در دوره مالی جاری سند غیر قطعی وجود دارد”.
- Final-closing and opening forms expose voucher date (required) and auxiliary number. Opening also has a checked reverse-nature-adjustment checkbox. No vouchers were issued.
- The user allowed any existing period for read-only inspection and explicitly prohibited entering data into Rahkaran. The main-ledger period selector contains only 2026; no context or data was changed.
- Current template-line roles are constrained to SOURCE/TARGET/OFFSET/BASIS with VARCHAR(8). The observed closing roles require a separately coordinated additive migration, domain rules and financial tests. Do not map them to unrelated roles or activate guessed year-end execution.

## Remaining work

Integrate and verify the report in the authenticated Rubi UI, reconcile the nine source assignments through authorized import, implement the remaining reports' complete filter semantics and outputs, and finish year-end parity after contract ownership is released and missing source stages become observable. This work item does not claim complete parity of all reports or year-end operations.
