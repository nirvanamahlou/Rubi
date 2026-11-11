# Nora Germany egress — 2026-11-11

Production route: authenticated ERP Web BFF → ERP Nora service → SSH forward →
Germany loopback CONNECT relay → Groq HTTPS. TLS terminates at Groq, not at the
Germany relay. Only user message/session history reaches the model; native ERP
tools and their results stay in ERP. Existing IAM cookies and permissions apply.

## Installed runtime

- Germany `ai-server` (`82.115.17.210`): `nora-groq-egress.service`, Python relay
  `/opt/nora-egress/groq-connect.py`, loopback port4310. Dedicated `nora-tunnel`
  account/key permits forwarding only to `127.0.0.1:4310`, with no shell.
- ERP `erp-server`: `nora-egress-tunnel.service`, pinned Germany host key and
  dedicated private identity in `/opt/rubi/private/nora-egress/`. The forward
  listens on Docker bridge gateway `172.18.0.1:4310`, not a public interface.
- ERP `rubi-nora-assistant`: existing API image
  `rubi-production:develop-f2a004229-1111-api`, source archived from merged
  commit `df1c7ac1c`, mounted at `/nora-source`; entrypoint `runtime.mjs`.
  No database credentials. User1000, read-only filesystem, dropped capabilities,
  no-new-privileges, 256MB RAM, 0.5CPU, 64PIDs, temporary /tmp16MB.
  Host port4300 is published only on `127.0.0.1`.
- Existing TLS Nginx server uses `nginx-locations.conf` locations. Nora validates
  native IAM sessions, including on the externally routed upstream endpoints.
- Web runtime `ASSISTANT_SERVICE_URL=https://avinaofficial.ir`.
- Private `assistant.env` enables Groq/messages-only with
  `NODE_USE_ENV_PROXY=1`, `HTTPS_PROXY=http://172.18.0.1:4310`,
  `NO_PROXY=localhost,127.0.0.1,avinaofficial.ir` and
  `ERP_API_BASE_URL=https://avinaofficial.ir/api/v1`.
  The Groq secret is stored only in this ERP private file; never commit it.

## Root causes and verification

Direct Iran egress did not provide the required model connectivity. Germany
egress now returns a real Groq reply with the configured key. Web had no Nora
URL; its transport rejects non-loopback HTTP. Finally, the Web POST Origin guard
compared the public Origin to Next's private listen origin and rejected valid
browser messages with403 INVALID_MESSAGE. The TLS edge now rejects any missing
or foreign public Origin before translating the validated origin to Next's
private origin. It does not disable CSRF, cookies, or certificate validation.

Verified on production with the signed-in user's actual browser: Persian
introduction returned; follow-up correctly reproduced the first message.
One ambiguous follow-up produced an unhelpful response before the explicit
first-message query succeeded; model responses are not a guarantee of accuracy.
Native assistant tests:68 passed,0 failed. Relay deny test passed for foreign
host, wrong port and plain HTTP; no upstream socket was opened. Public missing
and foreign Origin POSTs return403; unauthenticated upstream reads return401;
Nora health and public login return200.

## Deployment and maintenance

Preserve these Nginx locations and the Web runtime URL in future ERP deployments.
The independent Nora container uses restart-unless-stopped; both systemd services
are enabled. It is deliberately outside the core Compose project: do not remove
it as an orphan. A normal core deployment does not update its pinned source.
Update its source/image explicitly under the deployment lease and run native
tests plus authenticated browser verification before switching.

Any bridge-subnet change requires updating the SSH listen address and HTTPS_PROXY.
Any Next host/port change requires updating the narrowly scoped Origin adaptation.
A future BFF change should accept an explicitly configured canonical public
origin directly, allowing removal of that normalization at the edge.

Use `/opt/rubi/avina-deploy.lock` (flock) for all ERP mutations. Before changing
configuration, keep root-only backups and validate `docker compose config --quiet`
and `nginx -t`. Existing core images, database and worker configuration were not
changed; only Web's assistant URL was added. The Nora startup initially failed
because the API image's parent `/workspace/services` was root-only; the dedicated
`/nora-source` mount fixed this without changing image permissions or running Nora
as root.

## Rollback

Root-only originals are `/opt/rubi/private/nora-egress/web-compose-before.yaml`
and `nginx-before.conf`. Under the shared lease, restore only the assistant URL
and added Nginx locations (do not overwrite later peer changes); validate configs,
recreate Web only and reload Nginx. Stop/remove only the owned Nora container and
disable the two Nora systemd units if retiring the route. Do not delete shared
deployment locks, core services, backups or the database. Keep key/env files private.

## Checks

`python3 -m unittest discover -s /opt/nora-egress -p test_groq_connect.py`

`docker exec rubi-nora-assistant sh -c 'node --test /nora-source/*.test.mjs'`

Inspect only service activity/status and sanitized outcomes; never dump the
assistant environment, headers, cookies, request bodies or keys into shared logs.
