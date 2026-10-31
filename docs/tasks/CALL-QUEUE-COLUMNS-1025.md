# Call Center request queue columns — 2026-10-25

CALL-QUEUE-COLUMNS-1025, PC-C. Owner-requested queue presentation only:

- RTL order: request title, assigned expert, status, priority, request creation timestamp.
- Existing request-click dialog and queue views retained. Branch and next follow-up deadline are removed only from the displayed queue columns; authorization and underlying response compatibility remain.
- Server ordering is createdAt descending, then id ascending for deterministic ties. Editing an old request does not promote it. Existing permission scope, all-authorized-branch behavior, filters and50-row paging remain unchanged.
- Additive queue response fields priority and createdAt use persisted request facts. Creation time is rendered through the existing Tehran date formatter, with an explicit unknown fallback for an older API.
- Previous/next controls and current/total page count are centered below the rows. Existing responsive layout and all other panel sections are retained. Two new English labels accompany the existing translation system.

No schema, migration, dependency, operational data, IAM, PBX or popup changes. Current approved local runtime is the rollout base; retain previous build artifacts for rollback. No PR/merge/production deployment requested.

Validation:19 real isolated PostgreSQL workflow tests pass, including creation-order/tie regression;3 Web workflow tests pass. Scoped API/Web lint, API TypeScript build, Web TypeScript and65-route compilation pass. Read-only check of the two existing local requests confirms valid priority/timestamp and newest-created ordering. Local runtime and visual verification recorded in PROJECT_STATUS.
