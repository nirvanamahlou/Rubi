# Nora data Agent v1 — PC-C — 2026-11-14

## Delivery and coordination

Branch `codex/pc-c-nora-data-agent-v1`, base develop `5a9c72ae7`. Owner approved
model-authored SQL over curated Sales sources, iterative planning and tool use,
and transmission of authorized results to Groq. This replaces the old
messages-only policy for the explicitly enabled v3 path. Existing v1/v2 contracts
and the approved chat appearance remain compatible. No business writes exist.

PC-C owns this unit's Agent/provider/config, Sales SQL boundary, read-runtime
composition, bounded Web proxy/composer wiring, migration/dependencies and notes.
The other system must consume the published commit before entering this scope;
do not recreate or concurrently modify these files. Germany egress scripts are
consumed from PC-C `e16229cf5` / `c99920e74`, preserving attribution and relay
restrictions; the runtime and v3 Nginx extensions are additive follow-ups.

## Executable contract

`POST /v3/assistant/conversation` accepts the existing bounded message/history
shape `{version:1,message,history}`. Native server-side IAM and current Sales
access remain authoritative. Response version3 has status ANSWER/CLARIFY/REPLY,
text, a short operational plan, sources (resultId/source IDs/observation time/
truncation), limitations and requestId. It does not expose private model reasoning.

V3 additionally accepts optional `context:{selectedContractId:<UUID>}` from the
selected Sales row. This is only a lookup hint and cannot grant record access;
v2 retains its original strict shape.

The model calls `set_plan`, `catalog_search`, `catalog_describe`,
`database_query`, then `finish_answer`; it can refine SQL and request more data.
The three data tools discover the permitted schema rather than choosing one of
three hardcoded reports. Model responses and result references are untrusted.
The service validates shapes and current-result references; this is not a proof
of every natural-language factual claim. Live reference evaluation remains a gate.

Sales produces `GET /api/v1/sales/assistant-agent/catalog` and
`POST /api/v1/sales/assistant-agent/query` with `{sql,contextId}`. The context hash
covers current identity, permissions, branch scope and selected/aggregate company.
Both endpoints freshly authenticate; query rechecks after execution. The Agent
rechecks context before each provider call and at release. The cookie never goes
to Groq. A change aborts the response rather than silently changing its scope.

Sources in schema `nora_agent`: contracts, passengers, selected services,
contract/currency amounts and payment entries. Names and contract numbers are
allowed. Phones, passport/national IDs, birth dates, document files, buyer contact,
service metadata/free-text notes, bank/card data and credentials are absent.
Payment discovery/query additionally requires `sales.payments.read`.

Sales all-read retains its native all-record meaning; branch and own-read retain
their branch/owner predicates. Selected issuer company and hidden-contract
exclusion are always applied; aggregate company context requires its native grant.
Raw contracts include drafts/cancellations; the catalog defines the existing
confirmed, noncancelled creation-date Sales metric separately. IDs are not a
name directory. No undisclosed employee/city lookup or cross-module table access.

Amounts subtract DISCOUNT and add other components before any passenger join;
Decimal and bigint values remain strings. Monetary aggregation requires the currency
group and is conservatively rejected when joined to passenger/service rows;
request separate totals and counts. Payment entries do not incorporate
cross-contract receipt allocations. Do not derive outstanding balances,
accounting receivables, refund-adjusted net sales, issuance or actual delivery.

## Database isolation and limits

Additive migration `20261114120000_nora_agent_sales_views` adds five security-barrier
views and two reserved NOLOGIN roles. It changes no operational rows or existing
Prisma models. Migration administration needs role/schema-owner privileges;
do not grant these to the runtime. `nora_agent_view_owner` owns only the curated
views and has their required Sales table reads. A separate login inherits
`nora_agent_reader`, with no base-table or powerful-role grants.

The runtime's dedicated `ASSISTANT_AGENT_DATABASE_URL` is distinct from the native
IAM pool. Startup and each query reject an unsafe role. Context is parameterized,
transaction-local and never chosen by model SQL. Missing context returns no rows.
All queries are read-only transactions, then rollback before connection release.

`pgsql-ast-parser@12.0.1` parses a supported SELECT subset. Every CTE, nested
expression, join predicate, relation, function, operator and cast is checked;
SQL is regenerated from the checked AST. Unknown syntax is refused. Recursive/
write CTEs, arbitrary functions, system/private schemas, session changes, locks,
SELECT INTO, DDL/DML and multiple statements are refused. Columns are constrained
by the actual curated views and PostgreSQL resolution, including derived aliases.

Limits: 60s run, 8 model turns, 6 SQL executions including repairs, 5s statement,
200 output rows/query with explicit truncation, bounded output/transcript bytes,
2048 completion tokens/call and 40000 cumulative tokens with conservative
preflight reservation. Native v1/v2 deadlines remain unchanged. No provider retry
or cross-user result cache. Metadata-only audit; no SQL text, rows or credentials.

## Configuration and local/production handoff

Feature remains OFF unless explicitly enabled. Required Agent environment:

```dotenv
ASSISTANT_AGENT_ENABLED=true
ASSISTANT_MODEL_PROVIDER=groq
ASSISTANT_DATA_POLICY=authorized-erp-results
ASSISTANT_GROQ_EGRESS=germany-proxy
NODE_USE_ENV_PROXY=1
HTTPS_PROXY=http://127.0.0.1:4310
NO_PROXY=localhost,127.0.0.1
```

