# SOURCE-SHARE-LEGEND-1105

Owner: PC-C. Base: develop 9f71ecf5e. Branch: codex/pc-c-source-share-legend-1105.

The user explicitly approves the attached source-share card reference as a change to the preserved Call Center UI. Implement only the multicolor donut/legend presentation. Values remain from the existing scoped report; do not copy the reference's example categories or totals into runtime data. Keep unknown and small sources. Existing chat approval covers tests, develop PR, green-gate merge and bounded Web publication.

Scope: source-share-chart component, leaf CSS, meaningful chart regressions, own coordination notes and bounded Web release helper. Preserve the sidebar, KPI cards, expert table, permissions, filters and aggregation. No migrations, dependencies, API or operational data changes.

Implementation replaces external SVG leader labels with a visible semantic RTL legend. The ring is cropped to a compact 200-square view box with a thicker band and vivid blue/green/sky/amber/purple palette, extended for additional categories. Source names, counts and one-decimal percentages remain tied to the original report denominator. Long labels and numeric values wrap in narrow cards; mixed-direction labels use bidi isolation. Only chart leaf styling changes.

Validation: five chart and four existing report aggregation tests pass; 117 of118 wider targeted checks passed initially, with the translation inventory timing out under local memory pressure (isolated rerun pending). Scoped ESLint, Prettier and diff whitespace checks pass. Actual component preview was checked with synthetic five-source, dominant unknown/seven-source and empty reports in light/dark themes and390px viewport; no page/card horizontal overflow. Full Web build/typecheck, hosted final-head gates and release receipt pending.
