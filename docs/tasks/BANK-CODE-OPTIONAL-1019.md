# BANK-CODE-OPTIONAL-1019

COMPUTER_ID=PC-B. Owner requests optional bank code with push/develop merge; while work is active, also requests hiding the circled payment-card internal code and adjacent avatar, retaining them in View.

## Changes

- Bank code stays editable but is no longer required in the form or API. Missing/null/blank code on creation uses the existing unique BANK code generator; blank/omitted edit preserves the current code. Explicit codes retain normalization, format and duplicate checks.
- Name and country remain mandatory, and bank-branch codes are unaffected. Existing stored codes, references, permissions, branch/audit/version rules and financial-account data are unchanged. No schema, migration or dependency changes.
- Payment-method cards no longer render their internal code or logo/initial avatar. Name, status, description and View/Edit/Delete remain; the existing View profile still displays the code and logo.

## Verification / delivery

- Focused API service:58 tests passed, including optional-code variants, collision fallback, edit identity preservation and supplied-code errors.
- Focused Web:38 tests passed, including required-field policy, manual-code validation and payment-card/profile separation.
- Added disposable PostgreSQL bank create/repeated-name uniqueness/edit/audit regression; hosted database gate must pass. No operational database is used.
- Affected lint/types/build and all exact-final-head hosted checks gate authorized develop merge. Final evidence and merge hash are recorded on the PR; reservations release with the merged candidate.
- No server or3100 deployment is performed by this request.
