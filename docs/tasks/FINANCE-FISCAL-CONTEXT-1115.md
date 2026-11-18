# FINANCE-FISCAL-CONTEXT-1115 — READY FOR INTEGRATION

PC-D; branch `codex/pc-d-finance-fiscal-context-1115`, worktree `C:/Users/Ehsan/.codex/worktrees/finance-fiscal-context-1115/Rubi`, based on PC-D-Integration then fast-forwarded to develop `0cd76533c`. Existing root checkout and all predecessor worktrees are preserved.

## Owner decisions

- One shared default fiscal period per root company, visible only to staff with the existing Finance/job/route permissions. Jahan Academia shares Jahan Bastan's ledger/default.
- A Finance user may temporarily browse another allocated year for themselves. Leaving Finance or logging out/re-entering restores the shared default. Temporary choices must not be persisted as another user's/company's preference.
- With no default, display **سال مالی: تعریف نشده**; never silently select the newest/first open year.
- Prior-year open debt/receivable items remain available in a separate carried-forward section showing original year, original date, original amount and remaining amount. New settlement belongs to the selected year and links to the original record; no copying/duplicate posting. Preserve exact per-currency balances and opening amounts.
- Date-scoped financial transactions, reports, exports and writes follow the selected company's year. Accounts, reference data, banks and other timeless definitions remain shared across years. Existing data must be preserved.

## Implementation contract

- Sole additive schema lease: AccountingPeriod.isDefault=false plus a partial unique index on bookId for true rows; no default backfill. Existing period/book/year FKs remain canonical. Default changes use Accounting command book lock, book CAS/version, replay and audit. Only finance.account.manage may change the shared default.
- Additive FinanceFiscalContext metadata endpoint and request-local AsyncLocalStorage. Validate actual current company/branch, explicit temporary period, mode and period version. Client hints are constraints, never authorization. Preserve native role/branch/company permissions.
- Header provider is active only inside Finance for Finance-authorized users. Temporary state stays in memory for the current Finance visit; cache isolation includes actor, company context version and selected period. Remove stale Finance/Accounting query caches before showing another year's data. Auth retries preserve the same body/idempotency key and frozen fiscal headers.
- Missing year and aggregate company context must not silently expose mixed-year transactions. Setup routes remain available so the owner can configure ledgers, years and defaults. Explicit year-end/transfer target periods must retain their supported cross-period behavior; source periods remain scoped.
- HTTP Finance context must not accidentally impose the UI year on unrelated internal source-owner calls from Sales/HR/Procurement. Scope existing public services instead of direct cross-module table access.

## Delivered behavior

- Header shows the company default or **سال مالی: تعریف نشده**. The personal selector remains in memory for the current Finance visit; leaving Finance, changing actor, logout or reload clears it. Changing companies keeps distinct temporary choices while the visit lasts. Context loading/error/retry and existing route permissions are respected.
- The shared-default checkbox is available in the ledger allocation table and fiscal-year list/form. An active allocated year is required; no newest/open year is silently chosen. Closed years remain available for historical reads, while closed/archived years reject monetary writes. One default per ledger is enforced by PostgreSQL and by the audited Accounting book-lock/CAS/replay command.
- Journals, turnover/trial balance, completion reports/browser/lines, statements, financial events/reconciliation, workflows and date-scoped tax drafts/periods use the selected period or business-date interval. Bulk source IDs, stored exports, wrong-company books and stale calendar versions are guarded. Explicit move/year-end destinations retain their native target validation. Source-unobservable year-end stages remain explicitly unavailable as previously authorized.
- Finance transaction history filters at each source before union pagination/export. Newly captured payments in another bound company/year are excluded. The operational queue separates current-year requests from open prior-year balances. Carryovers display original source date, allocated year if known, original amount and exact outstanding balance separately per currency. Settlement remains linked to the original source and is recorded in the selected open year; no financial source is copied or posted twice.
- Authenticated browser requests freeze actor/company/year/version constraints through authentication retry. Finance-owned HR payroll HTTP routes also resolve the calendar server-side. Excel downloads, the private PDF proxy and trial-balance exports retain the same context. API validation treats hints as constraints, preserving native role, branch, issuer and hidden-record controls. Stale Finance/Accounting query caches are removed before a new context is displayed.
- Timeless chart/detail/type definitions, bank/settlement accounts, source references and recurring setup remain shared. Party/fund balances retain opening and prior-year amounts instead of erasing outstanding obligations. Internal source-owner calls without a Finance HTTP context retain their existing behavior.

## Persistence and preservation

Migration `20261115153000_finance_fiscal_default` adds `AccountingPeriod.isDefault=false`, one partial unique default-per-book index, nullable restrictive `FinanceAccountingEvent.fiscalPeriodId` and `FinanceOperationalRequest.fiscalPeriodId` FKs/indexes. New Finance-scoped facts/requests are bound to their real period; existing facts are not backfilled or re-fingerprinted. Referenced periods cannot be deleted or redated. New request origin ownership survives later-year settlement.

Legacy source rows without a period association keep their native branch/company visibility and valid source dates. An original date with no allocated year is labelled **فاقد تخصیص سال مالی** rather than guessing an owner/year. Aggregate ALL mode requires selecting a company for operational year views; setup remains available. No operational data, permissions, credentials, dependencies or lockfile definitions were changed.

## Validation and publication

Additive migration deploy succeeded on the two isolated synthetic PostgreSQL fixtures (`accounting_test` on55437 and `rubi_completion_test` on55442). No operational database was migrated, restored or reset. PostgreSQL tests cover shared defaults, concurrency/CAS/replay, access, source-year reads/writes, immutable event capture, FK preservation, tax filtering and request origin ownership. Unit/render/transport tests cover timezone/DST boundaries, carryovers, actor/company/year isolation, undefined years, setup access and frozen export/authentication requests.

Validation passed: affected API/Web ESLint; API/Web typecheck; Prisma schema validation/format; API and Web production builds (68 static pages generated). Finance API/Sales-scope regression run:561 passed,14 environment-gated tests skipped; latest shared-picker interceptor compatibility check:5 passed. Finance Web/exports/English coverage:292 passed,1 environment-dependent test skipped. Additional completion/tax run on55442:22 passed,4 design-fixture-gated tests skipped. Dedicated new fiscal PostgreSQL suite:8 passed, including real JSON date filtering, concurrency/default uniqueness, Finance request ownership and source-year guards. Earlier fixture/legacy-call-shape failures were corrected and the affected suites rerun successfully.

No visual acceptance against an operational site is claimed. No hosted CI was manually dispatched. User authorizes standing automatic task-branch commit/push; no new PR, merge, runtime replacement or production deployment is authorized by this task. The changed migration is still pending on operational databases. Preserve the existing root checkout and all predecessor worktrees. Source/migration lease is released at the final task-branch publication.
