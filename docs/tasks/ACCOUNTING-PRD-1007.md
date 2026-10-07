# Finance accounting PRD implementation

Owner request: 2026-10-07. Source PRD v1.0 is checked in alongside this task with credentials and production records excluded. This is an additive internal double-entry accounting workspace under the existing Finance accounting navigation. DEC-OPEN-001 remains applicable: internal numbering and operational close do not constitute statutory issuance or filing. The source site is read-only.

Acceptance: persisted branch-scoped configuration, independent dimensions, incomplete drafts, balanced approval/posting, maker/checker, closed-period exclusion, optimistic concurrency, replay-safe commands, immutable posted lines, reversal effects retained in reports, decimal money/rates, report drilldown and safe exports. Additive migration only, no operational migration/deployment. Validate on isolated synthetic records.

## Delivered behavior

Finance → Accounting uses the existing navigation and catch-all route, backed by a new Finance-owned API rather than browser-only preview data. Books are branch-scoped; choosing a book preserves its ID across forms, report drilldown and Finance source links. Existing Finance payments and settlement accounts remain authoritative.

| PRD form | Implementation in this candidate |
| --- | --- |
| F01–F03 fiscal years, books, voucher types | Persisted forms, fiscal boundaries, non-overlapping period assignment, main-book uniqueness, active/posting controls and explicit independent approval policy. |
| F04–F06 accounts and dimensions | Group/general/subsidiary hierarchy; separate detailed accounts with parent/type/classification, automatic codes, dimension requirements, nature checks, traceability and foreign currency controls. Used posting structures are protected; editorial changes remain possible. |
| F07 mappings | Validated, immutable published mapping versions for internal transfer batches. Arbitrary multi-category account grouping is not implemented. |
| F08–F10 journals, list, approval | Incomplete persisted drafts, exact money totals, type/date/dimension validation, filters/pagination, independent approval, posting, cancellation/restoration and reversal. Real Documents archive attachment upload/list, with its own permissions and security status. |
| F11 numbering | Atomic ordered numbering of non-posted documents in an open period, conflict checks and reserved serials; posted numbers remain immutable. Arbitrary movement between fiscal periods is not implemented. |
| F12 allocation templates | Persisted positive percentages, exact conservation and residual repair, server-side preview and deduplicated draft generation. This is a controlled allocation template, not an arbitrary scripting engine. |
| F13 ERP event import | Confirmed Finance transaction history through its public boundary; exact source-record link and deduplicated source journal drafts. Foreign sources require a validated conversion mapping and fail closed in this candidate. |
| F14 FX | Independently approved immutable rate snapshots; valid-time and currency precision checks; server-derived balance preview, stale-basis checks and protected revaluation drafts. |
| F15 year end | Pending-document checks, temporary-account closing, permanent balances, explicit historical FX lot policy, period close and next-year opening drafts through normal approval. |
| F16–F17 trial balance and turnover | Posted journals within one fiscal period; group/general/subsidiary rollup, exact leaf totals, paged running balances and journal drilldown. Safe XLSX trial balance download requires export permission. Filter changes hide stale results. |
| F18 report catalog | Catalog links to implemented internal trial balance and turnover. Full analytical formats, scheduled reports, statutory books, PDF/print templates are not implemented. |
| F19 transfer batches | Immutable posted-journal snapshot with mapping version, JSON and SHA-256 checksum; permission-checked internal export. No external send or fake acknowledgement. |
| F20–F22 tax | Clear external-contract gate and validated inactive connection requests. Invoice issuance, transmission, reconciliation and quarterly returns require a real approved connector/schema and remain gated. |
| F23 receipts/payments | Existing confirmed operational history, source/direction/date filtering and accounting linkage; this does not register a second payment. |
| F24 Finance linkage | Accounting link on confirmed Finance history rows, exact source-record selection, book/branch scope and duplicate protection. Approval does not invent an external accounting receipt. |

The PRD JSON is preserved as the design source, including proposals and unresolved decisions; this matrix is the actual implementation coverage. No claim of pixel-identical Rahkaran behavior or complete statutory compliance is made.

## Integrity and compatibility

- All mutating commands lock the selected book, validate the actor's permissions/branch and use canonical payload hashes plus replay keys. expectedVersion prevents lost edits; retries return the original result only for the same actor and payload.
- Money and rates use Decimal strings; Persian/Arabic digits normalize without JavaScript floating point. IRR uses integral HALF_UP amounts; other currencies use two places with HALF_EVEN in conversion/allocation.
- Posted journal/line and approved rate immutability are enforced in PostgreSQL as well as the service. The original posted journal remains in reports after an independent reversal.
- Report boundaries select one period; carried opening balances cannot cause prior-year movements to be counted again.
- Additive FinanceHistoryQueryV1 from/to fields preserve existing consumers and filter all sources before pagination. No dependency or lockfile change.
- Additive IAM catalogue/seed entries do not grant operational permissions during this task. Roles must be reviewed before deployment.

## Migration and verification

Four additive migrations: 20261007150000_finance_accounting, 20261007151000_finance_accounting_fx, 20261007152000_finance_accounting_integrity, 20261007153000_finance_accounting_audit. Rehearsal and integration tests use only the dedicated PostgreSQL 18 container, port 55437, synthetic databases accounting_test/accounting_clean. No shared or operational database is migrated; the source Rahkaran session remains read-only.

Targeted tests cover real Nest authentication/permission guards, branch isolation, concurrent posting/serials, command replay, checker separation, version changes, dimension/default-code controls, exact allocation, source deduplication, immutable approved FX, stale revaluation, historical opening, batch checksums/export permissions, report totals and paged balances. Browser verification creates a synthetic Persian-number journal and checks independent approval and report drilldown. Final command results are recorded with the review candidate.

Merge/deployment and external connectors remain separate owner-approved steps. This branch does not modify the user's original dirty checkout or shared runtime.


Final review evidence on the develop-integrated candidate: 31 focused API/HTTP/migration tests, 22 PostgreSQL tests on accounting_clean, 21 Web money/i18n tests; API/Web lint and typechecks and production builds pass. All 130 migrations apply from an empty isolated database. The legacy finance_settlement_accounts and finance_ticket_pricing_requests tables are verified present after migration; the generated unrelated schema drift is excluded from the checked-in additive migration. A migration ownership test prevents future unrelated table alters/renames/drops in this task's SQL.

Browser QA: Persian date 15 Mehr 1405 and Persian grouped debit normalize to 2026-10-07 / 100000, draft persists, maker approval is denied, a second synthetic user approves/posts journal1, trial balance and turnover show exact 100000/-100000 amounts, and the downloaded XLSX's XML matches both accounts and values. The in-app browser download-event wait timed out, but the actual file downloaded successfully and was verified directly. Existing development-shell React key warnings and absent synthetic active-company branding are outside this accounting change. No production records are used in proof artifacts.

Early parallel checks on the loaded host exceeded timeouts; isolated repeat passes are reported above. GitHub full exact-head CI remains the normal merge gate. Additive IAM catalogue entries require an explicit role/deployment review; this task never assigns real users new rights.
