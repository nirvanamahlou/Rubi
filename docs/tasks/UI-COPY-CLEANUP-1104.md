# UI-COPY-CLEANUP-1104

Owner request: remove the text and gaps in44 annotated browser comments; push and merge to develop. Presentation only; no business data, permissions, calculations, API, schema or production rollout.

## Annotation coverage

- 1–2: organization buyer helper paragraphs removed.
- 3: dashboard data-connection banner removed; actual errors/forbidden/empty/stale states and per-metric availability remain. Empty banner section no longer consumes layout space.
- 4–5: receivable date-basis helper and default latest-ten-contract helper removed; filtering unchanged.
- 6–7: passenger correction description/helpers removed; correction fields unchanged.
- 8–12: payment history/add-payment/search/attachment helper text removed; cash-account fix, receipt submission and Finance confirmation unchanged.
- 13–14: customer contract-output explanatory paragraphs removed; output contents and download unchanged.
- 15: ticket-price commission explanation removed; commission rules unchanged.
- 16: tour-pricing selection helper removed.
- 17: tour definition helper removed; distinct departure editor helper preserved.
- 18–23: four tour KPI captions, departure subtitle and scope footer removed.
- 24–30: call-center header subtitle, four KPI captions, scope line and search helper removed.
- 31–34: report description, time-bound caption, expert attribution helper and metric explanation removed; report-grid spacing tightened and expert card no longer stretches to adjacent card height.
- 35–36: hotel Excel import helper paragraphs removed.
- 37: destination fields above the full-width responsive hotel selector; hotels use available columns and retain scrolling on narrow screens.
- 38: saved hotel-package helper removed.
- 39: branch selector aligned at the start of its row instead of auto-pushing it across an empty mode bar.
- 40: issued-ticket report eyebrow removed.
- 41–42: duplicate annotations on the same ticket create/edit description removed; separate view-mode description retained.
- 43–44: purchase statistics helper and purchase page eyebrow removed.

Dialog titles retain accessible naming; removed descriptions do not leave dangling aria-describedby references. Existing tests referencing removed prose now assert functional headings/controls instead. No new tests that merely mirror static copy deletion.

## Validation

Full Web TypeScript and scoped lint passed. First local affected-suite run:382 passes, one obsolete copy expectation and four load-related timeouts; expectation aligned with the actual heading and affected tests rerun with bounded concurrency. Responsive visual review used actual destination/hotel components and module CSS with synthetic hotel fixtures, at desktop and390px mobile widths. No production forms or payments submitted.

All final-head hosted checks required before authorized merge. Source reservation releases on verified merge.

Final local outcome: all387 affected checks passed across the initial run and focused reruns; the nine purchase-workspace tests pass with a30-second CLI budget on this loaded workstation. Repository CI limits were not changed. Final scoped lint/format and Web TypeScript pass. Desktop/mobile layout reviewed without operational data.
