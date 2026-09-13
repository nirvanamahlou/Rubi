# PROCUREMENT-001 — خرید و تأمین عمومی

Status: READY_FOR_REVIEW. COMPUTER_ID=PC-B. Branch `codex/pc-b-procurement-001`.
Base: `060fc35cf42493edd9d579fbf51fe62ff512261e`.

Review-compatibility scope: isolate the already authorized HR Procurement projection
in its own public module and move only this task's central-document sections to avoid
concurrent develop insertions. No merge, rebase, force push or other task source is used.
The isolated public HR module passed focused lint, API production build and real Nest
application-context startup. Read-only integration preview against `develop@eb6af3ff`
reported no conflicts after this adjustment; this preview did not merge either branch.

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

## Implementation and API

The `/purchases` Foundation route is now an authenticated Persian RTL workspace with
nine navigation groups, nine real operational queues, paginated requests and records,
current owner/next action, incomplete draft form, goods/service lines, document picker,
quotation comparison, reasoned selection, order issuance/amendment, receipts,
service acceptance, discrepancies, returns, compensating corrections, invoices,
matching, Finance handoff, closure, scoped reports and queued exports.
Server errors preserve entered form values; retries pin the original version and key.
The permission catalog has 26 Procurement permissions (the 24 requested permissions
plus independent single-source selection and emergency-purchase authorities).
Technical administrators receive none of them through automatic seeding.

