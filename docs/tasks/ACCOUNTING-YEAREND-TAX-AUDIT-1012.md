# Accounting year-end, reports and tax audit — 2026-10-12

PC-B; branch `codex/pc-b-accounting-yearend-tax-audit-1012`; base `4fe291b5`.

## Scope and explicit integration hold

The user requested inspection of the four Rahkaran sections and implementation of
missing behavior. The user identified this device as PC-B and, after the active
PC-A `ACCOUNTING-TREE-CLEANUP-1012` conflict was explained, explicitly selected
independent files only: do not modify the shared accounting workspace.

This candidate therefore contains **unconnected, independent implementation files**.
It is not deployed, is not complete Rahkaran parity and does not activate any new
endpoint in the running application. Existing shared source files, schema, migrations,
contracts barrels, dependency manifests and lockfile are unchanged. New tests use
only synthetic data in a separately named PostgreSQL container on port 55442.

## Source evidence and limits

The user manually logged into `https://zakeri.rahkaran.ir/`. The source identified
itself as version 20/0 release 7, main ledger, fiscal period 2026.

Freshly verified on October 12:

- Financial navigation has General Ledger, Receipts/Payments, Taxpayer System,
  and Tax Accounting.
- Year-end exposes template lists, closing-template definition, closing voucher,
  nature-adjustment voucher, final voucher and opening voucher.
- Closing-template header: code/title required, active, second-language title,
  default description and second-language description. Counterpart grid: subsidiary,
  detail levels 4/5/6, percentage. Closable grid: include/exclude, subsidiary,
  detail levels 4/5/6. Notes and standard source toolbar observed.
- Closing wizard: description, template selection, exchange-rate definition,
  voucher preview, completion. Advancing from introduction reported
  `در دوره مالی جاری سند قطعی وجود ندارد`. No voucher was generated.
- Nature-adjustment wizard: description, voucher specifications, accounts without
  counterpart, preview, completion. The introduction describes zeroing subsidiary
  balances contrary to account nature. Later-step behavior was not verified.

Browser control then repeatedly timed out, including two attempts to recover the
same tab. Remaining forms were **not freshly crawled in this session**. Their
existing October 11 structural evidence is in the tax/taxpayer catalogues and
`ACCOUNTING-COA-REPORTS-YEAREND-1011.md`, `ACCOUNTING-TAX-PARITY-1011.md`, and
`ACCOUNTING-TAXPAYER-PARITY-1011.md`. No source business record, account secret,
financial amount or credential was copied into this candidate. No source save,
send, cancellation, scheduling, filing or financial mutation was performed.

## Confirmed gaps in the checked-in application

1. `AccountingTaxWorkspace`, `AccountingTaxpayerWorkspace` and
   `AccountingChartReport` exist, but the shared workspace does not dispatch to
   them. Taxpayer seller controller/service are not registered in FinanceModule.
2. Tax reference storage exists for thresholds, aggregation definitions and tax
   periods; it does not imply declaration/invoice persistence or official dispatch.
3. Year-end currently has operational closing/opening adapters. Observed
   counterpart-percentage and include/exclude template semantics, nature adjustment,
   final voucher and the full source wizard remain incomplete.
4. Posted trial balance, turnover and four analytical reports exist. Other report
   menu entries include evidence-only layouts; their mere existence is not delivery.
5. Secure provider credentials, real invoice/cancellation/queue models, provider
   dispatch/receipt handling, scheduling, reconciliation, statutory return lifecycle,
   official directories and source-item contracts remain absent or unconnected.

## Prepared implementation

- `AccountingCompletionModule`: opt-in module registers the existing scoped seller
  controller/service and the new read-only completion controller. Existing tax
  reference controller remains registered once in FinanceModule.
- `AccountingCompletionWorkspace`: exact-route adapter connects the independent
  tax/taxpayer/chart components. It does not capture unknown routes or replace
  working closing/opening commands. Existing inactive taxpayer settings editor is
  deliberately preserved: the observed replacement has no secure save adapter.
- Posted journal-line report: explicit fiscal period, inclusive within-period date
  bounds, account/detail filters, stable 50-row pagination and complete-filter totals
  in one repeatable-read transaction. All monetary values are fixed decimal strings.
  Foreign-currency values remain per-line; incompatible currencies are never summed.
  Web supports period/date/account filtering, journal drilldown preserving bookId,
  stale-result hiding, errors, pagination and permission-gated displayed-page XLSX.
