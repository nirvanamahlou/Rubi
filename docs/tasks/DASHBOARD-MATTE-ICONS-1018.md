# DASHBOARD-MATTE-ICONS-1018

PC-C; base origin/develop@187e31bd; branch codex/pc-c-dashboard-matte-icons-1018.

The user approves concept2, matte navy/teal three-dimensional icons, for KPI cards and chart headers throughout Dashboard. Scope is decorative presentation only.

## Implementation

- Local RGBA artwork: apps/web/public/images/dashboard-icons/matte-enterprise-v1.png (1536×1024, under2MB).
- Dashboard artwork resolver explicitly maps stable KPI/chart IDs to24 semantic symbols; fallback is reserved for future registrations.
- DashboardArtworkIcon displays reviewed source regions at48px, with no focus target or redundant accessible label. Existing adjacent titles provide names. The atlas is one cacheable same-origin request, not a request per icon.
- Navigation/action icons and growth-direction indicators retain existing behavior and presentation. Source data, formulas, access and currency semantics do not change.
- No new package, public API, schema or migration.

## Acceptance and verification

All84 KPI IDs and all registered chart IDs must have explicit artwork. Sales, collections, refunds and receivables remain visually distinct. Light/dark, Persian/English and narrow headers must remain usable. KPI details and chart details continue to open as before. Focused Dashboard tests, lint, Web types/production build, visual localhost proof, latest-head CI and postmerge CI gate delivery.

## Artwork provenance

Generated with built-in image_gen from the human-approved concept2 board. Prompt: produce24 isolated matte navy/teal ceramic3D symbols in a6×4 transparent atlas, with white paper and restrained gold currency accents; fixed row-major sales/receipt/profit/collection/refund/receivables/contract/customers/conversion/trend/channels/services/expenses/balance/commission/ticket/cancellation/calendar/tasks/support/hotel/flight/risk/performance. Follow-up removes background/glow while preserving designs and positions. Only the resulting local artwork is consumed; concept-board labels and values are not UI data. PNG alpha was inspected; background sample points are transparent.

## Rollback

Revert this bounded presentation commit and rebuild Web. No data rollback is needed. Existing production runtime stays available until its replacement build is ready.
