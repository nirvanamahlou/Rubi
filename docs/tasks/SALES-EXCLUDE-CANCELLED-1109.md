# Sales dashboard cancellation parity — 2026-11-09

PC-A; codex/pc-a-sales-exclude-cancelled-1109 from develop0fb77974b. User explicitly authorizes develop merge and production release after testing.

The list excludes effective Reservations cancellations using the latest intake/workflow, while dashboardRows previously returned them as active Sales contracts. Apply the same existing Reservations public reader to dashboardRows and exclude both Sales CANCELLED and effective reservation cancellation rows. Counts and operational monetary summaries now consume the same eligible rows; a later REOPEN remains eligible. Preserve company/archive/branch/owner predicates, immutable financial records and explicit cancelled-list access. No data/schema/dependency/permission changes.

Reserve repository.dashboardRows, its regression tests and own task/status notes. Prior list cancellation scope is published; no active competing repository writer identified. Validate targeted API regressions, final-head full hosted gates and bounded API production overlay with backup/rollback/health and unchanged source/runtime checks. No unrelated develop rollout.
