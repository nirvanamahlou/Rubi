# Combined local runtime, 2026-09-13

PC-B. The user requests all latest sections on localhost:3100. Integration branch:
`codex/pc-b-all-sections-3100-0913`.

The combined source preserves `develop@060fc35c`, Workbench performance from
`f174c3fe`, Customer Affairs form/report updates through `eeb8c56b` and its published
handoff, and Finance inbox completion through `977bfeab`. Merge conflicts were
limited to additive status/assignment documentation; both sides were retained.
No application code conflict required a new implementation.

Use the existing local database `nora_hr_current_20260908` on port 55432 and the
existing `hr007-documents` storage. The database inspection reported no pending
migrations. No seed, role assignment, fixture load, credential change or new
migration is part of this activation. Finance's separately documented role
assignment request remains separate from starting the application.

Web3100 must target API4191. Both applications must run from this combined
checkout, rather than the previous two separate runtime checkouts. Credentials
remain in the existing private API environment file.

Frozen dependency installation passed. The targeted suites passed 32 API tests
and 66 Web tests. Final build, typecheck, lint and runtime checks are recorded in
the completion update below. Full monorepo build passed all six tasks, and API
typecheck passed after generated package declarations were rebuilt. The first
typecheck ran before that prerequisite finished and saw stale Prisma declarations;
the sequential rerun passed. Scoped API/Web ESLint and launcher syntax checks passed.

During HTTP smoke, Node Fetch rejected port 4190 as a bad port. It is listed in
the [Fetch restricted-port table](https://fetch.spec.whatwg.org/#port-blocking).
The launcher now accepts an API port and defaults to 4191. The private Web
environment was updated accordingly and Web rebuilt. No browser protection was
disabled. API4191 health returned 200 and login CORS preflight returned 204.

The original running checkouts remain available for rollback. A corrupt internal
Codex checkpoint ref containing only NUL bytes was backed up under ignored tmp
and removed to restore Git fetch; no branch or user working file was removed.

## Activation verified

Web3100 PID18772 serves build unified-LYH1PTQ_i1saQILyrG74V from code/launcher commit 2fd10a9f. API4191 PID15828 serves the combined API against the existing database/storage. Final Web build passed all 46 routes. HTTP smoke passed login/runtime 200, all 13 selected protected module routes 307, API health 200 and Performance/Finance guards 401. No operational account credentials were used, so this is startup/route verification rather than end-to-end testing of every feature. Chrome automation is not connected; the login page was opened in the available in-app browser.

