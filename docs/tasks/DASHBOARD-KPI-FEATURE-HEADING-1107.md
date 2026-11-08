# Dashboard KPI feature heading typography — 2026-11-07

Reduce the visual heaviness of the “فیچرهای استفاده‌شده در فرمول” heading across all KPI definition panels by using the same semibold sans-serif treatment as the panel's regular emphasized text. This is a presentation-only edit; feature content, formulas, calculations, data and permissions remain unchanged.

Validation: focused Dashboard tests passed (19 passed, 1 pre-existing skipped); scoped ESLint passed; contracts build passed; Web typecheck passed; Web production build passed (67 routes). `git diff --check` passed. Prettier `--check` reported formatting warnings in the two existing large TypeScript files; no broad formatter rewrite was applied for this one-class change. Ready for review.

## CI integration — 2026-11-08

Original quality failure was a missing Markdown blank line in the own WORK_ASSIGNMENTS heading. The old push test failed on an unrelated missing English reservation label (ترانسفر همراه رزرو هتل), already translated in current develop. Integrate current develop without restoring stale Dashboard sources; keep the heading assertion stable across formatter whitespace. Final-head hosted checks are required before the user-authorized develop merge. No server deployment.

Integrated validation:103 Dashboard/i18n tests passed with one pre-existing skip; scoped ESLint, current-contract Web typecheck and changed-file formatting passed. Contracts compiled locally in the isolated worktree. Hosted full quality/tests/PostgreSQL and production Web build remain final-head merge gates. No dependency/schema/runtime changes or deployment.
