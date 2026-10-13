# Reservation contract terms for Finance (2026-10-03)

## Request and behavior

Use the supplied redesigned travel-contract terms PDF for the Reservations «مفاد» download and make the same file available from Sales’ travel-documents dialog for users authorized by Finance.

`apps/web/public/contracts/terms.pdf` contains the supplied two-page PDF without editing. Its SHA256 is `8ED0C34F4E94F9802A5CA4F9F0CF45DE9AE49FCB92E1018B4AE30D56206767DC`. Reservations already had a selected-contract-gated download link to this path; that behavior remains intact. Sales adds a clearly named download link inside the existing travel-documents dialog. The dialog opens only after the existing `sales/contracts/:id/travel-documents` server request succeeds, so this change does not bypass the current Finance authorization or financial-release rules.

## Scope and validation

Branch: `codex/pc-a-reservation-contract-terms-1003`, based on `origin/develop@bd9b4e5e`.

Focused Sales/Reservations tests (13), scoped ESLint, Web typecheck and the 55-route production build pass. Both PDF pages were rendered and visually checked; the copied asset hash equals the supplied source. No API, public contract, permission, Documents service, database, migration, dependency, financial transaction or runtime was changed.
