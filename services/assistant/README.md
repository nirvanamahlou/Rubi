# Independent assistant service

Node 24 native HTTP service; no package installation, database access, model
provider, user-content persistence, arbitrary URL/SQL execution or write tools.

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
existing Core and read entrypoint running during this service-only rollout.
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

No migration or dependency change is required. Roll back by restoring the prior
assistant process revision; Web/Core/read API contracts are unchanged. Deployment
follows green final-head and merged-tree CI; business data acceptance is separate.

Next unit: simulated conversation/orchestrator. Company ownership, approved Finance
sources, real model processing/cost policy and production pilot remain gates.
See ../../docs/tasks/ASSISTANT-TOOLS-1013.md.

Versioned filter contract and rollout: ../../docs/tasks/ASSISTANT-FILTERS-1013.md.
