# CALL-FORM-DOCK-1025

PC-C; explicit user authorization: add minimize beside call-dialog close and a persistent left-edge restore control throughout ERP panels. AppShell now hosts call editors in a user-keyed, memory-only provider. Manual drafts can survive their originating route unmounting when minimized. Telephony forms use the same host while retaining their original claim/leader/save lifecycle; no incoming-popup rollout or technical widget is restored.

React Activity preserves mounted field/control state while hidden and suspends dialog effects, releasing modal interaction locks. Restore reveals the same form. Close/save removes the item; failed saves leave it available. The host serializes displayed forms and offers separate restore buttons for minimized entries. Saving disables minimize. Original branch/call-specific callbacks and server permission/version checks remain in use. Account changes unmount the session host. No localStorage/sessionStorage or backend draft persistence is introduced; reload/closing still warns for pending forms. Internal same-origin navigation is permitted for hosted drafts.

Scoped files: shell provider integration, call form and launchers, optional navigation guard mode, new host/CSS and English labels. No migration, API or dependency change. Existing generated next-env.d.ts modification is excluded.

Validation:55 existing call-center tests pass; the added minimize/non-submit/saving-disabled test also passes (56 total). Scoped lint passes. Build/browser acceptance pending.

Completed:56 tests total, scoped ESLint including new test, TypeScript and full65-page production build pass. Browser acceptance: opened manual form, typed synthetic unsaved subject/note, minimized, navigated by internal CRM link to /workbench, restored with both values intact, minimized again; dock remained fixed at physical left. No browser console errors. No call saved during acceptance; own review tab closed. Screenshots tmp/call-form-dock-1025/{minimized,restored}.png remain outside Git.

Local Web3000 PID19440 runs isolated F:/Projects/Rubi/tmp/call-form-dock-1025/apps/web with .next-request-reason-1025; API unchanged. Full reload/closing ends in-memory drafts (guarded); same-tab ERP route navigation preserves them. No browser storage or migration.