- Year-end diagnostic: counts posted and unfinished documents, identifies temporary
  balances and balances contrary to account nature, and returns explicit
  `diagnosticOnly: true`, `executionAvailable: false`. Exact bigint decimal arithmetic
  preserves very large balances and sub-unit differences. This does not implement
  nature-adjustment or final-voucher issuance and never closes a fiscal period.

New endpoints, **only after owner integration**:

```text
GET /finance/accounting/books/:bookId/completion/journal-lines
    ?periodId=UUID&from=YYYY-MM-DD&to=YYYY-MM-DD&accountId=UUID
    &detail4Id=UUID&detail5Id=UUID&detail6Id=UUID&page=1
GET /finance/accounting/books/:bookId/completion/year-end/:periodId
```

Both require `finance.read` and `finance.journal.read`, validate book/branch and
period/reference scope on the server, and return `Cache-Control: private, no-store`.
They introduce no accounting command, new permission, role grant or migration.

## Owner integration steps — not applied

After PC-A releases the shared workspace and the candidate is reviewed:

1. Import `AccountingCompletionModule` in FinanceModule and add it to `imports`.
   Do not register a second copy of AccountingTaxController. Existing IAM/Database
   modules retain their normal authentication and configuration requirements.
2. In the authorized-book branch of AccountingWorkspace, dispatch exact matches
   from `accountingCompletionRoute(section)` to
   `<AccountingCompletionWorkspace book={snapshot} route={section} />` **before**
   the generic parity/dependency fallback. Key by book and route. Preserve all
   concurrent PC-A tree/navigation/style edits and existing source routes.
3. Add the already-observed tax-party and aggregate-history list destinations if
   absent from the final merged navigation; update the source support matrix by
   actual command/report behavior rather than setting all routes to supported.
4. Review inherited standalone taxpayer component limitations before activation:
   its New navigation currently omits bookId, and its seller-save UUID uses the
   secure-context-only `crypto.randomUUID`. These pre-existing files were not
   edited under the user's independent-files-only restriction.
5. Reuse the existing translated labels (English coverage passes without a shared
   catalogue edit). Run the integrated route/browser tests,
   exact-head CI and affected builds after applying the shared seams.
6. Deploy only to the documented Rubi Compose project (Web3100/API4192) after
   the reviewed integration. Preserve operational data and existing credentials.

The task does not claim full official-tax compliance, provider readiness, exact
source report layouts or successful runtime rollout. Completion requires the
remaining observed behaviors and external contracts, not just this adapter.

## Validation

Results are appended below after final verification. Initial tests could not resolve
unbuilt workspace package outputs; generating/building existing packages resolved
that environment issue without changing source dependencies. Initial isolated
migration attempt raced PostgreSQL startup and was retried after readiness.

Verified candidate results:

- API service/HTTP/tax regression: 25 tests passed; independent PostgreSQL: 4 passed.
- Web route/tax/chart models: 21 tests passed; English coverage/synchronization: 3 passed.
- API and Web full TypeScript checks and scoped ESLint passed. API production build passed.
- Web webpack production build passed, generating 59 pages; shared route activation is not tested because it is intentionally not applied.
- All 147 existing migrations applied successfully to the newly created synthetic database only; this candidate adds no migration.
- Generated audit covers 56 distinct routes (6 year-end, 19 reports, 13 taxpayer, 18 tax); 32 have a prepared independent adapter, including two diagnostic-only routes.
- Browser interaction and authenticated Rubi visual QA remain unverified after the recorded browser failure. Full source parity, shared integration and external tax dispatch remain open.
- Initial English coverage found nine untranslated new labels; reused existing semantically matching translated labels without editing the shared catalogue, then all three coverage tests passed.

Publication receipt: implementation commit a2de09e4, pushed to origin/codex/pc-b-accounting-yearend-tax-audit-1012. Draft PR800: https://github.com/nirvanamahlou/Rubi/pull/800 (authenticated author nirvanamahlou). Independent source reservation is frozen/released for review; shared integration remains held by the explicit user instruction. Final API/Web TypeScript and both production builds passed. Disposable rubi-completion-test-1012 container is stopped; its synthetic evidence database is retained. No merge or deployment.
