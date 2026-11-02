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
gates. No production key has been rotated by these local tests.
