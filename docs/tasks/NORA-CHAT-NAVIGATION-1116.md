# Nora chat lifetime — 2026-11-16

Owner requires messages and the unsent draft to remain visible across internal ERP pages/tabs until a full browser-tab refresh. The shared CRM layout already preserves the floating chat component, but the Workbench tab was included in its React remount key and route/contract context reset filtered away local/Agent messages. A separate12-message UI truncation also removed earlier displayed exchanges.

The remount key now depends only on the native account, company/context version and sorted branch/permission scope. Navigation updates the minimal procedural/contract context and aborts obsolete requests without deleting the transcript or draft. All displayed exchanges remain in React memory; no localStorage/sessionStorage, database or server history is introduced. A full refresh starts a new transcript. Account/company/authorization changes and native401/403 continue to clear protected state. A changed display label or grant ordering is not a new security scope.

The provider history budget remains12 bounded non-local messages through conversationHistory. Keeping the full displayed transcript does not enlarge the model payload or send local Workbench guidance to the model.

Tests cover native scope isolation/order stability and display retention beyond the provider budget. The existing Assistant regressions, lint, typecheck and hosted build/test gates remain required. Browser acceptance should verify Workbench-tab navigation, another ERP section, unsent text, and a full refresh on the published revision. No producer workflow, dependency, migration, IAM grant or business-row changes.
