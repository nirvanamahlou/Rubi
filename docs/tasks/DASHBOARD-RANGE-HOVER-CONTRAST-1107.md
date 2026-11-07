# Dashboard date-range hover contrast — 2026-11-07

## Scope

The Dashboard date-range dropdown options (today, this week, month, quarter, year, custom) use white text while hovered or highlighted, matching the blue highlighted background. Selection, keyboard navigation, date logic, other dropdowns, API, and data remain unchanged.

## Implementation and validation

The `dashboard-range` SelectItem explicitly sets white text on both the item and its visible label during Radix `data-highlighted` state. This is scoped to the date-range dropdown. The existing Dashboard source regression verifies both classes.

Dashboard tests: 19 passed, one pre-existing skipped. Scoped ESLint, Web TypeScript, Prettier on both changed TypeScript files, and the production Web build (67 routes) passed. No server deployment.
