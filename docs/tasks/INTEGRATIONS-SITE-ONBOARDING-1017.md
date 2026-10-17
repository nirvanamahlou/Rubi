# INTEGRATIONS-SITE-ONBOARDING-1017

PC-D; task branch from PC-D-Integration. The accepted dashboard remains intact.
New-site registration becomes a direct action, without opening catalogue
administration, entering a Latin code, or initializing unrelated presets first.

The same form creates a new site and completes an existing site's setup: choose
or create a brand, enter identity/site address, then optionally describe the
connection and intended capabilities. Generate immutable UUID-based internal
codes; persist everything through the existing branch-scoped versioned registry.

Producer IntegrationRegistryService and Web consumer ship an additive optional
setup object in integrations.registry.v1. It contains only public HTTPS website,
API/documentation URLs, environment and intended protocol/authentication method.
No credential field, server request, connection test or live-success claim.
Reject URL credentials, queries/fragments, IP/local hosts and unknown fields;
deduplicate normalized website URLs. Actual adapters must separately validate
DNS/IP/redirects at request time. This metadata alone never enables a connection.

Legacy records remain valid. Old clients omitting setup preserve the saved
metadata; an explicit replacement object permits deliberate field clearing.
Keep native IAM, screen/module/field checks, exact assigned branch, advisory/CAS
and audited public SystemManagement writes. Deploy producer before consumer.
Once setup metadata is saved, rollback must retain this producer (older strict
validators do not understand the additive field); rolling back only the Web is
safe. Health-failure rollback before writes may restore the previous image.
No migration, dependency, IAM or other domain changes. Root/public registry
exports and bounded translation registrations are reserved only for this slice.

PC-D-Integration currently predates PR889. Reuse only the already reviewed
Integrations foundation/dashboard source as a prerequisite, excluding unrelated
develop changes. No GitHub publication or merge is authorized in this follow-up.

## Local validation and delivery

- Direct Add website action in the page header and first-site empty state.
  Two short steps use shared dialogs/search selects; brands can be created
  inline, technical codes are generated, and connection details can wait.
- Existing system settings expose the same setup form, prefilled and retaining
  identity/lifecycle. General catalogue edits and older clients preserve setup.
- Server tests cover URL credentials/local hosts/queries/fragments, normalized
  duplicates including legacy omission, unknown credential fields, permission,
  exact branch isolation, stale versions and retention on owner failure.
- Web tests cover first registration without presets, additional sites under
  one brand, stable retry IDs and updates without duplicating a system.
- 210 local tests pass (18 Web,45 API,147 contracts). Contracts build,
  Web and API typechecks/builds, scoped lint, formatting,
  offline i18n sync and the 280-label Integrations inventory are verified locally.
  No schema change: migration/database conversion tests are not applicable.
  Storage/CAS failure tests use an owner fixture; they are not a new database
  integration test or proof of webhook/sync behavior outside this slice.
- Browser checks: required inline brand validation, optional connection step,
  back/forward retention, cancellation, prefilled Academy setup, actual server
  rejection of a loopback HTTPS URL, successful save and refreshed audit version.
  The four real catalogue records remain; no sample site/brand/URL was saved.
  Academy remains EDUCATION and travel sales remain not applicable. Its setup
  now records only sandbox/undecided intent, with no URL or credential.
- Responsive 390×844 and default desktop, light and dark themes were inspected;
  dialog contents scroll vertically without horizontal overflow. Theme and
  viewport were restored after testing.

Local Docker project rubi uses
`rubi-integrations-local:1017-site-onboarding-v2` on Web3100/API4192.
It layers nine scoped production sources and two bounded API translations onto
`rubi-integrations-local:1015-visual`, then a one-file spacing refinement.
Only two API files and contracts were compiled; other modules and the existing
IAM actor hook remain from the prior image. Runtime schema hash stays
`d9bf235743f0fa10b751b356d0c651f0f098201bc62bcfb5238a945bf6076dad`.
No migration, seed, infrastructure, volume or credential change. Persistent
launcher and safe local source receipts are outside Git in
`C:/Users/Ehsan/Documents/ChatGPT/Rubi-runtime-local/integrations-site-onboarding-1017`.
After the setup write, retain this API producer during rollback. The immediate
previous 1017 image is compatible; the old 1015 API is not.

Operational: local catalogue registration, setup metadata editing, access checks,
version control and native audited storage. Ready for connection: every external
website. Actual adapters, network health, sync, credentials and SSO still depend
on genuine provider documentation/access and owner-module contracts. No external
connectivity, KPI, booking or payment success is fabricated. No new push, hosted
CI, PR, merge or production deployment was performed.