The Groq key exists only in the ignored PC-C `.env.nora-agent.local`. Do not copy
its content to Git/chat/logs. Production retains its existing private key file.
Groq HTTPS destination stays fixed. The SSH CONNECT route is mandatory: no direct
fallback, redirects, alternate provider URL or TLS bypass. Production's existing
Docker gateway proxy is `172.18.0.1:4310`; local host execution uses an authorized
loopback SSH forward. Do not expose Germany port4310 publicly. Node proxy settings
must exist at process startup, not be changed after fetch initialization.

1. Review/reserve the additive migration and take the environment's normal backup.
   Apply it via the existing migration workflow, not application startup.
2. For PC-C only, `node scripts/operations/nora-agent/provision-local.mjs --provision-local`
   creates the dedicated login and appends only its private URL to the ignored
   file. It requires already-installed views, checks loopback and does not reset
   an existing role without matching credentials. It never applies migrations.
3. Configure the ERP read producer with its private restricted SQL URL and feature
   flag. Keep native IAM's existing database connection; the Agent never gets it.
4. Start the Agent with the Germany proxy and fixed ERP URLs. The standalone
   read runtime permits only the new exact read-only POST exception.
5. Web needs `ASSISTANT_AGENT_ENABLED=true` at runtime and
   `NEXT_PUBLIC_ASSISTANT_AGENT_ENABLED=true` at build time. BFF still requires
   same-origin POST and forwards only the access cookie. The company/account/
   grant scope keys remount chat; route/selection changes cancel pending results.
6. `infrastructure/compose.assistant.yaml` is an explicit local overlay, not part
   of ordinary startup. It shares Web's network namespace so BFF/read-service
   calls remain loopback. Its proxy must reach the existing private Docker-gateway
   SSH listener; a host-loopback-only tunnel is not reachable from that namespace.
   Use compose config **--quiet** with the private env files; never dump resolved
   config containing secrets. Rebuild the app image before selecting the overlay.
7. Production additionally needs the v3 exact Nginx locations and updated pinned
   runtime under `avina-deploy.lock`; the legacy source mount cannot serve v3.
   No production deployment is authorized or performed by this source delivery.

Rollback disables the v3 flags/restores the previous app/runtime. Keep the views
and operational records; do not drop schema/roles automatically on rollback.

## Verification and remaining acceptance

Automated checks cover SQL abuse (including unsafe functions hidden in CTE join
predicates), query repair, fresh result references, live context changes, token/
step limits, fixed Groq destination and mandatory proxy. Thirty valid SQL reporting
shapes are grammar tests, **not thirty successful live-model questions**.
PostgreSQL proof uses a uniquely named temporary database/login, synthetic Sales
tables and this migration; cleanup deletes only that verified test database/login.
It covers own/branch/all/company/hidden predicates, Decimal/currency correctness,
pending versus confirmed funds, inaccessible fields, pool isolation, date-only
values, duplicate aliases and result caps. Node HTTP tests cover the v3 transport.

Run the native service tests; targeted API/Web tests, scoped lint, typechecks,
and API/Web builds. CI adds an isolated SQL proof without removing existing gates.

**Live gate:** direct PC-C Groq returned403. The owner confirmed the authorized
Germany SSH setup is on the other PC and currently inaccessible. Do not certify
live model quality or activate this v3 runtime without that path. Existing local
Web3100/API4192 and production services were not replaced; this migration has
not been applied to their operational database. The private key is stored, not
published. The next PC should execute the following synthetic business matrix
through its authorized Germany route, then authenticated browser acceptance.

| Questions / variants | Required evidence |
| --- | --- |
| Contract count: all, branch, own, company, hidden | Five scope cases agree with native Sales visibility |
| Contract number: exact, Persian digits, ambiguous name, missing, denied | Five identity cases; no guessed record |
| Sales amount: USD, IRR, discount, cancellation, draft | Five exact monetary cases with explicit definition |
| Period: Tehran midnight, Gregorian range, Persian date, ambiguous month, comparison | Five date cases; clarify unsupported/ambiguous calendar |
| People/services: passenger count, adult/child/infant, service mix, fanout, top contracts | Five grain cases; no duplicated money |
| Payments/failures: confirmed/pending, denied payments, allocations unavailable, source failure, revoked session | Five source/access cases; missing is not zero |

Acceptance requires at least27/30 supported outcomes, every monetary answer exact,
all authorization cases correct, and no sensitive-field leakage. Unsupported
questions must explicitly clarify or disclose missing sources. Passing transport
and synthetic-provider tests does not close this live-model/browser gate.

## CI integration follow-up on 2026-11-14

The owner explicitly authorizes merging all Amin-tech11 PRs after every current-head CI gate succeeds. Integrate develop7cd6ab058 and PR1693 branch47179793f in merge order1693 then1700; retain legacy contract evidence links, correction targets, version tracking and abort behavior alongside opt-in v3. Explicit role/content-only history serialization fixes a second-turn rejection caused by internal UI metadata leaking into the strict request shape. A new regression verifies bounded history, omission of local evidence/link targets and private UI flags.185 focused Web/English checks pass; existing HR translations are consumed from develop without changing HR behavior. Format only two surplus blank lines in this unit's reservation. Source merge still does not activate the Agent or apply its migration to an operational database. Mandatory Germany-route live30-case and authenticated browser acceptance remain open.
