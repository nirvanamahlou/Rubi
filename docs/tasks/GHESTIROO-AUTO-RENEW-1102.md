# GHESTIROO-AUTO-RENEW-1102 — PC-D

Owner authorizes automatic secure renewal, limited to Nora Integrations and the
separate Ghestiroo repository. Base Nora develop061f265a8; site developa1280c7.
Reserve ghestiroo service/store/client and focused tests, its existing Web
connection status/API type, bounded translations and own coordination notes.
No central module, dependency, IAM, migration or other-module source changes.

Producer/consumer contract: optional POST under ghestiroo.nora.v1 /renew with a
client-generated nextApiKey. Require an active unexpired server credential and
fresh connection lock/recheck; replace only its hash and extend90 days. New-key
replays with the same candidate return the existing expiry without extending it.
Origin/staff/scopes/connection identity are retained; old credentials die at once.
Deploy the site producer first. Existing bundles remain valid without reissue.

Nora persists the pending key before network I/O, retries lost acknowledgements
with that same candidate, validates bound identity/scope/expiry, then commits the
new key encrypted. Immutable complete version files use atomic no-overwrite hard
links for CAS: no crash-stale lock can stall renewal. Keep existing legacy files
readable. An hourly module-owned sweep renews at enrollment and within14 days of
expiry; operations also recover pending/due renewal. Bounded retries expose only
safe status. No key or private bundle returns to UI/logs. Revoked/expired keys do
not resurrect; an outage covering the whole credential lifetime requires owner
reconnection. Persistent encryption key/directory remain required.

Focused validation:14 Nora storage/renewal/boundary tests passed; all42 Web
Integrations tests passed;3 translation coverage checks passed on an isolated
rerun after local resource contention. All14 site tests passed on a disposable
PostgreSQL database, including competing rotations and SSO/revoke concurrency.
The real loopback Python/Node contract also passed key replacement, old-key
rejection, idempotent acknowledgement and the current Strict-cookie SSO response.
Scoped API/Web lint passed. Broader types/build and required CI are publication
gates. No production key was rotated by those local tests.

## Production acceptance, 2026-11-02

Ghestiroo PR131 merged into developc5ba6ffd; producerdf0a2a0f61d7 deployed as a
bounded admin-image overlay. Its automatic PR workflow was cancelled before any
test/check step started; no global CI policy changed. Site environment, mounts,
other containers and Strict-cookie SSO were preserved. No migration was needed.

Nora coded67f717bf318 passed all four push CI jobs, including full production
build, quality, test suite and PostgreSQL gate, before PR1273 was opened. The
actual current production API/Web images were overlaid and built independently,
preserving1010 other API source files and1816 other Web source files. The Worker
image, existing environments/mounts and other containers were retained; Worker
was recreated with the API network. No other-module source or IAM change.

Without any browser request or replacement bundle, the startup sweep rotated the
existing saved connection at 2026-11-02T06:03:49Z. A private before/after probe
proved the key changed, old-key capabilities were rejected401, the new key was
accepted, pending rotation cleared, and connection identity/origins/allowed users
and scopes were unchanged. Repeated checks did not rotate again. The resulting
expiry is2027-01-31T06:03:49Z; subsequent renewal is due within14 days of expiry.

The real authenticated Nora card displays automatic-renewal status/date. All four
resource reads and secure SSO to the actual site dashboard passed after rotation.
Worker authentication, AMI connection and recording timer passed. Three encrypted
config versions have0600 permissions; encrypted recovery and deployment receipts
are retained privately under /opt/rubi/ghestiroo-auto-renew-1102. No key, bundle,
customer record or private environment value is committed. Final PR checks remain
the merge gate for these documentation-only closeout updates; runtime code is
unchanged from the tested/deployed source. Source reservations are released.
