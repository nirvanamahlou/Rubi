# Jahan Bastan / Nora integration

Contract: `jahan-bastan.nora.v1`. Owner request: 2026-11-07. COMPUTER_ID=PC-D.

| Capability | Current site | Current Nora | Change | Acceptance |
|---|---|---|---|---|
| Bundle/lifecycle | Absent | Signed ERP v1 form | Dedicated bearer contract, encrypted branch/site storage | Real producer/consumer, wrong site rejection |
| Identity | Native admin accounts | Authenticated actor and registry | Stable site, organization, personal actor and branch binding | Spoof/cross-branch/disabled account denied |
| Renewal | Absent | Ghestiroo durable rotation | Site-specific durable candidate and CAS | Lost response, restart, concurrent requests |
| Catalog | Native countries/destinations/tours/hotels/services/articles | Native editor | Reuse site services | Exact decimals, version and durable replay |
| Excel | Hotel/tour-price parsers and import services | Template/preview/apply | Native workbook adapter | Real XLSX, scoped proof, no preview writes |
| Presence/map | No live counter | Selected-site presence | Anonymous category heartbeat and real route map | TTL, no URL/query/PII |
| Reports | Native booking/customer records | Site-scoped reports | Read-only source projection | Tehran/UTC boundaries, exact currencies, missing vs zero |
| Future commerce | Site-owned commerce | Separate business modules | Versioned disabled envelope, no dispatch | Direct request/event/retry/restart denied |

Two independent task branches and two develop PRs are explicitly authorized by
the attached task. No merge or deployment. Producer starts at origin/main
4605f6d1; Nora starts at origin/develop `4735b69c3`. This task's explicit develop
destination takes precedence over the earlier local PC-D-Integration preference.

No Nora migration/dependency/business-module writes. No production test writes.
Producer must ship before consumer. Existing signed ERP v1 sites remain compatible.
Use configured PUBLIC_SITE_URL; never trust request Host for bundle destinations.
Nora origin defaults to https://avinaofficial.ir. All secret values remain outside Git.

## Configuration and connection procedure


1. Deploy the producer only after review; apply additive migration `20261107_0103`.
   It creates 9 connector-owned tables and does not alter existing business data.
2. Set PUBLIC_SITE_URL to the actual public HTTPS website origin and retain the
   existing secure admin-cookie/proxy configuration. Generate a dedicated Fernet
   NORA_CONNECTOR_ENCRYPTION_KEY once in the secret manager/deployment environment.
   Preserve it and the database across rebuild/restart; changing it without a
   controlled secret re-encryption invalidates stored HMAC material.
3. In website Settings / Connect to Nora, use the existing administrator role.
   Nora origin defaults to https://avinaofficial.ir. Generate and copy the bundle
   once. The bearer key is stored only as SHA-256; the independent HMAC key is
   encrypted. Status/list/audit never contain either credential.
4. In Nora Integrations / Connections, select Jahan Bastan. Open the default-closed
   API settings and paste the bundle, or enter its compatible manual fields.
   Save encrypted configuration, then explicitly run Test this site connection.
   Saving alone never means CONNECTED. IAM and current branch are authoritative.
5. Native services and workbook preview/apply remain outside API settings. Only
   real source resources are offered. Airlines are native service/tour fields,
   not an invented standalone airline table. Flight/train/bus/visa are native
   TravelService types. Hotel and tour-price XLSX use the site's actual parsers
   and templates; unsupported export is not advertised.
6. After the new anonymous public tracker is published, set NORA_PRESENCE_ENABLED
   true on the producer. Before activation, report NOT_CONFIGURED with null live
   counts. No past visits are manufactured. The tracker emits only a random
   anonymous browser/navigation ID and an allowlisted category.
7. Rotation starts 14 days before expiry without a browser. Nora writes the next
   key encrypted before network I/O. Lost responses/restarts reuse that candidate;
   the old key is invalid immediately after server commit. Disconnect/delete are
   durable control operations, with explicit pending state until remote confirmation.

Nora reuses NORA_SITE_CONNECTIONS_CONFIG_DIR/STORAGE_KEY or the existing persistent
Ghestiroo volume with a purpose-separated HKDF subkey. No new Nora database schema
is needed. Restart does not generate new storage master keys. Back up the secret
volume, master key and database separately under the deployment's backup policy.

SSO is explicitly DISABLED in this release; no password or Nora session is sent
to the website. Native API operations have distinct personal site accounts with
unusable local passwords. Disabling one of those site accounts denies its API
operations. Nora checks its normal IAM permissions on every user request.



## Validation and release boundary — 2026-11-07

Local acceptance uses a disposable PostgreSQL17 container/schema and an opt-in
loopback producer. No live customer, commercial provider or production write is
used. The actual TypeScript consumer imports the Python producer bundle, tests
identity, native commands, CAS/duplicate operations, presence, simultaneous key
rotation, discarded rotation reply/restart and offline durable revocation/restart.
The producer additionally proves real XLSX preview/apply, cross-actor rejection,
nonce replay, disabled personal accounts, dependent session revocation, deletion,
and all future business domains returning HTTP 501 after retry and application restart.

Existing connector API regression suites and 15 Integrations Web/i18n suites pass.
Producer full backend/frontend test suites, lint, typecheck and vulnerability
audits pass locally. Final production builds and exact-head GitHub CI are release
gates; no gate is removed or ignored. Browser QA used only the disposable fixture:
actual bundle creation/one-time close, confirmation/cancel and 390/1440 px layouts.
Nora dedicated form also has Persian/English render tests. Production connectivity
remains unverified until a separately authorized deployment and actual bundle test.

Catalog filters use bounded native name/status queries and keyset pagination.
Exchange rates preserve the exact decimal rate and IRT quote currency. Source
records remain external site-scoped data; they never create Nora business records.

Before publication, unpublished task commits were rebased onto producer origin/main `e3efa9bb` and consumer origin/develop `5c72bc48b`. Concurrent peer changes are preserved; each PR diff contains only this task. Producer develop is created at the same `e3efa9bb` main snapshot when absent.

Each remote credential is durably bound to one Nora branch/site coordinator. Reusing the same rotating credential in two scopes is rejected atomically, including concurrent imports, to prevent independent rotations from invalidating another branch. Generate one initial bundle per branch/site connection; user access still follows existing Nora IAM. No branch/user allowlist is introduced.

## Production-panel follow-up — 2026-11-08

The user requests actual configuration through the two panels. Jahan's updated
public native API now returns401 JSON without a slash redirect. After the owner
logged back into its admin panel, readiness explicitly reported an invalid/missing
public HTTPS origin, a non-deployed environment and an unavailable persistent
connector key. Its Generate bundle control is disabled. These variables require
the existing deployment environment; the site's ordinary Nora-origin field only
selects the consumer origin and cannot configure the producer server. Do not
substitute request Host, enable a public test exception, bypass readiness or turn
off the existing production security validators to make the button work.

The live Nora UI still displays the old ERP v1 fields. Read-only server inspection
confirmed no compiled dedicated Jahan consumer in the current API image; the
existing encrypted persistent connector storage is present. Refresh PR1466 against
current develop before publishing that consumer. All five merge conflicts are
shared additive notes or derived English catalogues; the canonical generator
preserves current source translations. Original connector application behavior
and the disabled commercial/SSO boundaries are unchanged. Related local API/Web
tests, typechecks, scoped lint, formatting and both production builds pass (67 Web
routes). Final-head CI remains a release gate. No production bundle, credential, grant or business write is made
by this release-preparation step. A successful real connection test is still
required after both deployment prerequisites are resolved.
