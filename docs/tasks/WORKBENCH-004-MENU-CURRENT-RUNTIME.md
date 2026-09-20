# WORKBENCH-004 — Restore direct Workbench entry on current runtime

PC-B; branch codex/pc-b-workbench-menu-current-runtime from56d5d48. User reports
Chrome menu opens old/tasks. Previous verified Workbench runtime769c72d/PID28232
was replaced by B2B runtime56d5d48/PID12500. Preserve the new B2B date filters and
restore only demo files plus direct opt-in redirect from/tasks. Original workspace
remains when demo is disabled. The demo stays synthetic, isolated and nonpersistent.

B2B runtime owner was notified for handoff; do not replace without coordination.
Prior demo validation is documented in WORKBENCH-003-RUNTIME-3100.md. Revalidate
current code and current runtime before delivery. API4190/data/storage unchanged.

## Candidate verification

103 tests passed (3 Workbench +100 Organizations), scoped ESLint and Web typecheck
passed, production build passed. Candidate source8bf0446, manifest
hr005-bb55ee21ac2d4f77, review3310 PID7564. In-app browser with existing session
navigated to http://localhost:3310/tasks and visibly arrived at /workbench/demo
with the expected eight-section Workbench. No credentials were fabricated.
B2B/HR/API/packages/lockfile have zero diff from runtime base56d5d48.
Cutover awaits explicit runtime coordination; no restart of12500 attempted yet.

## Delivery

The B2B owner confirmed56d5d48 is the latest executable source (later commits only
documentation) and paused further3100 changes. Reverified live source56d5d48 and
PID12500/Next command line, then replaced only that Web listener. New Web3100:
PID14212, built source8bf0446e9dbbfb61b68b1b42e43143c910b476dd, manifest
hr005-bb55ee21ac2d4f77. API4190 remains PID15024; health200.

Actual in-app browser test on3100: dashboard → click sidebar “میز کار” → /tasks →
/workbench/demo, with expected Workbench content visible. Same client navigation
was tested on3310 before cutover. This is browser evidence, not a claim of native
Chrome automation. An already-open Chrome tab may need a reload to drop its old
client route cache. No source/data/schema/permission changes outside scope.
