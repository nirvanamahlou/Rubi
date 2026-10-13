# HOTEL-SHARED-PERIODS-1008

Owner: PC-A. User authorizes develop merge after validation.

- Compact hotel-filtered list shows original saved periods with exact-period edit actions. City stay-date filters remain visible; selectable shared-stay hotels are in a collapsed compact section.
- A shared stay can include hotels whose independently saved periods differ. All selected nights must have consistent occupancy tariffs; multiple periods retain their individual nightly amounts.
- Source rates and coefficients remain editable through existing version/CAS controls. Shared snapshots are immutable, carry restrictive FK links to the original batches, and are not reused as source tariffs.
- Package handoff selects the shared batch and its hotels, optionally restores a matching departure, and retains existing package preview/publication calculations and maker/checker rules.
- Example: two nights at100 plus three at200 cost800, not750; two different hotels are never averaged together. Checkout is exclusive.
- Additive migration:20261008130000_hotel_shared_period_sources. No operational database migration, cleanup or runtime rollout performed in this task.

Validation includes pure nightly pricing/coverage regressions, API permission/version/replay/transaction checks, UI editing/filter/selection/double-submit tests, existing editor/package regressions, English coverage, lint/typechecks and clean CI builds/migration gate.
