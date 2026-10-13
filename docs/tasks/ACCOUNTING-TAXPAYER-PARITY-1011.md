# ACCOUNTING-TAXPAYER-PARITY-1011

Candidate only; not full operational parity and not deployed to3100.

Read-only Rahkaran crawl on2026-10-11 observed13 menu leaves,54 labeled form
controls and65 table columns. Conditional direct/trusted-company settings,
seller person/company/civil participation, batch collection/send filters,
report daily/monthly choices and cancellation reference subjects were observed.
No source record values, credentials, tax invoices or keys were imported.
No source save, upload, send, cancellation, scheduling or reconciliation ran.

Delivered independent Web catalog/model/component covers all13 routes. Source
collection/send shows a license error; its hidden fields are not invented.
Invoice lists have40 columns; cancellation8; schedules9; settings2; reconciliation6.
Controls retain observed labels, types, disabled/read-only states and dependencies.
Secrets are disabled until secure credential integration exists, never exported.
Lists explicitly distinguish unavailable data from an empty successful response.

A dedicated seller GET/POST service persists only the four observed editable
seller attributes in the book-scoped AccountingConfiguration reference kind.
No financial documents are stored as configuration. Server enforces Finance
permissions, actor branch scope, strict field allowlist, conditional fields,
optimistic version, actor-bound idempotency and serializable command audit.
Seller title is not fabricated from ledger title. Profile remains inactive;
saving it does not activate an external connector.

PC-B Finances confirmed central service/workspace/parity/contracts-accounting.ts
and schema/migration locks remain ACTIVE. All new files are independent. A central
integration patch adds controller/provider registration, route dispatch and current
parity evidence. It is NOT applied. Tax candidate bfba7d2e/2dde78b0 remains a separate
unintegrated predecessor; this branch preserves those commits. No shared DB/runtime
mutation, migration, credentials change or deployment performed.

Still required for user-requested completion:
- Review/apply central patch with PC-B, integrate and verify authenticated3100.
- Secure credential store and provider contract for direct/trusted-company modes.
- Dedicated invoice, cancellation, queue and scheduler models/commands; migration lock.
- Actual seller legal-company title and trusted-provider/system directories.
- Read APIs for four lists, reports, middleware and operational histories.
- Reconciliation import/validation and later steps; source requires data not entered.
- Source license for collection/send, existing invoice detail forms, report output.
- Notes/attachments/history/chat/process integrations. These are visibly unavailable.

Verification:
- API6 tests: unknown/secret/status field rejection, identifier preservation,
  conditional fields, read/write permissions, branch isolation, single inactive
  profile/idempotency, stale version and cross-actor/key misuse.
- Web6 tests:13 unique routes, license block, conditional credential clearing,
  secret omission, seller dependency, batch dependency and radio exclusivity.
- Targeted lint passed; API typecheck/build and Web typecheck passed.
- Central integration patch check with --ignore-space-change passed (CRLF source).
- Full Web build and isolated visual checks: recorded after completion below.
- Service tests use test doubles; actual PostgreSQL persistence is NOT verified.

Final verification: full Web production build passed (59 pages); API build passed.
All13 actual component routes rendered in an isolated visual harness. Direct/trusted
settings visibility, disabled credential entry and batch-send/collect dependency
clearing were verified in browser. Harness API used no persistence and source
records were absent. Preview stopped and temporary browser tabs closed.
