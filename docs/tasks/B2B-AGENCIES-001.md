# B2B-AGENCIES-001 — PC-B

Status: partial implementation ready for review; B2B-AGENCIES-001B blocked by
owner contracts and shared locks. Base: `origin/develop@30d67ec`.
Branch: `codex/pc-b-agencies-organizations`.
Worktree: `C:/Users/admin/Rubi-agencies-organizations`.
Published: [Draft PR #113](https://github.com/nirvanamahlou/Rubi/pull/113) to
`develop`. API commit: `889512c`; Web commit: `0ceaa12`; scoped reservation and
handoff commit: `4d4b409`. Normal push succeeded; no merge was performed.

Baseline: [existing agency integration](AGENCY-B2B-INTEGRATIONS-001.md) and
[module boundaries](../MODULE_BOUNDARIES.md).

## Scoped reservation

The original checkout and existing agency worktree were clean before work.
PR #98 is merged. PR #90 (Sales) and #112 (Reservations) remain open.
This task reserves only `apps/web/src/modules/organizations/**`,
`apps/api/src/b2b/**`, the follow-up local-only helper
`apps/api/scripts/b2b-local-demo.mjs` and this task report. Existing APIs and
identities are reused.
No Sales, Reservations, Customers, Master Data, IAM, central UI, root contract,
dependency, schema, migration or seed file is reserved or changed.

The owner's explicit Central Docs lock exception applies: reservation and handoff
are recorded here instead of changing WORK_ASSIGNMENTS or PROJECT_STATUS while
Sales owns those central files. No lock is taken from another task.

## Baseline and boundaries

Master Data owns Organization, roles, masked contacts and addresses. Existing B2B
owns branch profiles, agreements, credit policies and rates. Its public directory
currently accepts AGENCY only. Corporate identities can already be listed and
edited through Master Data's public role filter. No duplicate identity is needed.
Customers owns traveler identity; Finance owns posted balances, deposits,
payments, settlement and approved commissions. Documents owns file operations;
Sales owns contracts and Reservations owns issuance. Missing projections are
unavailable, never synthetic zeroes.

## Verification assumptions

Internal authenticated desktop/corporate-network UI, Persian RTL; WCAG AA owner
PC-B. Targets: p75 LCP 2500ms, INP 200ms, CLS 0.1; initial JS 200KB gzip and route
80KB gzip; Lighthouse performance 85 and accessibility 90. These are targets,
not measured results. Existing modular monolith, branch access within one
deployment, PII masked by owner, read/write 20:1 and peak 50 QPS. Proposed API
p50/p95/p99: 150/300/600ms; SLO 99.9%, RPO 24h, RTO 4h; PC-B consumes the task's
error budget. No infrastructure or framework change is proposed.

## B2B-AGENCIES-001B — blocked dependencies

- Migration and shared-contract/seed handoff: persistent credit requests with
  maker/checker separation, approval permissions, status history and idempotency.
  The current policy write is not a maker/checker workflow.
- Expanded profile fields and corporate operational directory support; preserve
  the existing profile table and public API instead of adding parallel identities.
- Versioned agreement approval, issuer/branding, signed document validation,
  commission rules, service-backed rates and priority/conditions. The present
  slice adds conservative overlap locking to writes in the existing repository.
- Customer-backed passenger assignments and contact user/customer references,
  travel requests and durable versioned Sales handoff/outbox.
- Public Sales/Reservations/Finance projections, aggregate dashboard, operational
  branch/account-manager/credit filters and authorized B2B exports.
- Notifications producer events, B2B audit/timeline query contract and durable
  expiration reminders.

These need their owners' contracts or locked persistent structures. Browser
storage, in-memory repositories and fabricated financial data must not substitute
for them. Existing Master Data contact ownership is preserved pending an explicit
cross-module design decision; organization contacts are not copied into B2B.

## Validation and delivery

No schema/migration/seed source change, operational account grant, merge or
deployment. Existing migrations and seed are exercised only on a new disposable
PostgreSQL 18.1 container with private temporary storage and a random local port.
The container is stopped after the suite; application databases and volumes are
never used. The test is opt-in with `RUBI_RUN_B2B_POSTGRES_TESTS=1` and expects the
existing local `postgres:18.1-alpine` image (`--pull=never`).

## Implemented in this slice

- The existing `/organizations` route lists agency or corporate Master Data
  identities through the existing exact server-side role filter. Search,
  sorting and pagination remain server-side. Dual-role records retain one ID
  and have an explicit dual-role label; a combined union filter is not claimed.
- Base creation/editing retains canonical roles through the existing Master Data
  form. Create/edit controls deny access until IAM permissions are loaded.
- Mobile cards avoid the former mandatory wide table. The existing agency
  profile has overview/address/credit/agreement/rate-and-commission/related-record
  sections. Counts describe only the selected branch's returned records, not a
  global operational dashboard. Contact pages use the masked public directory;
  fetch failures are distinct from an empty contact list. Existing contacts can
  be created/edited through the existing Master Data form/API. Organization is
  locked to the current profile, editing preserves the expected version, and a
  mismatched existing organization reference is rejected before the request.
- Request sequencing ignores stale list/profile/contact responses. B2B HTTP
  errors retain status and stable code; 401 may refresh once, while failed writes
  are never automatically retried for conflicts. Mutation errors leave form
  elements mounted; no browser persistence is introduced.
- Public B2B service methods now enforce permissions as well as controllers;
  branch validation precedes identity lookup on writes. UUID route references,
  calendar-valid dates, trimmed text, non-null lifecycle defaults and database
  Decimal precision are validated. Money and percentage rendering preserves all
  Decimal digits instead of converting through Number.
- Existing profile creation is serialized by organization/branch and respects
  ENDED state and an expected-version mismatch. Rate check/write/audit is
  serialized per profile inside one transaction. An overlapping active rate for
  the same case-insensitive service, kind and currency is rejected, including
  shared end/start days. Different currencies/kinds and adjacent dates remain
  independent. Previously stored rates are not rewritten.

## Deliberate compatibility changes

The new requirements prohibit the old direct-approval paths. Consequently,
`PUT /b2b/agencies/:id/credit-policy` now rejects writes with HTTP 409 /
`B2B_CREDIT_APPROVAL_REQUIRED`, and creation of a non-DRAFT agreement rejects with
`B2B_AGREEMENT_APPROVAL_REQUIRED`. Existing credit policies and agreements remain
readable. The UI creates only draft agreements and disables credit editing with
an explanation. **This is a fail-closed gate, not a completed maker/checker
workflow.** Re-enabling either path requires the persistent approval workflow in
B2B-AGENCIES-001B; removing the gate alone would bypass the owner's requirement.

## Contract handoff (proposal only)

| Requested surface | Reuse / missing producer |
| --- | --- |
| Organization reference | Reuse Master Data Organization and existing B2B workspace; corporate operational lookup still requires directory handoff |
| Agreement projection | Reuse B2bAgencyAgreementV1; approval, issuer, conditions and versioned amendment need an additive version |
| Credit policy | Reuse B2bAgencyCreditPolicyV1 for reads; persistent request/decision records and distinct approval grants are missing |
| Financial projection | Existing FinancePartyExposurePortV1 only; deposits, remaining credit, debt, payment and settlement need Finance's producer |
| Agreed-rate query/result | Existing B2bAgencyAgreedRateV1 for records; Sales applicability query requires validated service references and ambiguity rules |
| Passenger assignment | Customer identity remains with Customers; B2B assignment storage and scoped lookup contract are missing |
| Travel request/status event | Persistent request, immutable version, transactional outbox and Sales acknowledgement are missing |
| Sales/reservation projection | Await owner-published organization/branch-scoped projections; no direct table reads or copied execution state |

No duplicate public types or root exports are introduced while the shared
contract is locked. Missing profile fields, extended contacts, approval/history,
requests, documents, audit views, notifications, financial KPIs and export are
not represented as working features. The related-record section explicitly
states that those records are not connected.

## Verification record

- Frozen install: passed without a lockfile change.
- Prisma client generation and Contracts/Database/Config builds: passed; only
  ignored generated outputs are written.
- Full API suite: 895 passed, 70 unrelated opt-in PostgreSQL tests skipped.
  Includes all 4 new real PostgreSQL transaction tests, complete existing
  migration chain from empty PostgreSQL and two successful seed executions.
- Targeted Organizations: 14 passed; separate isolated HR retry: 42 passed.
- Full Web: 742 passed, 3 failed initially. Two HR tests timed out under concurrent
  full-suite load and passed on isolated retry. The remaining pre-existing
  Customers source assertion compares LF text against this CRLF checkout;
  neither the Customer implementation nor test was changed.
- API/Web typecheck and lint: passed. API and final Web production builds passed;
  Web generates 36 routes, including the existing `/organizations` route.
- Scope scan: 16 changed/new files, all in the reserved scope. No changes to
  Prisma/schema/migrations/seed, root contracts, dependencies, central docs or
  any file changed by Sales PR #90 or Reservations PR #112. `git diff --check`
  and targeted Secret/PII scan passed. Original checkout remains clean and the
  latest fetched develop remains `30d67ec`.
- Authenticated browser interaction, visual responsive QA, Lighthouse and
  production SLO measurements are not performed or claimed. New IAM grants,
  production data or service restarts are not part of this slice.

## Corporate HTML reference follow-up — 2026-09-08

Owner requested implementation of `b2b-agencies-corporate.html` from the attached
visualization. Same isolated PC-B branch and reservation; original checkout and
task worktree were clean at the start. Fetched origin and rechecked open PRs;
Sales #90, Reservations #112 and Master Data #105 remain outside this scope.
The HTML is a visual reference, not authority for scripts, credentials or sample
business records. Central/shared locks remain unchanged.

- Transferred the reference palette, typography, card geometry, gradients,
  directory columns, organization banner and seven colored 360-degree cards into
  scoped CSS and React components on the existing `/organizations` route.
- Replaced the profile dialog with an in-page organization workspace. All seven
  groups and their tabs are navigable. Existing permissioned contact forms,
  branch address, agreement, credit read and rate operations consume their
  existing public APIs. Edit results refresh the selected identity from the
  mutation response; cancel retains the selected profile.
- Kept real server search, role/status filtering, paging, request errors and
  mobile directory cards. Focus moves to the profile heading on section changes;
  controls retain keyboard focus rings and reduced-motion behavior.
- Explicit differences from the prototype: global shell remains the shared
  Rubi shell; the existing identity form handles new cooperation instead of the
  prototype's simulated approval wizard. Unsupported account-manager filters,
  combined-role aggregates, global KPIs, financial values, history, access,
  signatories, documents and reports have unavailable states. No sample people,
  balances, fake approvals or success notifications were imported. Branch tabs
  expose the existing address capability; organizational branch authorization
  still requires the B-phase contract. Rate, discount and commission tabs use
  the existing rate editor. This is not a claim that the blocked module or an
  exact pixel match has been completed.
- Web typecheck, lint, 14 targeted tests and production build (36 routes) passed.
  Browser visual QA could not run: the in-app browser timed out attaching its
  webview. A temporary, isolated component harness used synthetic UI-only data
  and no API/DB access; it is not shipped. No authenticated browser, responsive
  screenshot comparison or Lighthouse result is claimed.

## Popup / XLSX / synthetic data follow-up — ready for review 2026-09-08

Owner requests labeled test records, real Excel import/export and the four-step
cooperation form from Screenshot (523), presented in a modal. PC-B reserves the
same organization Web scope, B2B-owned helper/tests and this report. Existing
Master Data public HTTP operations own identity, contact and export writes;
imports create new identities only, with preview and per-row outcomes. No
schema, central UI, shared contracts, Master Data implementation or HR checkout
is edited. Synthetic records are explicitly labeled and created additively in
the identified local environment; no existing record is refreshed or removed.

This follow-up supersedes the earlier creation-form and Excel limitations above.
The branch started clean; `git fetch --prune origin` completed, with
`origin/develop` observed at `0261b91`. The independent branch base remains
`30d67ec`; no rebase or merge was performed. Central-file reservation/status
updates remain in this report under the owner's existing lock exception.

- **Modal:** cooperation creation now uses a four-step RTL Radix dialog matching
  the supplied structure: identity/role, people/access, contract/credit and
  documents/review. Desktop shows the step rail on the right; narrow viewports
  use a horizontally scrollable rail and a single-column form. Focus, Escape,
  validation, partial-save feedback and disabled controls during writes are
  preserved. Search selects an existing identity across all roles; adding a role
  retains other roles and uses the current optimistic version. New system codes
  are generated by Master Data, never supplied by the client.
- **Connected writes:** public Master Data operations save the identity, optional
  representative and complete country/city/address. An agency can optionally
  prepare a DRAFT agreement in an authorized branch. B2B permits that draft while
  the profile is UNDER_REVIEW; rates still require ACTIVE, and SUSPENDED/ENDED
  profiles remain blocked. Credit approval, agreement activation, corporate
  operational agreements, portal access, signatories and document approval still
  require the blocked B-phase contracts and are explicitly unavailable.
- **Excel:** directory export requests a genuine XLSX from the existing public
  Master Data export API with the current role/search/status/sort filters. Import
  accepts a one-sheet XLSX up to 5 MB / 200 organizations, validates fields and
  previews each row against existing identities before creating anything. A
  downloadable template includes eight labeled synthetic rows. Existing records
  are skipped without updates; supplied system codes must resolve to the same
  name, and new codes must be blank. Returned generated codes appear in results.
  Corrupt ZIP/XML, formulas, macros, external relationships, duplicate columns
  and excessive expansion are rejected. No dependency or contract is added.
- **Write semantics:** imports use the existing permissioned/audited individual
  Master Data create endpoint; no new privileged bulk endpoint exists. The UI
  additionally requires read/create/import grants, and export retains its owner
  endpoint's authorization. Imports and multi-step saves are not a cross-module
  atomic transaction or a durable import job. An uncertain failure stops further
  writes and is not retried automatically. Identity rechecking prevents normal
  repeat imports; global concurrency-safe deduplication/idempotency still belongs
  to the Master Data producer and is not claimed by this client.
- **Actual local demo data:** eight synthetic organizations were inserted through
  MasterDataService in `rubi_hr_current_20260908`: four agencies, three corporate
  customers and one dual-role identity. No contacts, financial balances, IAM
  users/grants, approvals or existing record changes were created. A subsequent
  read-only preview returned `reused: 8, pending: 0`. The guarded local helper
  accepts only the confirmed development database on localhost:55432, attributes
  its writes to an offline fixture actor, and creates no IAM session or account.
  A private PostgreSQL custom-format backup was taken before insertion at
  `C:/Users/admin/AppData/Local/Rubi/b2b-agencies-runtime/backups/b2b-before-demo-20260908.dump`
  (702138 bytes); it is outside Git and must not be shared as a code artifact.

Final follow-up checks:

- Organizations: **28 passed / 6 files**. All B2B: **27 passed, 4 optional
  PostgreSQL tests skipped**; the previously recorded PostgreSQL run remains the
  baseline. Added coverage exercises code generation, mismatched identities,
  duplicate prevention, uncertain-write stopping, preserved roles/versions,
  permission checks before writes, partial saves, valid dates and draft gates.
- Web and API lint/typecheck/build passed. Final Web build generates 36 routes.
  A synthetic workbook generated by the actual Master Data XLSX builder decoded
  successfully through the new compressed-ZIP reader. `git diff --check` passed.
- Actual React components were visually checked in a temporary browser harness
  at desktop size and 390x844. Four-step navigation, incomplete-contract errors,
  review/save, XLSX selection, eight-row preview and eight-row import result were
  exercised against mock public services. This is UI verification, not an
  authenticated end-to-end production test. The harness used no live API and its
  temporary server/tab were closed. No Lighthouse or measured WCAG/SLO claim.
- Scope: only the reserved organization module, B2B service/tests, local helper
  and this report changed. No schema/migration/seed/dependency, central docs/UI,
  shared contracts or another task's files changed. The existing full-suite
  Customers CRLF failure above was not part of this targeted follow-up.

Runtime handoff: the updated production build is prepared in this worktree.
Port 3100 and API 4190 are still owned by the independently running HR checkout;
these services were not replaced. Automatic approval review previously rejected
stopping/replacing port 3100 with only "blocked by policy", even after the owner's
confirmation. No alternate process-kill mechanism was attempted. The local
`start-3100.ps1` helper refuses an occupied port and can start this build when
3100 is available. Integrating the new UNDER_REVIEW draft behavior also requires
running this branch's B2B service change. No merge or deployment is claimed.

## Editing / permanent deletion follow-up — ready for review 2026-09-08

PC-B continues the same clean branch after fetching origin/develop@0261b91.
Reserve only the organization Web module and this report. The existing public
Master Data update/delete APIs already own authorization, optimistic versions,
dependency restrictions and transactional deletion/audit. Add visible record
actions and an explicit confirmation dialog; do not change Master Data, shared
contracts, migrations, permissions or other tasks' runtime. This request adds a
capability and does not authorize deleting the eight existing demo records.
Central status/reservation updates remain here under the existing owner exception.

- Organization edit and permanent-delete actions are visible on desktop rows,
  mobile cards and the profile banner. Existing representative editing remains
  available, with a separate permanent-delete action per contact. Organization
  edits retain the existing identity/version and preserve other roles when the
  role field is omitted. Writes are denied before calling the public owner API
  without their separate create/update/delete permission.
- The deletion dialog names the exact record and code, explains irreversibility
  and that deleting an organization removes its shared identity/all roles, and
  initially focuses Cancel. No deletion occurs on open, Escape or cancel. The
  explicit action calls the existing `masterDataApi.remove` with the current
  resource/id/version. Contact deletion checks organization ownership first.
  A confirmed response is required before success; errors stay in the dialog,
  with no automatic retry or status fallback. Closing after an error refreshes
  the list before another attempt. Successful deletion refreshes the directory
  or contact page and adjusts pagination when its last record was removed.
- Existing Master Data permanent deletion is transactional and audited, removes
  only owner association rows, and rejects referenced records via restrictive
  FKs. No cascade deletion of business history, new endpoint or backend change
  is introduced. The eight stored demo organizations were not deleted or edited.
- Checks: 36 organization tests passed (including 8 new mutation cases); all 92
  existing Master Data deletion tests passed. Web lint, typecheck and final
  production build passed (36 routes). Scope/diff checks passed. No schema,
  migration, API, dependency, central-file or other-checkout change.
- Browser QA used the actual workspace, profile, owner edit form and deletion
  dialog with in-memory mock public APIs. Editing advanced the expected version
  and refreshed the name; cancelling deletion preserved the record; confirming
  deletion returned the empty directory. Desktop and 390x844 actions/dialog were
  visually checked. Temporary tab/server were closed. No real database deletion
  or authenticated live-runtime test is claimed. The prior 3100 runtime handoff
  limitation remains; this follow-up prepares and publishes code only.

## Integration handoff

Fetch `codex/pc-b-agencies-organizations` and review its independent draft PR;
do not merge or rebase the Sales/Reservations branches as part of this delivery.
The central lock owners must coordinate B2B-AGENCIES-001B before the blocked
schema, permission, shared-contract or integration work begins. In particular,
review the deliberate credit and agreement approval gates before integrating
clients that previously relied on direct activation. Neither accounting
balances nor issued travel documents are created by this module.
