# Ticket time validation and edit calendar — 2026-09-29

`COMPUTER_ID=PC-A`; branch `codex/pc-a-ticket-time-validation-picker-0929`. Scope is limited to Ticket Catalog Web/model/tests and this bounded task documentation. No API, shared contract, schema/migration, permission, dependency/lockfile or operational data changed.

## Result

- Normalize a published offer's arrival wall time when it is entered on the departure date but earlier on the clock, or when legacy data stores arrival on the previous calendar date. The arrival is moved to the correct following day, and changing the departure date keeps the arrival date aligned.
- Convert the normalized Tehran wall time to UTC on save and preserve the original instant when the displayed wall time did not change. Clear stale validation feedback as either time changes.
- Render the ticket edit calendar as a fixed, positioned popover in the dialog's top layer, placing it within the viewport and recalculating after scrolling/resizing. Outside click and Escape close it; Escape returns focus to the trigger.

## Validation

- Full Web test suite before the final legacy previous-day edge case: 1,772 passed, 3 optional skips across 290 files.
- Final targeted tests after that edge case: 16 passed across published-catalog model and shared/ticket date-picker suites.
- Scoped ESLint and strict Web typecheck passed after the final code change.
- Web production build passed before the final pure date-normalization edge case; final commit CI is required to verify the integrated head.
- Authenticated live-browser interaction was not run. The attached screenshot was reviewed; the calendar's former local absolute positioning was the clipping source. The shared positioning logic has existing viewport-boundary tests.
- No migration or data backfill is required; the edit normalizes the wall time before validation/persistence.

## Handoff

PR targets `develop`. Owner explicitly requested merge. Merge after all required checks on the final PR head pass; then verify the merge commit and update this report, `WORK_ASSIGNMENTS.md`, and `docs/PROJECT_STATUS.md` with the final commit identifiers.
