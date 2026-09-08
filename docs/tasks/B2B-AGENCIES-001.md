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
`apps/api/src/b2b/**` and this task report. Existing APIs and identities are reused.
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

## PC-A handoff

Fetch `codex/pc-b-agencies-organizations` and review its independent draft PR;
do not merge or rebase the Sales/Reservations branches as part of this delivery.
The central lock owners must coordinate B2B-AGENCIES-001B before the blocked
schema, permission, shared-contract or integration work begins. In particular,
review the deliberate credit and agreement approval gates before integrating
clients that previously relied on direct activation. Neither accounting
balances nor issued travel documents are created by this module.
