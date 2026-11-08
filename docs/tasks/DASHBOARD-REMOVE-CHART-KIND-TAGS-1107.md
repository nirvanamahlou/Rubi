# Remove chart-kind tags from Dashboard — 2026-11-07

Remove the blue chart-kind badge from the shared Dashboard visualization card, covering all Dashboard charts. Retain chart-kind labels in accessible names, captions and calculation details. Preserve the separate amber `DEC-OPEN` badges, which indicate pending business or architecture decisions associated with affected visualizations.

This is presentation-only. No chart type, data, calculation, permissions, API, storage or runtime behavior changes.

Validation: Dashboard focused tests passed (19 passed, 1 pre-existing skipped); scoped ESLint, contracts build, Web typecheck and Web production build (67 routes) passed; `git diff --check` passed.

## CI integration — 2026-11-08

Original eight checks were green; the branch became conflicted as develop advanced. Integrate current develop and retain only removal of the blue chart-kind badge, preserving accessible names and DEC-OPEN badges. Final-head hosted checks are required before the user-authorized develop merge. No server deployment.

Integrated validation:103 Dashboard/i18n tests passed with one pre-existing skip; scoped ESLint, current-contract Web typecheck and changed-file formatting passed. Contracts compiled locally in the isolated worktree. Hosted full quality/tests/PostgreSQL and production Web build remain final-head merge gates. No dependency/schema/runtime changes or deployment.
