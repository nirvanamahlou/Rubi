# FLIGHT-MULTIPLE-CABINS-1003

PC-A; owner requests a new-flight form that accepts Economy 20 and Business 5 together, with independently editable prices below the same flight in Sales ticket pricing. Merge to develop is explicitly authorized after validation.

The existing inventory model is one published offer per flight cabin. The form will compose multiple compatible single-cabin definitions, using the existing validation and idempotent publication flow. Prices, tier capacities, sales and allocations remain scoped to each offer. No database migration, API change or shared-contract expansion is required. Existing records remain readable without backfill.

Scope: Ticket Catalog Web creation form and cabin helper/regressions, Sales ticket pricing row order/class labels and regressions, bounded assignment/status records. Primary checkout changes and active local runtimes are preserved. No reference/master-data editing, dependency/lockfile change, operational-data mutation or main deployment.

Validation and handoff will be recorded after implementation.
