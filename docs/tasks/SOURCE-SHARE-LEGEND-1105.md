# SOURCE-SHARE-LEGEND-1105

Owner: PC-C. Base: develop 9f71ecf5e. Branch: codex/pc-c-source-share-legend-1105.

The user explicitly approves the attached source-share card reference as a change to the preserved Call Center UI. Implement only the multicolor donut/legend presentation. Values remain from the existing scoped report; do not copy the reference's example categories or totals into runtime data. Keep unknown and small sources. Existing chat approval covers tests, develop PR, green-gate merge and bounded Web publication.

Scope: source-share-chart component, leaf CSS, meaningful chart regressions, own coordination notes and bounded Web release helper. Preserve the sidebar, KPI cards, expert table, permissions, filters and aggregation. No migrations, dependencies, API or operational data changes.

Implementation replaces external SVG leader labels with a visible semantic RTL legend. The ring is cropped to a compact 200-square view box with a thicker band and vivid blue/green/sky/amber/purple palette, extended for additional categories. Source names, counts and one-decimal percentages remain tied to the original report denominator. Long labels and numeric values wrap in narrow cards; mixed-direction labels use bidi isolation. Only chart leaf styling changes.

Validation: five chart and four existing report aggregation tests pass. The local wider run passed117 of118 tests; translation inventory timed out under memory pressure, including an isolated retry. The same unchanged tests all passed in the production candidate:118 tests across29 files, including translation coverage. The resource-constrained local full build was stopped after hosted and server production builds succeeded. Scoped ESLint, Prettier and diff whitespace checks pass. Actual component preview covered synthetic five-source, dominant unknown/seven-source and empty reports in light/dark themes and narrow widths with no page/card horizontal overflow.

## Release receipt — 2026-11-05

- Source: fab9d49980e950f1b088ef9e75e7245247b47610; PR1415; merge e58613d1e208199f06f9b8677a67ad5c4dee397a.
- All eight final-source hosted checks passed: push and PR quality/types, full production build, full suite and PostgreSQL18 migration/seed. Runs42003293763 and42003364789. Merge guard reverified the exact source and clean mergeability immediately before merge.
- Web image: rubi-production:source-share-legend-1105. Previous panel-scope image retained for rollback. API/worker/database/scanner services and configuration unchanged; no migrations applied.
- Encrypted server-only backup: /opt/rubi/backups/before-source-share-legend-1105-1793871578. Verified receipt: /opt/rubi/source-share-legend-1105/verified.json.
- Build/typecheck,118 candidate tests, loopback canary, all three source hashes, old/new static assets, worker authentication, AMI and recording timer passed. Free disk7,526,539,264 bytes after release.
- Authenticated live browser: seven categories and109 contacts at observation, desktop1625px and mobile390px; page/card horizontal widths equal their scroll widths. No console errors. Temporary device/theme overrides reset. Final screenshot: source-share-legend-live.png in the task visualization directory.
- No business records were edited. Reservation released; next work starts from refreshed develop and must preserve this source-share presentation and current live overlays.
