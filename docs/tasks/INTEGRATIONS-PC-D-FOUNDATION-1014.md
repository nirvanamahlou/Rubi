# INTEGRATIONS-PC-D-FOUNDATION-1014

COMPUTER_ID=PC-D. Initial base: `origin/develop@86c87667` (2026-10-14).
Review candidate rebased onto `origin/develop@3465556f`; concurrent PC-A records
were retained in both assignment and status ledgers.
Branch: `codex/pc-d-integrations-foundation-1014`.

## Authorization and first delivery

The product owner delegates Full-Stack Integrations execution to PC-D. Existing
IAM, Customers, Sales, Reservations, Finance, Master Data, Settings and Reporting
ownership remains unchanged. The latest instruction requests the initial
structure first and supplies external links later. The separate brands/systems
plan was not supplied; its additional acceptance is deferred until available.

This unit replaces the existing `/integrations` sample workspace with the nine
requested sections and a branch-scoped configurable catalogue of brands, systems
and declared capabilities. It does not activate an external connection, issue a
travel document, confirm payment, enable SSO or replace a runtime/database.

## Existing implementation and reuse

- Modular monolith: Nest API, Next Web, standalone Worker, versioned contracts,
  Prisma/PostgreSQL; Node24/pnpm11.19.0. Primary checkout is 57 commits behind the
  fetched base and remains untouched; execution uses an isolated managed worktree.
- `apps/api/src/integrations` already handles signed Procurement supplier messages
  and dispatch through `ProcurementPublicService`. Preserve these routes, inbox
  identity and consumer contracts. Existing HMAC/dedupe is not proof of a live
  supplier connection or completion of the general webhook security requirements.
- Customer Affairs owns the existing website ticket/status bridge for the two
  documented sites. Preserve that bridge and its origins; do not create another
  website ticket store or infer that the sites are live.
- `SystemManagementService` publishes versioned configuration writes with an
  advisory transaction lock, immutable revisions and audit. Reuse its public
  setting contract for this **configuration catalogue**, under
  `integrations / registry / BRANCH:<authorized branch>`.
- IAM owns access/session/assigned branches. Legal Entity is issuer identity and
  never substitutes for branch authorization or brand identity.
- Worker currently exposes health infrastructure; general durable webhook/sync
  processing is a later work unit, not an installed business worker.

## Configuration boundary

This first catalogue is configuration, not the final relational operational
integration registry. Brand/system/capability IDs are stable catalogue keys;
referential integrity is validated inside one atomic versioned configuration.
No Customer, Supplier, Legal Entity, payment, reservation or other owner IDs are
stored as unvalidated relations. Operational connections, external mappings,
delivery/inbox/sync records require their own future additive migration with
real foreign keys and exclusive schema/Migration reservation.

Four optional initial presets are جهان باستان، نیایش سیر، قسطی روو and جهان آکادمی.
GET never initializes data. Only an authorized explicit initialization action
persists the presets; uninitialized counts are unavailable, not invented zero.
Names, additional brands/systems and declared capabilities are editable. One
brand may have multiple systems. Education systems do not contribute to direct
travel-sale KPIs. Declared capabilities are planning metadata, not verified
adapter support. External URL, credentials and arbitrary payload fields are not
accepted in this delivery.

## Producer/consumer and compatibility

| Producer | Consumer | Contract / rule |
| --- | --- | --- |
| Integrations API / PC-D | Integrations Web / PC-D | additive `integrations.registry.v1`, strict bounded catalogue schema |
| System Management | Integrations API | existing `system.setting.v1`, exact BRANCH scope, versioned audited write |
| IAM | Integrations API / Web | existing screen access and branch scope; writes also require `system.settings.manage` and existing setting/module controls |
| Procurement | existing supplier adapter | existing inbound/outbox contracts unchanged |
| Customer Affairs | existing website servers | existing website ticket bridge unchanged; owner-managed activation |
| Reservations / Finance / Reporting | future adapters / KPI readers | proposed only; no private table access or invented producer |

Read authorization uses the existing `integrations.home` decision. No grants,
users, roles or IAM policies are added. Branch selection is checked on every
server operation, including administrators. The configuration lifecycle supports
disable/archive with retained identities; removing existing records is rejected.
Optimistic conflicts and audit failures retain the previous valid revision.

## Next slices

A: this configuration/navigation foundation; later operational registry storage,
granular connection/capability permissions and secret-reference provisioning.
B: extend brands/system management using the supplied plan and real owner KPI
contracts. Links arrive in a separate change with URL policy and approved scope.
C: authenticated source identity, versioned envelope (eventId/eventType/
schemaVersion/sourceSystem/externalId/occurredAt/receivedAt/correlationId), durable
inbox/outbox, replay/concurrency guards, bounded retry/DLQ and sync checkpoints.
D: actual documented provider adapters through Reservations public intent/result.
E: real Reporting projections, currency-safe KPI/drill-down, trend/comparison and
operational monitoring; unavailable, not-applicable and measured zero stay distinct.
F: verified external management/SSO with site cooperation; no password storage,
shared RUBI session, token URLs or assumed iframe compatibility.

## Reserved files and exclusions

Reserve new `packages/contracts/src/integrations/**`, one additive barrel export,
new API registry controller/service/validation/tests inside existing Integrations,
its module wiring, new `apps/web/src/modules/integrations/**`, existing
`apps/web/src/app/(crm)/integrations/page.tsx`, a new scoped English catalogue and
its additive translator registration/derived sync outputs if required, own task,
WORK_ASSIGNMENTS/PROJECT_STATUS entries, bounded delegation/decision paragraphs.
No schema/Migration, dependency/lockfile, existing supplier implementation,
shared navigation/IAM policy or operational database/runtime is reserved.

## Verification and handoff

Local verification: 38 API permission/HTTP/schema/branch/CAS/archive/security and
existing supplier/System Management tests, 11 Web/model/route/localization tests
and 147 existing shared-contract tests pass. Scoped API/Web lint, Contracts lint,
API/Web typechecks and production builds (62 Web routes) pass. Changed-file
formatting and offline localization synchronization pass. Source compilation uses
an isolated worktree and generated Prisma client; no operational DB is accessed.

Synthetic interactive acceptance uses the actual Web components and compiled
registry service with an in-memory owner adapter, on loopback4337. It verifies
explicit preset creation, a second system under one brand, configurable capability
creation, all nine sections, Academy sales not-applicable state, dedicated system
health/configuration views, search empty state and searchable domain selection.
Styled390/768/1265 checks have no horizontal overflow; light/dark screenshots are
saved locally under ignored `tmp/integrations-preview`. This is not an authenticated
ERP/real PostgreSQL or external-site end-to-end claim. Docker's local engine is
unavailable; hosted CI remains the full repository/migration/seed gate. No new
migration exists. Production connection tests, general webhook replay/retry,
business KPI reconciliation and real SSO acceptance are intentionally pending.

Administrators still require the native `system.settings.manage` permission and
an assigned branch. Controlled manual profiles additionally require existing
module/field allow controls; any missing assignment/registration must be coordinated
with IAM, not bypassed by Integrations. Individual operational connection permissions
are part of the future registry work. GitHub actor `ehsandni` (60431015) was selected
by the user and verified with repository write permission.

No general webhook/sync, live provider, business KPI or SSO acceptance is claimed.
Merge, deploy and operational database changes require separate explicit approval,
superseding any older standing merge text in DEVELOPMENT_WORKFLOW.