All routes below are under `/api/v1/procurement`, authenticated through IAM:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/bootstrap` | Authorized permissions, active branch/currency/requester references and connection gates |
| GET | `/owners`, `/suppliers` | Bounded owner/supplier projections |
| GET | `/requests`, `/requests/:id`, `/requests/:id/records` | Branch and own/unit/all scoped lists, details and immutable histories |
| POST | `/requests` | Idempotent incomplete draft creation |
| PATCH | `/requests/:id` | Atomic expected-version edit and new immutable request snapshot |
| POST | `/requests/:id/commands` | Permission-specific versioned commercial operations |
| GET | `/reports` | Currency-separated totals, cancellation groups, delivery/approval/supply indicators |
| POST | `/exports` | HTTP202 persistent bounded export job |
| GET | `/exports`, `/exports/:id` | Actor-owned job history and Documents archive references |

Important commands use `Idempotency-Key` plus `expectedVersion`. Replays return the
original result; changed payloads with reused keys and stale aggregate versions fail.
The aggregate version claim, commercial writes, audit, notification and outbox are
transactional. Invoice identity normalizes Unicode and Persian/Arabic digits and
uniquely scopes supplier invoice number to supplier and legal issuer. Amounts use
Decimal(24,4), exact arithmetic without silent rounding, and active currency codes.
Order issuance requires approval of that exact order/version/supplier/amount/currency.
Receipt correction and returns preserve original rows and accepted Finance references.
Closure cannot strand accepted but uninvoiced quantities or pending receipt disposition.

### Persistence

26 Procurement models cover request/item/version; approval snapshot/step/decision;
quotation/item/selection; order/version/item; receipt/item/adjustment; service acceptance;
discrepancy; return; invoice/item/match; Finance handoff; outbox; idempotency; audit; export job.
Four additive migrations add restrictive simple/composite FKs, Decimal checks,
immutable-history triggers, unique invoice/source identities and scoped ordering indexes:

- `20260913090000_procurement_001`
- `20260913110000_procurement_commercial_line_integrity`
- `20260913120000_procurement_receipt_adjustment_export`
- `20260913140000_procurement_scoped_list_indexes`

First pages read at most 51 rows. Later pages select narrow scoped identities before
fetching at most 51 payloads with scope reapplied; operational queues use a narrow
materialized CTE. No per-row foreign-module queries are used.

### Real connections and owner handoffs

| Owner | Implemented connection | Remaining gate |
| --- | --- | --- |
| Master Data | Public active supplier/currency/branch projections, immutable supplier identity/version/label | Approved FX snapshot adapter; cross-currency comparison fails closed |
| IAM/HR | Active scoped candidates/session revalidation, original requester unit | No invented approvers or manager hierarchy |
| Documents | Public permission-scoped source versions, clean-file checks, upload/archive/download | Operator must configure storage encryption and real antivirus |
| Legal Entity | Specific issuer required for PDF, persisted branding snapshot | `ALL` issuer rejects PDF; operational records remain shared |
| Notifications | Internal transactional notifications and request deep links | Notification is never an approval decision |
| Finance / PC-A | Proposed typed `ProcurementFinanceSourceV1`, stable source key, one durable handoff, blocked outbox | Owner-approved accepting inbox/acceptance ID/payment projection absent: `NOT_CONNECTED` |
| Tasks | Versioned durable `procurement.workflow-event.v1` outbox | Approved consumer/ack/retry contract absent; event stays BLOCKED |
| Reservations | Versioned reference shape and boundary checks | Approved origin validation/deduplication adapter absent; no travel debt or booking created |
| Settings / business owner | Versioned policy port, snapshot validation and ordered approval steps | Configure approved unit/category/currency/amount/emergency policy before submission |

Finance must accept a source idempotently and return its own immutable acceptance ID;
it must expose paid/partial/remaining values without Procurement editing payment tables.
No actual payable, settled status, payment retry or ledger entry is fabricated here.
Tests preserve an accepted-handoff fixture across commercial returns; they do not claim
to exercise a missing Finance payment implementation. Travel reference rejection proves
that no Procurement debt is created, not a working Reservations receiver.
Post-fulfilment commercial amendment, approved price adjustment and prepayment remain
explicit policy gates until their financial compatibility rules are approved.

### Runtime and export operations

QA used only Web3217, API4317 and PostgreSQL55473 on loopback. Existing shared runtimes
were not stopped or replaced. Test credentials, encryption keys and downloaded fixtures
remain outside Git in the task's OS temporary directory. No production roles were changed.

PDF generation requires an absolute operator-controlled `PROCUREMENT_PDF_BROWSER_PATH`
to Chromium. The renderer uses a private temporary profile, inert escaped HTML, no
remote page assets, bounded execution and normal Chromium sandboxing. XLSX preserves
exact decimals as text and prevents formula injection. Export jobs revalidate live IAM
session/permissions and branch scope, archive through Documents, and recover by exact
job source identity. The persisted scan result is the initial archive snapshot; Documents
is authoritative for current scan/download status. Large exports are capped at 100,000
rows/20MB and use a durable 10-minute lease with bounded crash recovery attempts.
Paginated exports reflect reads during job execution, not a historical database snapshot.

## Validation and delivery

- All 64 repository migrations applied to a fresh PostgreSQL18.1 database; migrate
  status up to date. All 14 real PostgreSQL integrity tests passed after final indexes.
- Standard seed twice: stable 158 permissions, 8 roles, 249 role grants, 1 user,
  2 customers, 2 currencies, zero purchase requests; 26 Procurement permissions and
  zero technical-administrator Procurement grants. Later browser fixtures were separate.
- Full non-Web pipeline: 20/20 lint/typecheck/test/build tasks passed. API unit suite:
  150 files / 1313 tests passed, 14 files / 158 opt-in integration tests skipped.
  Contracts: 71 passed; database: 75 passed with 14 opt-in tests skipped;
  config: 2 passed; worker: 1 passed. Opt-in Procurement database tests ran separately.
- Final targeted API: 30 actual PostgreSQL service tests, 3 export queue tests and
  49 domain tests passed (82/82); API typecheck and focused lint passed. Full Web:
  216 files / 1353 tests passed with one worker; final UI presentation additions:
  6 files / 15 tests passed. Full Web lint and typecheck passed. Final Next production
  build passed all 46 routes. Initial complete Web run had one outdated Foundation
  expectation (corrected for the authorized route transition). A concurrent rerun had
  four existing HR timeouts; no HR source or timeouts were changed.
- Browser: real synthetic IAM login, real incomplete draft save/reopen, malformed
  amount error with title/value/notes retained; missing policy notice and blocked Submit;
  desktop RTL and mobile 390px layout (375px content width, no horizontal overflow).
  XLSX and PDF jobs archived via actual Documents; actual Microsoft Defender scan CLEAN,
  authorized download HTTP200, 2049-byte XLSX and 51531-byte PDF initial samples.
  PDF was rendered through Poppler and visually reviewed; date/status presentation was
  then localized. Final rebuilt API generated a new 52,232-byte PDF, CLEAN scan and
  HTTP200 download; its rendered Persian dates/table were visually verified again.
  These are synthetic QA files, not business outputs. Final API/dependency lint/build
  pipeline passed 8/8 tasks after source freeze; final Web history shows Persian Tehran dates.
- [Reproducible load evidence](PROCUREMENT-001-load.md): 100,000 requests, 50 concurrent
  service callers, 800 measured calls, zero errors. Final primary P95 1118.64ms;
  own304.10ms, unit278.84ms, page350351.77ms. HTTP/auth/browser latency is excluded.
  No production SLO, Lighthouse, p75 Web Vitals or sustained 50QPS guarantee is claimed.

Source scan found no matching credential/private-key/token literals, foreign Prisma
model access in Procurement source, added broken Markdown links or dependency changes.
This targeted scan is not a guarantee against every form of secret or PII.
No merge, deployment, main/develop write or lockfile change is part of this task.
Draft PR: [#269](https://github.com/nirvanamahlou/Rubi/pull/269), target `develop`.
The branch was pushed normally; the PR remains a draft and was not merged.

The complete changed-file inventory is [PROCUREMENT-001-files.txt](PROCUREMENT-001-files.txt).
Source implementation revision: `9612e64b4c5986098bec5144417994a9c89d1110`.
Reviewers should use the final branch HEAD for documentation/evidence as well as code.

Migration, central-doc and Procurement contract reservations for this task are RELEASED;
Dependency/Lockfile was never acquired. Module ownership stays with PC-B. No action is
required from PC-C for the current slice; PC-C reporting may consume a separately approved
public Procurement report contract later. PC-A Finance and business policy owner handoffs
are listed above. Task-owned loopback QA runtimes/container remain isolated and available;
temporary load/empty-verification databases were removed after evidence capture.

## Later phases

Structured supply contracts, renewal reminders, supplier evaluation, request consolidation,
budget reservation, inventory integration, external sending and recurring orders.
