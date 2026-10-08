# PURCHASE-DASHBOARD-CENTER-1008

PC-A; base origin/develop c2764fbf. The user requests center alignment of the Purchasing & Supply dashboard. This is the Reservations-owned service-purchase summary at `/ticket-purchases`, not the Procurement-owned purchase order workspace.

Scope: local dashboard heading/subtitle and four summary cards only. Center icons, labels and counts with direction-neutral utilities while retaining the existing responsive columns and vertical spacing. The shared Card, page header/actions, category navigation, filters and service table remain unchanged. Existing server-sourced aggregate values and read authorization remain authoritative.

No schema, migrations, contracts, translations, dependencies, operational writes, runtime rollout or merge. All17 focused purchase-hub tests pass, including Persian/English summary alignment, server totals, filtering and combined-transfer rendering. Scoped ESLint, Web TypeScript, formatting and the56-route Web production build pass. The initial concurrent run hit a local test timeout; the separate rerun passed without changing time limits. The isolated production build completed successfully after correcting its environment-loading invocation. No authenticated browser validation was performed.
