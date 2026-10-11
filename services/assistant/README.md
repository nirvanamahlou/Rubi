# Independent executive assistant service

Node 24, no package installation. This is a bounded read-only service, not an
enabled LLM or forecasting system.

```powershell
$env:ERP_API_BASE_URL = 'http://127.0.0.1:4000/api/v1'
$env:ASSISTANT_PORT = '4300'
node services/assistant/server.mjs
```

Web server: `ASSISTANT_SERVICE_URL=http://127.0.0.1:4300` (server-only).
The ERP access cookie must reach the Web origin as well as the ERP API under
the approved same-site deployment. The proxy forwards only that cookie, never
refresh tokens or all browser headers. Cross-site SSO/token exchange needs a
separate deployment design; do not loosen cookie or CORS policy to work around it.
The executable binds loopback. Before remote deployment, approve HTTPS private
ingress/network allowlists and a retained access-controlled audit sink. Do not
replace any existing ERP runtime merely to test this service.

`GET /v1/executive/snapshot` accepts only `nora_access`. IAM is revalidated before
each tool and before response release. All authenticated ERP users may open the
shared assistant and request their own SELF snapshot (owner authorization,
2026-10-11). No executive screen grant or bulk role mutation is required.
Source ERP APIs still enforce their own permissions; a denied source fails closed.
This does not enable corporate reporting, executive data or write permissions.

Only personal calendar/notes/assigned procurement reads are allowed. No cache,
model, DB, browsing, arbitrary query or mutation endpoints. Source status/time/
coverage are separate. Upstream caps make this a bounded personal queue, not a
complete corporate KPI. At most 30 results, no note bodies, no completed events
or completed note checklists. Overdue/upcoming/assigned reasons are deterministic.

Errors: 401 unauthenticated, 403 missing/revoked grant, 404 unknown path/query,
405 write attempt, 429 concurrency/rate cap, 502 IAM/source invalid or unavailable.
Tool-source failures return an explicit partial snapshot. No retry loops.
Audit includes actor/correlation/tool outcome/time, never cookies or content.
Rate limits are process-local (8 concurrent requests, 60/IP/minute and
12/user/minute); the deployed ingress must enforce shared limits across replicas.
The circuit is bounded by per-read 2.5s and whole-request 10s deadlines; no
circuit-breaker state or production load/availability guarantee is claimed.

| Tool        | Fixed ERP GET route                 | Input and output scope                                                                                                   |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| calendar    | `/workbench/calendar`               | Session actor only; at most 1,000 personal events; completed/cancelled excluded. Ignores extra customer-affairs payload. |
| notes       | `/workbench/notes`                  | Session actor only; at most 500 notes; scheduled reminders only, completed checklists excluded; bodies omitted.          |
| procurement | `/workbench/procurement-follow-ups` | Session actor's assigned follow-ups; at most 100; no user/branch selector.                                               |

All tools require an active ERP session and explicit executive permission in
addition to the source API's authorization. No side effects. The 7-day horizon
includes overdue entries; a cap is disclosed as incomplete coverage. Source
timestamps describe observation time, not guaranteed event freshness. Output is
version 1, `scope: SELF`, source status/time, at most 30 deduplicated follow-ups,
a truncation flag and disabled future capabilities. UI validates this envelope
in `apps/web/src/modules/assistant/model.ts`. Business metrics must use separately
approved company-scoped contracts and never reinterpret this personal envelope.

```powershell
node --test services/assistant/server.test.mjs
node --check services/assistant/server.mjs
```

All six reference panels and follow-up gates: `docs/tasks/EXECUTIVE-ASSISTANT-1011.md`.
