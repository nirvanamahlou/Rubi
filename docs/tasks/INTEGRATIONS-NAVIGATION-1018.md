# INTEGRATIONS-NAVIGATION-1018

COMPUTER_ID=PC-D. Scope: simplify navigation and clarify actual connection
readiness without removing any of the nine existing destinations. Work branch
`codex/pc-d-integrations-navigation-1018` starts at PC-D-Integration and reuses
PR909's delivered candidate as the existing source baseline. No publication or
merge authorized for this unit.

## Navigation

Four primary destinations use plain names and short purpose labels. Only the
selected destination's secondary navigation is displayed:

- Websites and brands: brands/systems and overview.
- Connection setup: connections/suppliers, events/webhooks and data mapping.
- Tracking and monitoring: sync, health/errors and logs/history.
- Settings and access: connection settings and permitted external management.

A drill-down to any existing section derives the correct primary selection.
All navigation is disabled while an editor, website registration or save is
active. Selecting a primary entry returns to its default view. The existing
brand dashboard, KPI drill-downs, forms, permissions and branch scope stay in
use. Layout wraps to two columns on small screens, with theme variables and
keyboard focus states. English translations accompany Persian text.

## Actual operational boundary

The current registry persists brand/system definitions and optional public
website/API/documentation URLs and intended method/environment. It always
reports NOT_CONFIGURED; recording a URL does not make an outbound connection.
There is no generic website connection tester, runtime credential reference,
generic event ingestion, sync worker/checkpoint, delivery monitoring or external
management/SSO wired to a registered site in this slice. Data mapping and
analytics remain unavailable until valid producers are connected.

Existing specialized procurement supplier dispatch/inbound and Customer Affairs
site-ticket paths are preserved. Their existence is not proof of configuration
or successful interoperability for any arbitrary website; the registry lists
them as NOT_VERIFIED. No external credentials or live request were used for this
assessment. Existing server ownership, permission, CAS and audit paths are
unchanged.

For the first actual website, obtain its public API and authentication/SSO
specifications, authorize server-side credentials, agree versioned data/owner
contracts and identifier mapping, implement and validate its adapter and signed
event/retry/sync semantics, then test access scope, idempotency, outages and real
owner-approved transitions. Do not label a site connected before this passes.
The connection screen now explains the three practical steps and the current
boundary directly.

## Local delivery

A bounded Web-only Docker overlay reuses the existing Rubi image and Compose.
Only navigation/workspace/readiness files and their English catalogue are copied.
API, infrastructure, volumes, registry records and other Docker projects are
preserved. Runtime workspace source was compared with PR909's candidate before
replacement. Rollback restores the previous Web image; no schema, seed,
migration or dependency change is required.

Validation: 24 Integrations Web tests passed, including destination preservation,
group selection for all nine sections and editor navigation lock. Scoped ESLint,
Prettier and production Web build (62 routes, including TypeScript) passed.
Interactive navigation verified all nine destinations, the existing four-system
registry, readiness guide, Add website dialog and disabled primary controls
while the dialog is open; cancelled without saving. Desktop1440 and the user's
mobile-width viewport rendered the expected four-column/two-column layouts.

Global offline i18n sync --check reports existing generated API/legacy catalogue
drift from unrelated partner-import translations on this source baseline. The
generator was inspected, its output compared, and only this turn's generated
output was restored; no API/public catalogue file is included in the UI change.
New UI translations are complete in the dedicated Integrations catalogue.

The first local deployment rendered the new UI but exceeded the old development
startup health deadline and automatically restored the old image. The second
attempt uses a local Compose override: same HTTP health test, 30s request timeout
and180s startup grace, with a600s deployment wait. This preserves health gating
under cold development compilation; no application/security permission changes.


The second activation completed successfully. Web is healthy on image
`rubi-integrations-local:1018-navigation` and the existing API remains healthy
on `1017-access-v2`. The local start.ps1 now references the new image and health
override. Windows free memory was 519MB of 8113MB at final verification; no
Ghestiroo container was stopped. Browser login and the new navigation were
verified again after successful activation.
