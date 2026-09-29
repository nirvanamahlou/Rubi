# MASTER-003P-CLEAR-FIELDS

PC-B — `codex/pc-b-master-data-clear-fields`

## Scope

- Add an accessible clear-selection button to Master Data create/edit forms: enum selects,
  required/optional references, multi-reference and organization-role selectors, dates,
  currency status/quote fields, and hotel-import selections. Preview uses the same behavior.
- Clearing changes the draft field, not the referenced record. Required fields still block
  submission until reselected. Empty, readonly and saving fields never offer clearing.
- Buttons are keyboard operable, non-submit controls with Persian names and a 44px touch
  target. Focus returns to the field; the clear button is outside select/calendar triggers.
- Hotel-import country clearing also resets its dependent city and preview. A cleared
  duplicate-handling choice cannot be committed until selected again.
- Backend, public contracts, schema, migrations, seed, Customers and shared UI remain unchanged.
  New Web-only Vitest configuration enables real TSX rendering tests without a dependency change.

## Verification

- Isolated checkout of `687a183`, excluding other concurrent local work.
- Frozen install: passed; no lockfile change.
- Web tests: **175/175** across 37 files, including 20 new tests covering rendering, clearing,
  disabled/readonly/empty states, focus restoration and required/optional validation.
- Web typecheck and scoped lint: passed. Production Build: passed, including all Master Data routes.
- Full Web lint: existing shared `date-picker.tsx:67` state-in-effect error and `:99`
  unsupported aria-required warning remain out of scope.
- Diff whitespace and scoped secret-pattern scans: passed. No records or seed data deleted.
- Local API health and Login: HTTP 200. Unauthenticated `/master-data` redirects to Login;
  no authenticated end-to-end smoke is claimed. Existing local servers remain running.

## Stacked delivery and locks

Depends on **#43** (`codex/pc-b-master-data-payment-form`, parent `b78d0a9`) and transitively **#25**.
Open as Draft with that branch as base, **not develop**. Do not merge before the parents.
Retarget to `develop` only once the applicable parent stack is merged. Do not force-push,
delete source branches or change parent branches/main.

The three active `PC-B/MASTER-003` locks remain unchanged; no migration/dependency lock is
newly acquired. Web test configuration was explicitly reserved in `WORK_ASSIGNMENTS.md`.
Other concurrent local modifications (supplier collaboration/deletion work) are not part
of this commit/PR and are not staged, reset, stashed or overwritten.
