# MASTER-003-LIST-VISIBILITY

Date: 2026-08-31. Owner: PC-B / MASTER-003.
Branch: `codex/pc-b-master-data-list-visibility`, based on `790c20a` (PR #54).

## Diagnosis and correction

The local Master Data audit contains the reported airport creation. The data was
not lost. Finance sent two KPI queries and Geography sent four with `pageSize=1`,
while both the HTTP DTO and Web query schema require 10–100. The rejected KPI
request caused their `Promise.all` load to clear the successful main list.

The six KPI call sites now use `masterDataApi.listSummary`, which always requests
page 1 with the valid minimum size 10. It preserves sorting and scope filters,
returns the server's actual total, and lets Finance read the first latest record.
Main lists retain their existing pagination, filters and post-save reload.
The helper calls the existing endpoint; no API contract or permission is changed.

## Verification

- Before correction, source regressions found both invalid Finance sizes and all
  four invalid Geography sizes. The new client-path test initially failed too.
- Web regression: minimum page sizes in both workspaces; create followed by
  concurrent list/KPI reload; the saved row and real response totals remain
  available; inherited pagination is overridden without losing country filters.
- Nine HTTP regression cases use the real Nest ValidationPipe and verify that
  size 1 is rejected before the service, while size 10 reaches it for countries,
  regions, cities, airports, terminals, currencies, banks, bank branches and
  payment methods. HTTP tests use a test-only actor and mocked service, not a
  bypass of the running application's authentication.
- Full suite: 958 passed (API 533, Web 349, Contracts 14, Database 59,
  Config/Worker 3). 57 optional PostgreSQL tests skipped in the generic run.
- Typecheck passed after correcting an exact-optional-property typing in the new
  test's parsed-query collection; production build passed for all applications
  (34 Web routes). Scoped Master Data Web lint and HTTP-test lint passed.
- Full lint still fails on the pre-existing shared DatePicker's synchronous
  effect update (line 67) and unsupported aria-required on button (line 99).
  That file belongs to the separate CALENDAR-001 scope and was not edited.
- API health on port 4000 and Login on port 3100 returned 200. Existing API/Web
  processes remain running. The in-app test browser redirected Geography to
  Login; no authenticated browser end-to-end pass is claimed.
- Formatting, `git diff --check`, and the eight-file scope/secret/payment-number
  scan passed. The new fixture is synthetic; no user-entered values are included.

No application records were reset, seeded, deleted, or edited. No new Migration,
dependency, lockfile, Customers, IAM or shared UI changes are included.

## Merge handoff

The user requested merge to develop after correction. The stack through PR #54
is still Draft with no review approval. Repository policy requires review before
merge. Original parent PR #25 is merged, but that approval does not cover its
descendant features. A read-only `git merge-tree` check against
`origin/develop@5f9cb723de39e29cff95f26b047138699bd36392` also found conflicts in:

- `WORK_ASSIGNMENTS.md`
- `docs/PROJECT_STATUS.md`
- `apps/api/src/master-data/master-data.xlsx.ts`

No parent branch, PC-A branch, main or develop was modified. No force push,
source deletion or automatic merge is permitted as a workaround. Review and
ordered integration/conflict resolution of the stack remain necessary.
The existing PC-B/MASTER-003 locks remain active; Dependency/Lockfile stays released.
