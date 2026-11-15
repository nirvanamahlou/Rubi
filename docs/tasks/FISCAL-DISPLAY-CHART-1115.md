# FISCAL-DISPLAY-CHART-1115 — PC-D

Owner requests: one header option for each real fiscal period with its default marker; Persian fiscal-boundary display; exact Rahkaran GROUP/GENERAL structure in the three root-company ledgers, with no new subsidiaries and existing data preserved.

## Reference and implementation

Read the live Rahkaran chart on2026-11-15 at the owner-provided COA page. Expand only the13 groups; observe36 direct general-account children. All49 codes/titles match the previously captured reference. Store a bounded groups/general catalogue separately in `data/accounting/rahkaran-group-general-1115.json`; no subsidiary or detail-type rows are included.

The header now selects the actual period ID. It no longer inserts a second option labeled with the default year. The default marker remains on that actual period; choosing the default clears the personal temporary override. Undefined/loading/error/aggregate states keep a non-selectable placeholder.

`AccountingDate` reuses the native calendar preference/formatter for ledger allocations and date columns in base lists. Stored ISO dates, edit payloads, sorting, filters and fiscal bounds are unchanged. Persian2026-03-21 and2027-03-20 display as the first/last days of1405; Gregorian display remains available through the existing preference.

The Accounting-owned planner accepts only GROUP/GENERAL reference rows, validates codes/parents/natures/types and fails before writes on an existing code mismatch. It never updates/deletes saved accounts. IDs are book-local and replay planning is idempotent. The operator runner requires an explicit database, existing authorized actor/branch and preview/apply mode; it invokes native `createBook` and `save-account` commands, retaining locks, validation, command replay and audit. No new user, role, login credential or permission grant is created.

## Authorized live reference-data result

The owner explicitly requested these definitions in all three companies. A read-only preflight found two existing books, two custom accounts in Jahan Bastan, and no Ghesati Ro book. All49 desired codes were free in each destination. The existing owner's real IAM financial permissions and branch were verified using IAM's public Finance directory.

| Company | Final groups | Final generals | Final subsidiaries | Preserved old accounts |
| --- | ---: | ---: | ---: | ---: |
| Niyayesh Seir Sahar | 13 | 36 | 0 | 0 |
| Jahan Bastan | 14 | 37 | 0 | 2 |
| Ghesati Ro | 13 | 36 | 0 | 0 |

The new third book uses native company ownership and code3. The academy continues to share its parent's book. All147 requested definitions were created through native commands. Existing Jahan accounts retain their IDs, fields, attributes, versions and timestamps. No subsidiary, journal, balance, financial default or fiscal allocation was created/edited by this import. The operator's company selection was restored, and the real UI was checked under each of the three companies; the final browser view is Niyayesh's populated chart.

This is a bounded master-data operation, not an application deployment. New header/date code still requires separately authorized publication. No schema/migration/dependency changes, CI dispatch, PR or merge are part of the current authorization. Standing task-only commit/push applies.

## Validation

All3 planner tests and the isolated native PostgreSQL integration test pass. The latter proves native book creation,147 requested account commands across three synthetic books, existing-account preservation, zero subsidiaries/journals and replay safety. All16 focused Web/English-coverage tests pass, including a single actual default option, undefined/historical states, actual ledger allocation markup and Persian/Gregorian date rendering. Scoped ESLint, API/Web typecheck, API build, Web production build, runner syntax and diff checks pass. The dedicated synthetic PostgreSQL fixture is stopped. No GitHub CI was dispatched. No schema, migration, dependency or lockfile changes were needed.
