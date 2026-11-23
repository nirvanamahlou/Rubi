# Independent assistant service

Node 24 native HTTP service; no database credentials, user-content persistence,
arbitrary destination access or write tools. Opt-in Agent v3 authors curated
read-only SQL and sends it to the Sales-owned ERP execution boundary.

## Agent v3 — 2026-11-14

All Groq consumers now use one process-local credential pool through
`groqConfigurations()` at startup. `GROQ_KEY_POOL_FILE` selects a private,
read-only ordered credential file; without it `GROQ_API_KEY` remains supported.
Never construct separate pools per request or bypass the shared factory in a
custom runtime. Organization quotas are shared, not multiplied by key count.
The `organization` value is an operator quota-group alias, not a provider identity
lookup. Do not place unrelated/unverified accounts in one universal group. On a
provider organization quota error, actual organization identities additionally
link provisional aliases through private in-memory equality hashes. See the
[quota-group correction](../../docs/tasks/NORA-GROQ-QUOTA-GROUPS-1117.md).
Configuration, scoped failover, budget/auth rules and Nora-only rollback:
[NORA-GROQ-KEY-POOL-1117](../../docs/tasks/NORA-GROQ-KEY-POOL-1117.md).

Every answer-authoring model entry point shares the module-independent calculation-explanation
policy. Groq chooses text or table; derived answers require a user-facing method
summary from current evidence, with at most one bounded formatting repair.
Future tools must reuse the same policy and mark calculated evidence. See
[calculation explanation contract](../../docs/assistant/CALCULATION-EXPLANATION-CONTRACT.md).

Contract count reconciliation adds the fixed native `contract_count_breakdown`
tool. It reads authorized all-time panel/cancellation populations through the
Sales-owned `assistant-agent/count-breakdown` boundary; model SQL permissions do
not change. Model-authored explanations distinguish the default list,
active KPI, Sales cancellations and latest Reservations-only cancellations.
Custom list filters are explicitly excluded from this tool's coverage. API read
boundary, service and Web must ship together; see
[NORA-COUNT-BREAKDOWN-1116](../../docs/tasks/NORA-COUNT-BREAKDOWN-1116.md).

POST /v3/assistant/conversation adds planning, source discovery, model-authored
SQL, iterative results and cited natural-language answers. The owner explicitly
permits authorized ERP results to reach Groq in this mode. The default remains
disabled; v1/v2 remain compatible. Germany CONNECT egress is mandatory; there is
no direct fallback. Native Sales row/company/payment access is rechecked during
the run. No SQL credentials or raw IAM data reach the independent service/model.

Configuration, limits, source meanings, migration, two-PC handoff and the pending
Germany live-model acceptance gate are in
[NORA-DATA-AGENT-V1](../../docs/tasks/NORA-DATA-AGENT-V1.md).
The older rollout notes below are historical; their messages-only restriction
still applies to v2, not to the explicitly enabled v3 policy.

## Current public contract

- GET /health: process health only; not a claim that ERP sources are available.
- GET /v1/executive/snapshot: authenticated SELF calendar, notes and assigned
  procurement follow-ups; at most30 visible records with coverage metadata.
- GET /v1/assistant/actions/daily-summary: deterministic personal recommendations
  and separately authorized weekly sales/current contractual balance sections.
- GET /v1/assistant/actions/sales-analysis: confirmed discounted contractual sales
  by currency, with optional authorized logged-CALL lead conversion.
- GET /v1/assistant/actions/receivables-follow-up: current contractual balances,
  explicitly not Finance-approved accounting receivables or due schedules.

Version1 accepts only fixed paths without query/body selectors. Version2 adds
GET /v2/assistant/actions/{same-action} with strict startDate/endDate/originId/
destinationId/branchId selectors and GET /v2/assistant/filter-options. Dates are
inclusive completed Tehran days (max90), compared to an equal previous period.
Current balances never become historical; route conversion is explicitly unavailable. Existing version1
responses and Web validation remain compatible. Missing sources, denial, empty
records and incomplete coverage remain distinct. Refund-adjusted net sales,
accounting receivables and contractual-balance recommendation rules are gated.

## Internal boundaries

- tools.mjs: six legacy read contracts plus three filtered versions and filter options; input schema, permissions, scope,
  fixed operation, output validator/projector, errors and transport limits.
- authorization.mjs: access-cookie extraction, native IAM identity validation,
  fixed personal-source preflight and corporate permission requirements.
- erp-client.mjs: only registry operations and native identity; configured bases,
  GET only, redirect refusal, no-store, byte cap and bounded transport.
- tool-executor.mjs: strict per-tool input, fresh identity before and after each
  read, output validation/projection, branch-revocation check and tool outcome.
- server.mjs: HTTP dispatch, request limits, aggregate composition and final
  permission/source rechecks before response release.
- actions.mjs and recommendations.mjs: deterministic summaries, Tehran-day
  urgency, source-priority promotion, evidence and source/rule deduplication.
- personal/sales/balances/conversion-source.mjs: owned response projections.
- audit.mjs: allowlisted request metadata and stable tool IDs, never raw bodies.

All source reads pass through the executor. There is no generic public
execute-tool endpoint. Registry permission declarations do not replace native
ERP source authorization. Panel visibility does not grant corporate access.
Missing/unknown source priority is omitted, never presented as recorded NORMAL.

Tools: calendar and notes require native SELF/source access; procurement requires
native assigned-follow-up access. sales.weekly requires sales.contracts.read.all;
sales.contract-balances additionally requires sales.payments.read;
customer-affairs.call-conversion additionally requires customer_affairs.lead.read
and retains native authorized-branch scope. Personal row caps are1000/500/100;
report source caps remain enforced by ERP. A selected branch must be within the freshly authenticated actor branches.

