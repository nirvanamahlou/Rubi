# NIYAYESH-CONNECTOR-1025

Producer: Niyayesh /api/v1/integration v1 on erp_panel.
Consumer: Nora Integrations live read-only view; no domain writes or operational copies.
Transport: signed personal actor binding (org/system/environment/client), 10s timeout,
2MB maximum JSON response, no redirects, no automatic retries. Exact-origin server
configuration; browser cannot supply destinations or signing keys. Each local Nora
actor/branch has explicit external subject and resource grants. Site repeats its own
permissions. Live paging uses external after_id; detail uses externalId/version.
No durable checkpoint or synthetic success is claimed. Existing v1 registry unchanged.

Local validation uses a separate Niyayesh database, never a site production backup.
Local HTTP is allowed only with an explicit development flag and a fixed loopback
or host.docker.internal destination. Production uses HTTPS443 with public DNS and
pinned DNS resolution. Secrets stay outside the repository and browser.

SSO requires an actual shared OIDC issuer and HTTPS callback. Until then the site
panel opens its own password login; no passwords or ERP sessions are forwarded.

## Local execution verified

Nora retains the existing rubi Compose runtime and database, Web3100/API4192.
Candidate image rubi-niyayesh-local:1025 extends the previous local image, replacing
only the integration runtime modules, compatible Contracts build and integration UI;
other modules retain their previous runtime versions. No Nora migration was applied.
The API's final image is rubi-niyayesh-local:1025-audited; successful resource reads
are recorded through IAM's existing public recordSelfActivity boundary with actor,
time, branch/resource/page identifiers only, never the returned payload or keys.
Compose override and private connection file live outside Git in
`C:/Users/Ehsan/Documents/ChatGPT/Rubi-runtime-local/niyayesh-connector-1025/`.

Niyayesh uses erp_panel, an independent local PostgreSQL database/volume, API18025
and site13025. The initial catalogue comes from the site's own baseline migrations;
it is **not production site data**. No production backup was imported. Customer,
order and support resources are genuinely empty. All16 resource endpoints responded
successfully both directly and through Nora with the mapped user's signed requests.
The local ehsan account was mapped explicitly; its existing native Nora manual
access selection was preserved while adding Integrations subsection screen grants
through the public IAM manual-access endpoint (with revision/audit).

Local checks: API build, Web TypeScript and scoped lint passed.11 connector/registry
tests passed. Linux Web production build passed. Actual Docker-to-host HMAC request
and every resource response were checked. The site-side ticket projection additionally
needed eager airline loading and read-only normalization of nullable legacy galleries;
three focused producer regressions passed on that change.

## Configuration and limits

Set `NIYAYESH_CONNECTION_FILE` on the API to a private read-only JSON file matching
`niyayesh-connection.example.json`. Never expose this file via the Web/public folder,
registry JSON, response or logs. Preserve a separate subject per person and explicit
user/branch/resource bindings; a new person is not automatically mapped to an owner.
The site repeats current native/read/document permission checks. Removing a binding
or resource takes effect on the next request. HTTP local mode is rejected in production.
Public mode supports only public IPv4 over HTTPS443 and rejects redirects/private DNS.

Open Integrations → راه‌اندازی اتصال → اتصال‌ها و تأمین‌کنندگان → داده‌های نیایش سیر.
Choose a resource, expand a record, page and refresh. The status is based on a real
capabilities response. Financial KPIs are deliberately not inferred from catalogue
counts or current-state snapshots. No write/sync/SSO success is implied by live reads.

Still separate work: shared real IdP, authenticated domain write commands approved
by owning modules, durable sync/checkpoints/webhook ingestion and KPI producer contracts.
The connection does not recreate customer, reservation or finance tables in Integrations.
