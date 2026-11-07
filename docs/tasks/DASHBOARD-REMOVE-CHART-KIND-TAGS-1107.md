# Remove chart-kind tags from Dashboard — 2026-11-07

Remove the blue chart-kind badge from the shared Dashboard visualization card, covering all Dashboard charts. Retain chart-kind labels in accessible names, captions and calculation details. Preserve the separate amber `DEC-OPEN` badges, which indicate pending business or architecture decisions associated with affected visualizations.

This is presentation-only. No chart type, data, calculation, permissions, API, storage or runtime behavior changes.

Validation: Dashboard focused tests passed (19 passed, 1 pre-existing skipped); scoped ESLint, contracts build, Web typecheck and Web production build (67 routes) passed; `git diff --check` passed.
