# PERIOD-DRILLDOWN-1025

PC-C; branch codex/pc-c-period-drilldown-1025.

Today/week KPI cards open the existing call-list modal with one row per call, newest first, dossier and existing-call edit actions. Today starts at Tehran midnight; week starts Saturday. Server owns bounds and ignores contact-list filters. Synthetic/future calls excluded. Count and detail require the intersection of report and contact access; this narrows previously report-only today/week counts where contact access is more restrictive, without expanding privileges.

Authenticated POST today-calls and week-calls reuse the internal paginated read implementation (page, pageSize, revision). Revision includes period and starting boundary, detecting midnight/week rollover. Existing DTO and response shape remain compatible. Editing uses the existing completion/version checks, preserves the original call and refreshes list/card after saving. Cancel restores the list.

Validation: 15 isolated PostgreSQL tests include period count/list agreement, exact boundaries, branch rejection, empty scopes, sorting and stale paging. 15 Web tests include transport scope/cancellation for both endpoints. Scoped lint, API compilation and Web build/typecheck required before local runtime replacement.

No migration, dependencies, PBX, automatic popup settings, PR or merge. Preserve generated next-env.d.ts and other worktrees. Incoming automatic popup remains disabled and previously enabled outbound behavior unchanged.

Final: scoped lint/API compilation and Web typecheck/build (65 routes) pass.30 tests pass. Browser verified both period lists, existing-call edit and cancellation. Local runtime Web24728/API25836 with previous popup flags preserved. Screenshot outside Git: F:/DevData/Temp/period-drilldown-1025.png. Dossier action reuses existing workspace selection. No operational record saved during checks.
