# WORKBENCH-003 — Workbench demo in the full 3100 runtime

COMPUTER_ID=PC-B. Branch: `codex/pc-b-workbench-runtime-3100`.
Base: last verified full runtime `7ada379ac65102bfd081a244121c99f5485f3fc8`.

## Authority and preservation

The user requests the new Workbench in Chrome on port3100. Runtime owner task
01a086a4-fb72-7e80-8d13-db2ce47873ad explicitly handed over Web3100 after free-port
verification. The original checkout has active B2B date-filter edits; a separate
worktree preserves those changes. B2B owner task01a0818d-3940-71f0-b9dc-bdec7ddd7e61
was notified before cutover. Recheck runtime identity and PID before stopping Web.

## Scope

Only the isolated demo document/GET route from PR156 and a runtime opt-in entry on
`/tasks` (the existing Workbench menu destination) are added. The existing workspace
is retained. `RUBI_WORKBENCH_DEMO=1` enables the entry/route. Existing proxy applies;
no authentication cookie is fabricated. The document remains a synthetic in-memory
sample, CSP-sandboxed without same-origin or network access.

No shared navigation/proxy, API4190, database, document storage, schema, dependency,
permission or business-data changes. No merge to develop/main. No production
persistence is introduced. Other B2B/HR capabilities are inherited from the exact
runtime base. Preview3301 and B2B3196/4191 listeners are not replaced.

## Runtime procedure

Use the existing `infrastructure/scripts/start-hr-local.ps1` with `-Build -SkipApi`
and a verified free port. Keep API base `http://localhost:4190/api/v1` and write the
opt-in flag only to this worktree's ignored `.env.local`. Validate manifest and web
routes before cutover. Stop only the verified old Next PID20360 on3100 after checking
its original checkout command line and served manifest. Then start this build with
`-SkipApi -Port 3100`; preserve the API process and data. Retain old build for rollback.

Validation and final runtime identity are recorded after execution below.
