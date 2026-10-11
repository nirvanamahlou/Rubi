# Tax accounting parity — 2026-10-11

Status: candidate implementation, not deployed or complete.
Owner: PC-A, branch `codex/pc-a-tax-accounting-parity-1011`, base `9a41c1cc`.

## Evidence and scope

Read-only crawl of Rahkaran's Tax Accounting branch, main ledger, fiscal period2026.
No record, input value, note, attachment, tax declaration or report-engine update was submitted.
Private screenshots/DOM captures are outside Git under the task's `work/tax-source`.
The committed catalogue contains control labels, required/readonly flags, observed
options, table headers and source page references only. No source record was imported.

Observed: threshold form/list/notes/note dialog; tax-period form/list and grouping
options; aggregation form/list; taxpayer identity form/list and membership/nationality
options; geography/currency mapping grids; general and pollution declarations and
their lists; declaration-detail report and its multi-select options; tax-party list;
aggregate-history list. General declaration has37 fields and four financial tables.
Pollution declaration has16 fields and one financial table.

Source limitations:

- Period, identity, declaration, party and history lists contain no records.
- Quarterly report fails with «هیچ دوره ی مالیاتی در این دوره ثبت نشده است.»
- No report-engine update was executed; its update flow is unverified.
- No source values were changed to reveal dependent states. Parent/child enabling is
  based on the visible nesting and disabled controls; reset semantics are local validation.
- Threshold amount is a percentage calculation implemented with exact decimal arithmetic;
  source rounding and maximum scales were not experimentally verified.

## Implemented candidate

- Independent typed catalogue and UI for10 forms/lists,111 labeled controls.
- Three writable reference types: thresholds, aggregation patterns and tax periods.
  Storage uses existing `AccountingConfiguration`, reserved `vat-*` kinds, through a
  dedicated controller/service. These are configuration records, not declarations.
- API: GET/POST `finance/accounting/books/:bookId/tax/:kind`.
- Branch/book scope, permission checks, strict field/option validation, exact decimals,
  server-calculated threshold, date checks, same-book aggregation lookup, optimistic
  versions, actor-bound idempotency, serializable transaction and command audit.
- Scoped notes editor implements the observed title/date/text dialog; note audit validation is reused. Attachment linking is not connected for these kinds.
- Declaration totals and identity projections remain readonly. Financial operations,
  identity/mapping writes and disconnected reports explicitly explain their dependency;
  no successful submission or calculated financial result is fabricated.

## Integration and remaining work

PC-B explicitly authorized the new contract file and limited barrel export, dedicated
tax service/controller and limited FinanceModule registration. Central accounting
service/workspace/definitions, accounting.ts, schema and migrations remain locked.
The workspace integration patch is provided outside Git for its owner to apply.

This is not final port3100 delivery. Required before claiming completion:

1. Integrate the workspace/route evidence patch and add party/history navigation entries.
2. Review and implement dedicated return/line/history models, scoped FKs and audited
   status transitions; connect actual source item contracts. Do not store them as generic configs.
3. Connect company/address, tax geography/office and currency reference lookups, and
   implement identity/mapping persistence against those validated references.
4. Verify source-dependent screens when a source tax period becomes available without
   inserting one merely for crawling. Quarterly-report/update-engine behavior remains unknown.
5. Complete attachment actions and remaining toolbar parity for reference lists/forms,
   pagination beyond the current1000-row reference cap, and direct persistence tests.
6. Owner integration, CI, migrations if approved, Compose build/deploy and authenticated
   browser verification against Rubi Web3100/API4192.

The isolated3120 page is a visual test harness with disabled persistence, not a runtime delivery.

## Validation

- Contracts build passed.
- Web typecheck passed; four tax model tests passed.
- API tax suite: eleven tests passed (decimal precision, malformed inputs, readonly total,
  conditional references, branch boundary, permissions, stale version rejection).
- Contracts lint/typecheck/build, full Web/API lint and typecheck, and Web/API builds passed. Final changed files passed focused lint; final Web/API builds and11 API tests passed after delete/export/notes changes. Workspace/parity integration patch passed git apply --check but is not applied.
- No shared test database or source financial database was modified.
