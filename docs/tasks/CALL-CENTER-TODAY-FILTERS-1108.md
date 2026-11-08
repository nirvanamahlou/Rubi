# CALL-CENTER-TODAY-FILTERS-1108

COMPUTER_ID=PC-C. User explicitly authorizes three filters in Today Calls, beside and to the right of refresh. This is the approved UI exception for this scope under CALL-CENTER-UI-PRESERVATION.md.

## Behavior

- Direction, outcome (including unrecorded) and current displayed connected-to destination are local to Today Calls; all defaults retain the unfiltered day.
- Changes clear stale rows, reset page and snapshot, abort the previous request and read fresh results. Refresh retains choices.
- Server applies direction/outcome to authorized call rows; current destination hydration and matching occur before count and paging in bounded batches. Stable call order and call-level grain remain intact.
- Tehran day boundaries, report/contact authorization, future/synthetic exclusion, KPI totals and other dialogs remain unchanged. No extra identity access is granted.
- Existing validated optional Search DTO fields are reused. Internal Web todayCalls adds an optional fifth filter argument; old four-argument clients and response shape remain compatible. Producer Customer Affairs and consumer Call Center Web ship together.

## Validation and handoff

Local Call Center/i18n suite:176 tests pass; four dialog-mode checks added afterward. API focused tests:19 pass,13 PostgreSQL-gated cases skipped locally; added assertions run in the existing hosted PostgreSQL gate. Web TypeScript passes. API dependencies are generated/built in the isolated worktree; a missing shared nodemailer install prevents a complete local API check, so hosted API lint/types/build and actual PostgreSQL tests remain release gates. Full Linux Web production build remains a hosted gate because local dependencies are cross-drive junctions.

Draft PR targets develop. No migration, dependency/lockfile, production data changes or server publication. Final CI evidence is recorded in the PR.
