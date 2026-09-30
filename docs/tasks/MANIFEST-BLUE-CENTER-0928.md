# MANIFEST-BLUE-CENTER-0928 — PC-A

Default flight/bus/train XLSX headers use the Office Blue Accent 1 Darker 25% RGB #2F5496 with white bold text. Header and passenger cells are centered horizontally and vertically. Sheet direction stays LTR. Supplied airline workbook templates and their output styles are explicitly excluded and unchanged.

Only default-manifest.ts styles and the existing focused style assertion changed. All 28 manifest tests passed, including supplied workbook exports and financial gating. No schema/migration/dependency/shared contract or operational-data change. Final lint/typecheck/build, CI and rollout results follow.

The local runtime currently predates the separate ticket commission migration. This styling correction can be cherry-picked onto a dedicated local runtime branch without introducing unrelated schema-dependent changes; preserve existing local next-env and runtime files.
