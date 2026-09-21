# SALES-PEOPLE-SHEET-0906

PC-A; local integration branch `codex/pc-a-sales-people-sheet-0906`.

## Scope and behavior

- Reuse the Customers `CustomerEntrySheet` through its public Web entry surface in contract step three. All passenger slots appear together, matching adults + children + infants from step one; the separate payer row is not a passenger.
- Only an infant can be added in this step. Adult/child count changes remain in step one. Existing age-composition and seat-capacity rules remain authoritative.
- Person payer, first-passenger-as-customer and organization/agency payer remain supported. Existing records can be selected per row; clearing a slot does not delete the saved customer record.
- New name, national ID, birth date, passport and optional contact fields use the actual Customers table and calendar. Existing profile fields remain read-only except the contract birth-date snapshot. No sensitive-detail access bypass is introduced.

## Persistence and module boundaries

- Unsaved identity, passport and contact values stay in separate component memory and are not added to Sales localStorage. Reloading does not preserve these unsaved fields.
- Validate every active row and the age composition before creating any record. Use only the existing Customers public API, retaining its permission and branch checks.
- Save returned record identities immediately. An uncertain creation or failed contact write requires checking and selecting the existing profile before continuing; no blind retry or duplicate creation is attempted.
- The final contract retains existing customer/passenger identity references and hotel guest selection. Finance, Reservations, API endpoints, database schema, permission grants and ticket inventory logic are unchanged.

## Verification

- Combined Sales and Customers run: 208 tests passed across 31 files. Final shared-entry test run: 7 passed, including the added optional per-field read-only exception.
- Scoped lint, Web typecheck and diff whitespace checks passed.
- Production build passed for 36 routes. Web3100 now serves the new people-sheet bundle (HTTP 200); login 200, unauthenticated contract redirect 307, API health 200. API was not restarted. Previous Web build is retained at ignored `tmp/people-sheet-web-before-0906` for rollback.
- No real customer/passenger or contract was created for testing. Authenticated visual verification is not claimed.
- Delivery is local only; no public push, producer branch change, migration, seed or permission modification.
