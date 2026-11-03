# MISSED-CALL-REQUEST-ACTION-1103

The owner requests a Register Request action in the missed-callback KPI dialog, matching the existing dossier New Request flow. Source only: push, develop PR and merge after all CI/CD gates; no site publication.

The action is supplied only for the existing workflow and team-management permissions and only in missed-callback mode. It uses the server contact ID and selected call context, opens the shared WorkflowEditor, and retains its owner selection, required reason, idempotent save and server authorization. Other KPI actions are unchanged. Cancellation restores the current callback list; successful saving refreshes it and emits the existing workflow-changed event for queue/KPI consumers. No API, schema, grant, dependency or production changes.

Validation includes manager versus ordinary-user rendering, other KPI modes, missing-contact safety and exact selected-contact handoff, plus affected Web lint/typecheck/build and final-head hosted gates. Scope freezes on publication and reservation ends on verified develop merge.

Source verification: 19 focused Web/read-client/i18n tests, scoped ESLint, full Web TypeScript and optimized production Web build pass. Hosted final-head checks remain the merge prerequisite.
