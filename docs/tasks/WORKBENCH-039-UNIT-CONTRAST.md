# WORKBENCH-039 — Selected department contrast

PC-B, branch codex/pc-b-workbench-unit-contrast, base develop@e82d8216.

The selected messenger department inherited white text from the primary Button but its unconditional bg-surface/80 override kept a pale background. Surface styling now applies only to unselected units. Selected unit buttons retain Nora primary/hover colors; their icons use primary-foreground with a translucent badge. aria-pressed exposes the current selection.

Validation: scoped ESLint, 50 existing Workbench tests and production Web build with TypeScript and 46 routes passed. No new tests were added for this small presentation-only correction. No API, database, dependency or shared Button changes.

Shared Web3100 currently runs from C:/Users/admin/Nora under another runtime task (observed PID18772). This source branch has not replaced that runtime; apply the scoped change to its next combined build. No previously rejected process replacement was retried.