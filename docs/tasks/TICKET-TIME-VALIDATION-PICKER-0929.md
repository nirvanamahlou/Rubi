# Ticket time validation and edit calendar — 2026-09-29

`COMPUTER_ID=PC-A`; branch `codex/pc-a-ticket-time-validation-picker-0929`. Scope is limited to Ticket Catalog Web/model/tests and this bounded task documentation. No API, shared contract, schema/migration, permission, dependency/lockfile or operational data changed.

## Result

- Normalize a published offer's arrival wall time when it is entered on the departure date but earlier on the clock, or when legacy data stores arrival on the previous calendar date. The arrival is moved to the correct following day, and changing the departure date keeps the arrival date aligned.
- Convert the normalized Tehran wall time to UTC on save and preserve the original instant when the displayed wall time did not change. Clear stale validation feedback as either time changes.
- Render the ticket edit calendar as a fixed, positioned popover in the dialog's top layer, placing it within the viewport and recalculating after scrolling/resizing. Outside click and Escape close it; Escape returns focus to the trigger.

## Validation

- Full Web test suite on the final branch synchronized through `origin/develop@1e262f0b`: 1,795 passed, 3 optional skips across 292 files.
- Targeted tests after the edge cases: 16 passed across published-catalog model and shared/ticket date-picker suites.
- Scoped ESLint and strict Web typecheck passed after the final code change.
- Web production build passed on the final branch, generating all 55 routes.
- Authenticated live-browser interaction was not run. The attached screenshot was reviewed; the calendar's former local absolute positioning was the clipping source. The shared positioning logic has existing viewport-boundary tests.
- No migration or data backfill is required; the edit normalizes the wall time before validation/persistence.

## Handoff

PR targets `develop`. Owner explicitly requested merge. Push and create the PR, wait for required CI checks, then merge and record the final PR/merge identifiers here and in the central status documents.
