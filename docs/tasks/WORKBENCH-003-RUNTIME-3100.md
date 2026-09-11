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

## Validation and cutover status

- 100 tests passed: 3 Workbench gate/isolation/integration tests and 97 Organizations
  regression tests. The initial test pass needed the Contracts dist output in this
  fresh worktree; building existing Contracts resolved that setup failure.
- Full Web lint, typecheck and production build passed. HTML is included in Next
  output tracing; inherited B2B/HR/API sources and lockfile have zero changes.
- Source commit `769c72d313018c7af34ddf492fd89d6d36683a3a`; runtime manifest
  `hr005-fa78528a419acdbb`; review Web3310 PID14384. `/login` returns200; anonymous
  `/tasks`, `/workbench/demo`, `/organizations` and `/hr` preserve redirects to login.
- Before cutover, Web3100 was reverified as PID20360, source7ada379 and manifest
  hr005-a63a90ce0594f86b. API4190 PID15024 health returns200.
- Automatic approval review rejected the guarded stop-and-replace command with
  only “blocked by policy”. That command did not execute; Web3100 remains unchanged.
  Direct user confirmation was requested for only PID20360 and the tested replacement.
  Do not delegate the rejected operation or claim the runtime was transferred.
- Chrome verification is pending the transfer. The previously reported browser
  control limitation has not been bypassed. Original preview3301 is retained.

The user directly approved the exact PID20360-to-tested-build transfer. Automatic
approval review nevertheless rejected the second guarded command before execution,
again only “blocked by policy”. No further workaround or delegated stop is attempted.
The user must stop the old web listener manually before this agent can start3100.
The running candidate remains3310/PID14384; built source769c72d is unchanged by the
subsequent documentation-only commits. Preserve that build identity when launching.

## Completed transfer after manual stop

The user reported completing the manual stop. A fresh listener check confirmed3100
was free. Started only the verified candidate Web on3100: PID28232, source
769c72d313018c7af34ddf492fd89d6d36683a3a, manifest hr005-fa78528a419acdbb.
The served runtime identity matches; login returns200 and the Web error log is empty.
API4190 remains PID15024 and health returns200. No data or API change occurred.
Exact entry: http://localhost:3100/workbench/demo (existing authentication applies).
The original Tasks workspace also exposes the opt-in Workbench link.
Chrome-specific visual confirmation is reported separately; runtime readiness does
not assert that a Chrome tab was opened. Review3310 and preview3301 are retained.

## Menu follow-up

User reports the sidebar Workbench still opens `/tasks`. The existing route now
redirects to `/workbench/demo` when the runtime opt-in is enabled, so the extra
intermediate workspace/link is removed. With the flag disabled, the original
Tasks workspace remains. Regression test checks the exact redirect and fallback.
No shared navigation, API, permission or data change. Refresh only task-owned3100.
