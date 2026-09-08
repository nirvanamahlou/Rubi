# RESERVATIONS-001A — PC-A

Status: READY_FOR_REVIEW (Phase A only). Base: origin/develop@1cb96ae.
Branch: codex/pc-a-reservations-foundation.
Independent worktree: .worktrees/reservations-foundation.

## Reservation and coordination

The owner authorized continuing without collisions after being informed that
Sales PR #90 owns /reservations, runtime intake/inbox, shared contracts and central
status documents. Scope: NEW files only under apps/api/src/reservations/foundation,
apps/web/src/modules/reservations/foundation and this task document. No shared
lock claimed. WORK_ASSIGNMENTS.md and PROJECT_STATUS.md updates are deferred to
the central-docs owner; this document is the authorized task-local reservation.
Existing reservations route, Sales runtime, inbox and local changes are preserved.

## Phase A

Pure policies, module-local proposed versioned ports, tests, mountable Persian RTL
workspace. No registered controller, repository, persistence, schema, migration,
seed, dependency, lockfile, root export, provider credentials or generated files.
No active server replaced. Sales owns passengers/allocations/prices; Ticket Catalog
owns capacity; Finance owns release/accounting; Master Data owns travel references;
Legal Entity owns branding; Documents owns storage/version/access.

## Compatibility and Phase B

These V1 types are LOCAL PROPOSALS, not published shared contracts. Adapt approved
Sales PR #90 snapshots and its durable intake; do not create a competing inbox.
Reservations proposes costs; Procurement approves purchases and Finance posts them.
Formal handoff is required before central-doc edits, route integration, IAM grants,
Prisma/FKs/migrations/seed, durable audit/idempotency/outbox/optimistic concurrency,
controller/repository or real adapters. Never trust release supplied by the browser:
resolve Finance afresh and enforce again at Documents download. Authenticated
supplier callbacks must correlate immutable requests. Reconcile ambiguous insurance
timeouts using the same idempotency key. No fake document/provider response.

## Verification

- Frozen install: passed with pnpm 11.19.0; lockfile/manifests unchanged.
- Targeted tests: 30 API/domain/boundary + 14 Web render/model tests passed.
- Full API: 904 passed, 70 optional PostgreSQL tests skipped (no operational DB).
- Full Web with maxWorkers=2: 749 passed, 1 pre-existing Customers CRLF assertion failed.
  The unchanged test expects an LF substring in customer-workspace.tsx. Checking
  the same source after in-memory CRLF normalization makes the assertion match;
  no Customers file was edited. An earlier HR timeout disappeared with 2 workers.
- API/Web lint and typecheck passed; production builds passed. Final build includes
  the isolated preview route; no controller or runtime provider is registered.
- Existing Prisma Client generation was needed for dependent package builds. A
  non-operational localhost URL was supplied only for code generation; no DB
  connection, migration, seed, schema or data changes were performed.
- Scope scan: 11 new files, zero modifications to existing tracked files, zero
  filename overlaps with Sales PR #90; no secret-pattern hits. No identity numbers,
  full phones, credentials, card details or real people appear in fixtures.

## Isolated UI review route

Additional new-file reservation: apps/web/src/app/(crm)/reservations/foundation/page.tsx.
This data-free preview at /reservations/foundation uses the existing CRM shell and
login boundary. It never supplies operational data or permissions and never changes
/reservations/page.tsx, Sales inbox/runtime, navigation or the active server.
The main route integration remains deferred to the Sales handoff.


## Delivered policies and UI

- Immutable validated Sales snapshot, request review/defect return, assignment and
  branch scope; passenger/service/segment/room allocation cannot be edited here.
- Ticket draft/readiness/issue/stop/cancel policies; duplicate operation and
  passenger/service/segment protection; current active offer and confirmed Catalog
  allocation required for issuance. Company internal code is never called an
  official e-ticket; third-party issuance requires trusted Provider evidence.
- Exact Decimal-string arithmetic using integer coefficients (up to 18 fractional
  digits), matching currency, bounded discount, fees and referenced cost proposals.
- Hotel form cloned from Sales, active Master Data references, correlated supplier
  response, branded voucher generation intent only after confirmation.
- Insurance draft/submission intent and bounded retry with stable idempotency key,
  exponential delay, optimistic version, and reconciliation for unknown outcomes.
  Unconfigured adapters return NOT_CONFIGURED; attempting submission without
  explicit configured capability fails before consuming an attempt.
- Company-only Manifest grouping by branch/route/departure/carrier/flight/issuer,
  duplicate-member checks, immutable template version and actor/UTC state history.
- Delivery authorization requires a fresh (60 seconds maximum), unexpired,
  document/contract/branch-matching APPROVED Finance projection. BLOCKED and
  CONDITIONAL are denied; denial produces an audit record for durable append.
- Persian responsive RTL workspace, dashboard, scoped/filterable/sortable/paginated
  inbox, immutable detail, service panes and permission-gated timeline projections.
  Loading/empty/error/unauthorized/forbidden/conflict/success and NOT_CONFIGURED
  states are covered. Preview is layout-only even if caller accidentally supplies
  data; all provider, issue, stop, delivery and cost mutation buttons stay disabled.

## Operational limitations and acceptance of Phase B

