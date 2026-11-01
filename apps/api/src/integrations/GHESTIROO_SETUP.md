# Ghestiroo connection deployment handoff

Application changes are entirely within Integrations. No Nora migration, IAM
changes, business-data import or other-module writes are part of this connector.
The task branch starts from PC-D-Integration; do not deploy it as a replacement
for a newer whole-repository production build. Integrate this scoped change into
the approved release first, preserving later Integrations features.

Set these **private API runtime** values before using the connection form:

```dotenv
NORA_GHESTIROO_CONFIG_DIR=/var/lib/nora/integrations/ghestiroo
NORA_GHESTIROO_STORAGE_KEY=<base64-encoded-random-32-byte-key>
```

Generate the master key once with the operator's secret manager. Persist both the
key and directory across rebuilds/restarts; back them up separately. Restrict the
directory to the API service account (0700 directory / 0600 files; equivalent ACLs
on Windows). Mount it as a persistent private volume if the API is containerized.
Do not put the key in `NEXT_PUBLIC_*`, repository, UI, logs or shared settings.
The module intentionally refuses configuration until these values exist.

AES-256-GCM encrypts each branch file, using branch ID as authenticated additional
data. Writes use exclusive file creation, version checks and atomic rename. Run
one API deployment against this store, or use a filesystem with shared atomic
create/rename semantics. After a process crash a `.lock` may remain: verify no
writer is active before removing that branch's stale lock. Never delete config
files to resolve a conflict; reload and retry. Losing the master key requires
revoking site credentials and generating fresh bundles.

In Ghestiroo deploy the additive migration and visit `/admin/nora`. Enter the
**browser origin of Nora Web**, not the API origin. Copy the one-time bundle into
Integrations → connections → Ghestiroo, select explicit Nora user IDs, save and
test. Saving checks the browser Origin matches the bundle's `noraOrigin`.
Both `connections` visibility and the existing branch checks apply. Configuration
and admin launch additionally require existing registry settings management.

Public site targets require HTTPS:443 and public IPv4 DNS. The connector resolves
DNS once, rejects private/link-local/reserved ranges, pins the validated address,
retains TLS hostname verification, refuses redirects, limits replies to 1 MiB and
has a 12-second overall deadline. No browser-selected arbitrary proxy paths exist.
For disposable loopback tests only, set `NORA_GHESTIROO_ALLOW_LOCAL=true` with
`NODE_ENV=test` or `development`; production ignores that flag. The site test
fixture needs its separate `NORA_CONNECTOR_ALLOW_LOCAL=true` flag.

Preserve Host through the Web reverse proxy and allow normal POST navigation under
`/integrations/ghestiroo-launch`. Its response alone has a nonce-based script and
the exact external form destination in CSP. All other Nora pages retain their
existing `form-action 'self'` policy. Never log POST bodies on this launch path,
the connection settings path, or Ghestiroo `/admin/nora-sso`.

The API key never returns from Nora after save. No browser storage persists it.
Live capabilities testing is explicit; saving a bundle does not claim connection
success. Data reads remain in Integrations and use the site projections; site
business management opens its existing admin with a one-use 60-second grant.
No payment, booking, passenger import, central catalogue synchronization or
automatic issue workflow is claimed by this delivery.
