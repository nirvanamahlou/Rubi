# DASHBOARD-LIVE-SOURCES-1027

COMPUTER_ID=PC-C. Owner asks to diagnose and fix the production Dashboard showing no data despite entered ERP records. Base296d2d35f; independent branch codex/pc-c-dashboard-live-sources-1027.

## Root cause

Read-only live database inspection confirms reporting_travel_facts has no rows. ReportingRepository.facts reads only that table; dashboardProjection returns early on empty facts, blocking every domain. Native Customer and Sales records exist. No native producer writer populates this staging table. Seeding demo rows, copying localhost data or bypassing permission/date filters would not repair the source boundary.

## Producer/consumer contract

Add an internal versioned aggregate contract with explicit UTC window, source identity, per-domain scope, separate currency and unavailable reasons. Sales, Customers and Customer Affairs own their leaf readers and authorize before reading their own models. Reporting composes only public aggregate results. Existing travel reports remain on their original approved projection. Unsupported HR measures, journal balances and purchase costs must not be guessed. Partial source failure must not erase successful domains or masquerade as zero. As explicitly required by MODULE_BOUNDARIES (Legal Entity versus operational data), issuer context does not filter native operational records or widen branch/permission scope; these sources have no issuer-ownership FK. No invented company attribution is made.

No schema/migration/dependency/permission change. Preserve the approved Dashboard layout. Tests must cover source-empty versus missing, cross-domain independence, branch/own isolation, date boundaries, unsupported filters and currency/refund grain. Live deployment must be verified separately from source tests and Git publication.

## Verification and operational handoff

- Reporting regression: 64 tests in 11 files passed, including producer-module Nest wiring and independent visual-only requests.
- API scoped ESLint, full typecheck and build passed. Current Contracts and Prisma packages were generated/built in this worktree; verification used temporary external tsconfig path mappings because reused node_modules resolve to an older worktree. No tracked dependency configuration changed.
- Dashboard/i18n regression: 63 passed, one existing skip, in 10 files. Web full typecheck and scoped lint passed. Unavailable is not presented as an empty successful result. Generated offline catalogues were synchronized with the repository generator, retaining its existing-source inventory corrections as well as four new translations. Web production build is checked separately.
- No migration, seed, permission grant, production write or active server deployment. Read-only audit found a concurrent server release after the initial investigation; do not overwrite that deployment or infer its version from this branch.
- Publish a draft PR to develop. Merge and production activation remain separate gates; existing restricted SSH tools cannot install a new approved deployment plan. Root approval through the established VNC workflow is required before activation, with a fresh encrypted backup, shared deployment lock, pinned current release, health checks and rollback path.

## Deliberate limits

Sales covers confirmed contract cohorts (confirmed, sent-to-reservations, in-progress, completed), not drafts/cancelled contracts. Source discounts are applied once by Sales' canonical balance calculation; net subtracts completed allocated refunds through the period end. This is cohort value, not recognized accounting revenue. Customers and leads use their actual registration dates independently of Sales. Collected revenue, recognized gross profit, posted account balances and HR metrics need their respective approved sources and are explicitly unavailable, not inferred from arbitrary operational records. Unsupported dimensions fail closed; no silent unfiltered totals. Sources refuse more than 10,000 selected records rather than returning truncated totals. Monetary totals remain exact decimal strings; unsafe numeric chart/comparison values are withheld.
