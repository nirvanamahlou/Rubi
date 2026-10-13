# MASTER-DATA-QA-REMEDIATION-0922

## Scope

Remediate the confirmed Master Data QA findings without schema, migration,
contract, permission, dependency, seed, or operational-data changes.

## Delivered

- Restored focus to the invoking control when Master Data form and profile
  dialogs close.
- Connected validation errors and field guidance to inputs, reference
  comboboxes, selects, dates, numbers, and role fieldsets.
- Disabled native browser form validation so Persian application validation is
  consistently shown.
- Added accessible names to every Master Data table.
- Prevented Geography filter grids from overflowing the desktop content area.
- Removed the obsolete airline organization column and reference-code copy.
- Consolidated room-type creation into the hotel form and removed the
  standalone room-type navigation.

## Verification

- Master Data Web: 46 files / 362 tests passed.
- Master Data API: 34 files / 446 tests passed.
- Scoped Web ESLint and Web typecheck passed.
- Prettier check for every changed TypeScript/TSX/Markdown file passed.
- Production Web build passed with 50 routes.
- Static accessibility rescan reports no unnamed Master Data tables. The two
  remaining select findings are scanner false positives for Radix Select roots;
  both rendered triggers have explicit accessible names.
- A clean Web runtime started on port 3101 and reached the normal login gate.
  Authenticated browser retest was not claimed because the existing browser
  session did not transfer and no real credential was used or reset.

## Handoff

Review the dialog focus behavior and Geography width once with an authenticated
session after deploying the branch. No migration, data task, or downstream
consumer coordination is required.