## Local runtime

Run node services/assistant/server.mjs with server-side environment:

- ERP_API_BASE_URL=http://127.0.0.1:4000/api/v1
- ERP_REPORTS_API_BASE_URL=http://127.0.0.1:4301/api/v1
- ERP_AUTH_API_BASE_URL=http://127.0.0.1:4301/api/v1
- ASSISTANT_PORT=4300

Web uses ASSISTANT_SERVICE_URL=http://127.0.0.1:4300. The ERP-owned read entrypoint
apps/api/dist/assistant-read/main.js retains native IAM and read-only database
sessions. Database credentials never enter the independent assistant. Keep the
existing Core running. Deploy the versioned read API, assistant and Web builds
together; preserve their previous revisions for rollback.
Only nora_access is forwarded. Same-site cookie deployment remains required;
no relaxed CORS/cookie policy or synthesized service-account grant.

Errors include400 for invalid v2 filters and retain401/403/404/405/429/502/503 semantics. Limits:8 concurrent requests,
60/IP/minute,12/user/minute,2.5 seconds per read,10 seconds per request,
512KiB upstream body. Web retains its128KiB response cap and12-second deadline.
No automatic retry or sensitive-data cache. Limits are process-local; a shared
limiter, HTTPS ingress and retained controlled audit sink are prerequisites for
multi-instance deployment. A circuit breaker is not implemented.

## Verification and next gates

Run node --test services/assistant/*.test.mjs; syntax-check every .mjs file.
The dedicated workflow discovers all tests. Existing HTTP tests retain real
loopback transport, isolation, revocation, source coverage and money validation.
The main CI also exercises the isolated PostgreSQL-to-Web contract integration.

No migration or dependency change is required. Roll back the read API, assistant
and Web processes together to their previous tested revisions. Core and database
are unchanged; v1 remains compatible. Deployment follows green final-head and
merged-tree CI; business data acceptance is separate.

Simulated orchestration is prepared below. Company ownership, approved Finance
sources, real model processing/cost policy and production pilot remain gates.
See ../../docs/tasks/ASSISTANT-TOOLS-1013.md.

Versioned filter contract and rollout: ../../docs/tasks/ASSISTANT-FILTERS-1013.md.

## Gated conversation preparation

POST /v2/assistant/conversation has bounded JSON and native IAM, but the runtime
ships without a provider and returns503 CONVERSATION_DISABLED. Synthetic tests
inject a planner; prepared-actions.mjs shares existing read compositions with
orchestrator.mjs. No real message or ERP data goes to a model. The separate Web
conversation component is not mounted pending policy approval. See
../../docs/tasks/ASSISTANT-ORCHESTRATOR-1013.md for activation and pilot gates.

## Groq synthetic evaluation — 2026-10-14

A Groq adapter is available only through explicit trusted test injection; server.mjs does not load it. Use groq-synthetic-eval.mjs --synthetic-only with the local ignored key environment for fixed fictional cases. No arbitrary prompt or ERP client is included in that CLI. Provider access currently returns403 in this environment; live inference is not validated. Policy and activation gates remain closed. See ../../docs/tasks/ASSISTANT-GROQ-TEST-1014.md.

## Live messages-only opt-in — 2026-10-20

The default remains disabled. The owner has approved Groq for message/session text only. Set ASSISTANT_CONVERSATION_ENABLED=true, ASSISTANT_MODEL_PROVIDER=groq, ASSISTANT_DATA_POLICY=messages-only and a private GROQ_API_KEY in the service environment. This supersedes the earlier synthetic-only runtime gate for this explicit opt-in. No ERP tool result is sent to Groq. The current source policy replaces REPLY text with a fixed request for an internal panel, workflow or report. ACTION and CLARIFY preserve the existing fixed contracts. Six-second model deadline, no retries. Quick reports remain usable if the provider fails. See ../../docs/tasks/ASSISTANT-LIVE-CHAT-1020.md.

## Workbench procedural guidance —2026-11-15

The additive POST /v1/assistant/workbench-guide accepts only version1/topicId/goal and returns a validated tool selection; it does not read Workbench records. The canonical static guide catalog is also rendered by the Web, including the approved internal fallback when Groq is unavailable. Native IAM and request limits still apply. A custom runtime must pass workbenchGuide: workbenchGuideConfiguration() from workbench-guide.mjs to createAssistantServer to enable model selection; without that configuration it stays internal. The configuration reuses Germany-only egress admission. No employee message, document, medical information or free-text question is sent to Groq by this tool. See ../../docs/tasks/NORA-WORKBENCH-GUIDE-1115.md for coverage, acceptance and rollout boundaries.

## Operator request quota exemptions —2026-11-16

ASSISTANT_RATE_LIMIT_EXEMPT_USER_IDS accepts a private comma-separated immutable native IAM UUID allowlist. Matched authenticated accounts bypass application user/IP request quotas and the ordinary concurrency pool; other users retain existing limits. No client username/header grants exemption. Data permissions, SQL safety and provider limits remain enforced. Invalid configuration fails startup. See ../../docs/tasks/NORA-ACCOUNT-RATE-EXEMPTIONS-1116.md.

## Persian contractual-sales period evidence

Explicit plain Persian sales-window questions use runtime calendar resolution and a bounded, same-snapshot reconciliation through the existing authorized Sales query endpoint after model-authored SQL. Unique contracts differ from currency rows. Typed financial facts preserve Groq's choice of table/list/prose while preventing invented dates/counts or discount semantics. This is not accounting revenue or the native active-panel population. See [scope and acceptance](../../docs/tasks/NORA-SALES-EVIDENCE-1117.md).
