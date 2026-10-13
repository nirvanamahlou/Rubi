# FLIGHT-MULTIPLE-CABINS-1003

PC-A; owner requests a new-flight form that accepts Economy 20 and Business 5 together, with independently editable prices below the same flight in Sales ticket pricing. Merge to develop is explicitly authorized after validation.

The existing inventory model is one published offer per flight cabin. Both weekly-schedule and advanced creation forms compose multiple compatible single-cabin definitions, using the existing validation and idempotent publication flow. Prices, tier capacities, sales and allocations remain scoped to each offer. No database migration, API change or shared-contract expansion is required. Existing records remain readable without backfill.

Scope: Ticket Catalog Web weekly and advanced creation forms and shared cabin capacity controls and cabin helper/regressions, Sales ticket pricing row order/class labels and regressions, bounded assignment/status records. Primary checkout changes and active local runtimes are preserved. No reference/master-data editing, dependency/lockfile change, operational-data mutation or main deployment.

Implemented Add/Remove Cabin controls (Economy/Business/First), per-class capacity and combined seat total. Duplicate canonical cabin classes, inactive/missing references and non-integer/out-of-range capacities fail before publication. Recurring schedules expand every deduplicated flight into independent cabin offers; trip-group suffixes prevent mixing cabins in outbound/return pairs. Existing idempotent publication keys and partial-failure retries remain in use.

Sales keeps the first-seen flight order, groups cabins together in Economy/Business/First order, and shows class, total class capacity and remaining class capacity. Offer IDs continue to key separate base/tier price drafts, revisions, commissions and allocations. Existing tickets need no conversion or backfill.

Validation after develop integration: 199 tests in 29 files pass (Ticket Catalog plus ticket pricing/commission regressions), including 20 Economy + 5 Business inventories, duplicate/invalid rows, recurring/shared return expansion, stable retry details, same-cabin round-trip groups, rendered controls and two independent price cards. Full Web lint passed; final scoped lint passed; Web typecheck and the 55-static-route production build passed with Webpack. The default local Turbopack build could not traverse dependency junctions outside its root; Webpack was used without a tracked configuration change. GitHub's normal production build checks also passed. No authenticated live data creation or operational database changes were performed.

PR: https://github.com/nirvanamahlou/Rubi/pull/571 targets develop. The owner explicitly authorizes merge after all final-head CI checks pass. Scoped locks release with the handoff commit. Other computers can pull develop; no migration, new environment variable or dependency installation is required. Primary checkout and running services are preserved.
