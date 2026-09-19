# Customer 360 entry sheet — PC-A — 2026-09-06

## Scope

User requested simple spreadsheet-like customer/passenger entry. Branch
codex/pc-a-customer-entry-sheet-0906 starts from the verified local integration.
Only Customers Web UI, local validation/tests and task documentation change.
No producer branch, API, database, migration, permission, dependency or public
publication is changed.

## Interaction

- Create-person entry uses one labelled table with a main customer row and
  independent passenger rows. Name, family name, national ID, birth date,
  passport, phone and email are aligned in columns with horizontal scrolling.
- Add/remove passenger rows; removal requires confirmation. The previous
  nine-row UI cap is removed. Keyboard Tab remains native; Enter never submits
  the entire batch implicitly.
- The first passenger can reuse the primary customer. Its identity cells become
  read-only and mirror the customer row. Switching person requires confirmation
  and clears stale draft data/documents, preventing wrong-person attachments.
- Birth-date cells open the existing Persian/Gregorian calendar directly in a
  separate dialog so it is not clipped by the table's horizontal scroll.
- Only the selected passenger's optional document/relationship panel is shown.
  Unsupported person-organization controls are removed rather than appearing
  as disabled mandatory-looking fields. Existing organization creation and
  existing-record edit/view paths are retained.
- Preflight checks reject blank names and duplicate normalized national IDs
  before the first create call. Existing national ID checksum, passenger birth
  date, passport and document validation remains. Busy state disables the form.

## Persistence and limitations

All writes still use public Customers and Documents APIs, with existing
encryption/masking, access checks and optimistic versions. No PII is persisted in
browser storage or URLs. No real customer was created for QA.

Creation is still the existing multi-request workflow, not an atomic bulk API.
An interrupted save can leave completed server records; the existing partial-save
warning is retained. This task does not claim server-side bulk idempotency.
DEC-OPEN-006 production identity/document policy remains unchanged.

## Verification

- Customers scoped lint and Web typecheck passed.
- 100 Customers tests passed, including six new table/preflight tests.
- Full Web suite: 725 tests in 102 files passed.
- Authenticated browser visual QA is unavailable; do not claim a real user-session
  screenshot or completed real-customer save.
- Production build passed (36 routes) after moving the backup outside the Web
  TypeScript source glob. Web 3100 restarted with the new table in its built
  assets; Customers request redirects to login with HTTP 200, API health is 200.
  API process was not restarted. Final status: COMPLETE_LOCAL; no public push.
- Previous Web build retained in ignored tmp/customer-entry-next-before-0906;
  API and operational data remain untouched.
