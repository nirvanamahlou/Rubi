# INTEGRATIONS-VISUAL-1015

COMPUTER_ID=PC-D. User-provided four visual references supersede the initial
catalogue-only presentation. Reuse the existing integrations.registry.v1 API,
public SystemManagement service and IAM actor/branch boundary. No parallel data
store, account model, supplier adapter, finance or reservation workflow.

## Visual and contract mapping

- Brands page: period presets/Jalali custom range, dynamic system cards, four
  business KPI drilldowns, trend placeholder, separate operations area,
  comparison, latest registry change and system-to-owner process explanation.
- Producer: IntegrationRegistryService, consumer: Integrations Web. Retain the
  reviewed v1 registry/write/adapters contracts and optimistic version checks.
- Business statistics producer is not connected. No sales, customer, reservation
  or financial tables are read. Unavailable values stay unavailable; education
  and other non-travel systems are excluded from direct travel sales by domain.
  No percentages, trend lines, zeros, currencies or operational deep links are
  invented. Future owner projections require system attribution, scope, UTC
  range, grain, Decimal/currency and permission-checked target links.
- Registry administration remains editable behind existing server permissions.
  Navigation retains all nine Integration areas and per-system settings,
  connection, sync, health and history. No connection/SSO success claims.
- Existing supplier webhook and Customer Affairs site bridge stay untouched.

## Runtime dependency repair

The previous local overlay copied only the Integrations task diff onto an older
runtime. That runtime did not export the pre-existing IAM useAccessActor hook;
authenticated rendering therefore failed despite successful API login. Package
the exact existing public access-context implementation as an explicit runtime
dependency. Do not substitute tab visibility for actor identity. Verify the
authenticated page, modal interactions, and responsive layout before delivery.
Keep the runtime database schema and application baseline unchanged; no migration
or new seed. Preserve existing volumes, environment secrets and prior image.

## Delivery policy

New branch is based on PC-D-Integration. Local Docker execution was explicitly
authorized earlier. GitHub publication and merge remain subject to the current
project policy; this work does not publish or merge automatically.

## Verified delivery

- Local commits: dfc1b9b8 restores the foundation; 9cf2e851 implements the visual
  dashboard. No GitHub publication, hosted CI or merge.
- 15 Web/model/route tests, 27 Integrations API tests and 147 shared-contract tests
  pass (189 total). Scoped Web/API lint passes. Web typecheck and production build
  pass. Formatting and whitespace checks completed for affected source.
- Runtime image rubi-integrations-local:1015-visual,
  sha256:7ccf6501cc156d672e7092c9fc605d477e5a3bfda4c2c5fe2b869646d5dcbe66.
  Verifier confirms exactly 24 scoped overlay files and unchanged schema hash
  d9bf235743f0fa10b751b356d0c651f0f098201bc62bcfb5238a945bf6076dad.
  Existing supplier and site adapters remain intact. API/Web are healthy;
  API health and login respond 200, anonymous registry access returns 401.
- Authenticated localhost browser verified four initial editable brands/systems
  via the public initialize command (registry version 1, HQ branch). Refresh
  preserves four systems. This is configuration initialization, not business
  sample data. No migration, new seed, role grant or credential change in this
  redesign. The earlier local seed and administrator setup were user-authorized.
- Four metric dialogs tested; Academy excluded from travel sales. Escape closes
  and returns focus to the originating tile. Dedicated system settings and edit
  form verified without changing the record. Persian current-month range starts
  at 1 Mehr; shared calendar opens; reversed dates disable metric reports.
- Light/dark layouts and 390x844 mobile dialog tested. Tables scroll inside the
  dialog; viewport override reset and light theme restored.
- Operational now: scoped catalogue, configurable brand/system/capability
  management, initialization, lifecycle/version protection, audited settings,
  navigable dashboard/metric details and the existing Integration section shell.
- Ready for connection: the four systems and dashboard presentation. Business
  counts, trends, operational queues, general event delivery/sync, external
  management and SSO are not live. They require external documentation/access
  and public owner-approved projections. No live external success is claimed.
- Runtime build/activation/rollback receipts remain outside Git under
  Rubi-runtime-local/integrations-visual-1015. Persistent start.ps1 points to the
  new image; infrastructure volumes and previous image are retained.

- Authenticated browser verification also passes at
  http://127.0.0.1:3100/integrations, the user's original hostname. Local dev
  origins are explicitly configured in the local image; no security policy in
  application source was weakened. Screenshot: external runtime folder,
  brands-dashboard.png. Existing administrator credentials were used, not changed.
- The first full API typecheck found stale generated Prisma declarations for
  existing Sales hotel rooms. Regenerated the isolated worktree's ignored Prisma
  client and built database declarations from its existing schema using a dummy,
  unreachable generation-only URL. No schema changes or database calls/migrations.

Final full API typecheck passes after regenerating local declarations. Database
package build also passes. Runtime baseline remains unchanged. Source edit locks
are released with this handoff; future work requires a new reservation.