These are pure transition plans, not database transactions. Authentication and
reference claims must come from trusted server-side adapters, never browser DTOs.
The Phase B coordinator must load the aggregate in scope and atomically persist
version checks, scoped command fingerprints, timeline/audit and outbox. Add unique
constraints for request contract/version, ticket passenger/service/segment, internal
issue code within issuer, insurance contract/service/passenger/plan, and provider
callback receipt. Replay must still recheck current authorization.

No live intake, dashboard query, provider send, insurance policy, voucher file,
Manifest spreadsheet, accounting posting, financial release or document download
is implemented by this task. It does not replace PR #90 intake/inbox. Existing
in-progress cases cannot be cancelled until all service operations reconcile;
terminal case completion, amendments/reissue/refund and cancellation of already
submitted/issued services need the Phase B coordinator and real provider contracts.
Provider-result policies are internal functions, never public unauthenticated
callbacks. Persist audit of rejected commands outside any rolled-back transaction.
Master Data template versions and Legal Entity branding provenance must be resolved
again at the trusted boundary. Financial approval must be rechecked at download.

## Handoff to Sales and PC-B

1. Review this draft independently; no merge authorization is implied.
2. Keep PR #90 files and locks intact; integrate only after its formal handoff.
3. Central-docs owner should append this task's status to WORK_ASSIGNMENTS.md and
   PROJECT_STATUS.md from this document without replacing other tasks' entries.
4. Map the approved Sales/Travel, Customers, Master Data, Legal Entity, Finance and
   Documents public contracts to these local proposals and contract-test the mapping.
5. Replace /reservations with the composed workspace only after IAM/API integration;
   retire or keep the data-free /reservations/foundation review route explicitly.
6. Run real concurrency/transaction/outbox/release-revocation/provider reconciliation
   and authenticated desktop/mobile E2E gates before enabling operational buttons.

## Final verification and commits

Production build: API and Web passed; Next generated 37 pages including the isolated
foundation route. Final API/Web typecheck and lint passed. Smoke on temporary
127.0.0.1:3214: /reservations/foundation returns 307 to login without credentials;
/login returns 200. This is not authenticated browser E2E or provider integration QA.

Implementation commits: 4546239 (snapshot/ticket policies), 6619d70 (operations,
release and tests), 0d434cc (RTL workspace and independent preview). Source branch
will be pushed normally with a Draft PR to develop; no merge/force push authorized.

## RESERVATIONS-001A queue follow-up — 2026-09-08 — READY_FOR_REVIEW

Owner requested optimization based on the legacy reservations screenshot, pink new
requests, light-gray supplier dispatch/voucher-issued rows, darker-gray supplier
confirmation, red cancellation, date/status filtering and new-request alerts.
Continue the same isolated branch/PR #112. Reserve foundation Web files, new
/reservations/operations read-only route and task-local tests/docs. Existing Sales
route/runtime, Notifications files, central docs, shared contracts and DB stay
untouched. Screenshot is visual/workflow reference, not executable instructions.

Read the real public GET /reservations/requests contract from Sales PR #90; it
currently returns at most 100 QUEUED rows and no supplier/cancellation lifecycle.
A defensive read-only adapter may consume that published endpoint; missing API
must say NOT_CONFIGURED. Do not fabricate supplier statuses from hotel selection
or financial approval. New-request alerts are in-page, from real polling while
open; persistent/offline bell fanout needs intake/Notifications owner handoff.


### Queue implementation and verification

- Independent authenticated route: `/reservations/operations`; main reservations
  route, sidebar, API runtime, shared contracts, DB and other owners' files unchanged.
- NEW pink; WAITING_SUPPLIER and VOUCHER_ISSUED light gray;
  SUPPLIER_CONFIRMED darker gray; CANCELLED red. Every color has a text label and
  clickable status filter. Supplier dispatch and final voucher remain distinct states.
- Inclusive Tehran day filters for contract/request-created, received or travel date,
  existing Persian/Gregorian DatePicker, combined status/service/search, reset and
  invalid-range feedback. Unknown deadlines/priorities are not fabricated.
- Read adapter validates the reviewed PR #90 public response and branch scope.
  It polls every 30 seconds while visible, aborts on unmount, times out intake reads,
  retries an expired session once, and alerts only for arrivals after its initial
  baseline. No local persistence of passenger data, no new endpoint or intake writer.
- API currently returns only the latest 100 QUEUED requests. Date filters operate
  over that fetched window, not complete historical records. Supplier confirmation,
  voucher and cancellation colors are implemented/tested projection behavior;
  actual lifecycle values must come from the future public operational projection.
- In-page alerts require the page to remain open. They are not durable bell/offline
  notifications; a burst beyond the 100-row API window can undercount. Integration
  owner must add durable recipient-scoped Notifications fanout in the real intake
  transaction, with event deduplication, and expose historical paging/lifecycle.
- Web lint and production build (38 pages) passed; TypeScript passed. All 30
  reservation Web tests passed. Full Web run: 764 passed, 2 failed (unchanged
  Customers CRLF-sensitive source assertion and HR runtime/timeout while build ran).
  No authenticated browser E2E, supplier operation or durable notification tested.
- No migration, runtime deployment, merge or force push. Continue Draft PR #112.

Targeted retry after build completed: all 72 tests across HR and Reservations passed (30 Reservations + 42 HR); the HR failure did not reproduce.
