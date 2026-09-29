# SIDEBAR-GROUP-TOGGLE-0908

PC-A; user requests independent sidebar group disclosure like preview3200, with whole-sidebar collapse unchanged. Based on integrated f4b033b on codex/pc-a-sidebar-group-toggle-0908, preserving final Sales, Customers and Notifications.

- Group headings are native buttons with chevrons, aria-expanded and unique aria-controls. Enter/Space work. Each group toggles independently; hidden links are removed from focus navigation.
- Whole-sidebar collapse logic/widths/tooltips are untouched. Compact mode shows all17 links even when a group is closed. Expanding restores local group state. Route changes reopen groups so active destinations are not hidden. Mobile disclosure leaves the drawer open; selecting a link still closes it.
- No storage, business data, routes, permissions, API, dependency, database or PDF setting changes.
- Validation: scoped ESLint and TypeScript pass; 11 navigation plus4 route-foundation tests pass; production build36 routes passes. Authenticated browser QA on actual3100 confirms independent toggle, keyboard, compact17 links, expanded state restoration, and mobile behavior.
- Only verified WebPID6288 was replaced with the new production Web from the integration checkout. Existing SALES_PDF_CHROME_PATH and SALES_PDF_NAZANIN_PATH preserved; API4000 and DB untouched. No legacy checkout restarted. Local commit only, no remote push/merge.
