# Enterprise assistant — deterministic MVP foundation

Owner PC-C; base develop8deea508; user-approved staged plan on2026-10-12.
Current processing policy: no data sent to any model. Do not select a Provider,
install agent/vector frameworks, or interpret roadmap approval as approval of
unresolved financial definitions or a production rollout.

## Current status superseding the initial foundation below

The following foundation sections describe the original2026-10-12 candidate.
[Phase1 continuation](ASSISTANT-PHASE1-COMPLETION-1012.md) supersedes its blocked
Sales adapter status with permission-controlled Sales, call conversion and separate
contractual balance projections. Finance-approved accounting receivables and net
refund adjustments remain deferred; owner reconciliation is not certified.
[Phase2](ASSISTANT-PHASE2-1013.md) adds the approved deterministic date/source-priority
policy, explainable top5 recommendations and fixed executive currency comparisons.
Balance recommendations wait for real data and approved rules. No-model processing
continues; unresolved access/retention/pilot decisions are not implicitly approved.

## Deliverable and boundary

One independent read service and fixed capability dispatcher. Existing
GET /v1/executive/snapshot remains compatible. New authenticated fixed GET routes:

| Action | Service path | Outcome | ERP source / side effects |
| --- | --- | --- | --- |
| Daily summary | /v1/assistant/actions/daily-summary | READY or PARTIAL, SELF | Existing calendar/notes/assigned procurement APIs; no writes |
| Sales analysis | /v1/assistant/actions/sales-analysis | BLOCKED, SALES_DEFINITION_REQUIRED | IAM only; no financial read until metric/source/scope acceptance |
| Receivables follow-up | /v1/assistant/actions/receivables-follow-up | BLOCKED, RECEIVABLES_SOURCE_PENDING | IAM only; no synthetic financial result |

Web transport: GET /api/assistant/actions/[action], exact three-name allowlist,
access cookie only, no query/scope/prompt/body, no-store and bounded deadlines.
All routes reject anonymous identities. Service revalidates IAM before each
personal source read and before releasing evidence or a blocked result. Existing
source permissions, rate/concurrency limits and response caps are unchanged.

Daily counts describe only the visible, deduplicated maximum30 follow-ups,
including overdue and next-seven-day events. They do not describe all company
work or an entire day of sales. Response includes source states, observation
UTC time, truncation, coverage, counts and rule-linked recommendation priorities:
OVERDUE_V1/HIGH, DUE_SOON_V1/MEDIUM, ASSIGNED_V1/LOW. Priority proposes review,
never executes an ERP operation. Web rejects unreconciled counts, invalid rule
priorities, missing source evidence and unsafe drill-down links.

Quick buttons execute actual fixed capabilities. Exact ready-request labels can
also dispatch from Send; arbitrary free text stays local and is not transmitted.
No chat response or model interpretation is simulated. Source failures are
PARTIAL; missing data is not a corporate zero. If all sources fail, UI hides count
cards. Request replacement/unmount aborts in-flight reads; denying access remounts
the composer and removes prior results. Audit contains actor, correlation, action,
tool outcomes and elapsed time; no titles, notes, draft, cookie or financial data.

## Discovery evidence and open acceptance inputs

Reporting has sales_by_organization (CONTRACT_CURRENCY, public projection v2)
and other sales catalog entries. Metadata is not source acceptance. Its preview
path is read-only (recordAction=false); preview-run/export/share/history paths
have side effects and are excluded from the assistant. Sales amounts, currency
segregation, cancellation/refund policy, server actor scope and the chosen public
projection must be reconciled before binding an assistant corporate tool.

receivables_payables, due_checks, account_balances and cash_position are still
PENDING_CONNECTION in the inspected catalog. Finance must publish an approved
balance/due-date projection; no direct Finance tables, reconstructed balances or
broad service account substitute is allowed. Owner sales-definition question is
pending; no default-selected answer counts as approval.

## Ordered implementation / acceptance tracking

0. IN_PROGRESS: processing policy confirmed as no-model; financial definitions,
   reference totals, permitted company/branch scope and CEO output acceptance open.
1. PARTIAL: three personal source reads and typed fixed-action transport available;
   corporate sales/receivables adapters remain blocked by source/metric acceptance.
2. PARTIAL: deterministic personal summary/counts/priorities over bounded evidence;
   corporate rules require valid corporate sources and approved thresholds.
3. NOT_ENABLED: future single-agent model/tool orchestration requires a new data
   processing approval. Fixed dispatch is not a language model or free conversation.
4. PENDING: pilot, retained audit sink, monitoring, shared distributed limits,
   HTTPS/Secret handling, rollback/load/restore and business sign-off.
5. PENDING: authorized/versioned documents, RAG retrieval/ACL/citations/evaluation.
6. PENDING: approved ERP events, scheduling, deduplication and recommendation feedback.
7. PENDING: verified actual executive metrics by source, currency and company scope.
8. PENDING: held-out forecast/baseline evaluation and conditional scenario model.
9. PENDING: approved news sources, dates/links and evaluated impact method.
10. PENDING: narrow write tools, policy/approvals/idempotency/audit/compensation.
11. PENDING: domain-specific personas/tools and isolation; multi-agent only if needed.

## Validation and handoff

Synthetic fixtures only. Service HTTP tests cover reconciled/capped counts,
priorities/deduplication, partial-source failure, denied/revoked identity,
cross-user isolation, route/scope/write abuse and safe audit. Web tests cover
response reconciliation, safe links, matched action identity and fixed proxy.
No real ERP login, financial reconciliation, CEO pilot, model call, Production
load/security certification, schema/migration or dependency change is claimed.
Actual test/build/CI and authorized merge/runtime evidence belong in the PR.
