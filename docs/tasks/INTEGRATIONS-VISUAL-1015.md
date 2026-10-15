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
