# Accounting account setup — 2026-10-11

Owner: PC-A, sole writer. No delegated agents. Continuation of the existing accounting branch.

## Delivered locally

The Accounts menu now routes to dedicated editors for detail types, detail accounts, account groups, subsidiary mappings, detail groups and detail-type conversion definitions. Three dedicated lists cover detail types, details and conversions. Field names and list columns were transcribed from authenticated, read-only Rahkaran UI observations; raw captures remain outside Git.

- Detail types: title, second-language title, default first code, parent type, classification-number length (including zero), parent enforcement and description. System titles are immutable. All 26 observed system definitions were registered only in the isolated reference book.
- Details: type, parent, activation, code, classification number, title, second-language title, default currency and description. Observed entity-backed title controls use selectors. Person/company and sales-channel choices use public Rubi APIs with their existing permissions.
- Account groups: code/title editor, account hierarchy selection and per-account detail assignments. Detail groups: type-filtered candidate grid, explicit add/remove selection and persisted membership.
- Mapping: source subsidiary accounts, target subsidiaries in another accessible book, target detail levels 4–6, source detail path drill-down, batch selection and account-property display. Prefix rows remain reachable after saving a deeper mapping. Changes are atomic and version checked.
- Conversion definition: user/system types, derived entity, server date, description and notes, with a versioned list and guarded definition deletion.
- Notes: title/date/text dialog and server-owned creation/update audit columns. Attachments reuse the Documents boundary and permissions; setup records show title/file/author/date columns.
- Lists: recursive filters, inline filters, sorting, column visibility, multiple selection, count and pagination. Shared icon toolbar and existing keyboard shortcuts remain in place.

## Evidence and remaining parity work

The main six forms and three list schemas were read. Dependent group allocation, detail candidate grids, note dialog and mapping level-four drill-down were also observed. The source contained no stored group, mapping or conversion examples. No example records were fabricated locally.

The source session expired again while checking every system detail type's conditional title selector. Confirmed selectors include person/company, inventory, project, settlement method, sales office/channel, division and product/customer account groups. Some of those entities have no verified public Rubi source yet: their selector explicitly reports the missing connection and is not populated with made-up entries. Other conditional types still require source verification. Person/company choices currently persist the selected title, not a new cross-module owner FK.

Only seven conversion entity mappings are verified (person/company, branch, cost centre, project, funding source and fiscal year). Unsupported/unverified entity mappings cannot be saved. This change defines conversions only; execution against business entities or historical journals was not observed and is not implemented. The generic Rahkaran conversation/process/history framework tabs are not replicated. This is therefore a reviewable implementation of observed account setup, **not a claim of complete pixel or behavioural parity**.

The user has been asked to restore the expired source login; remaining source-dependent work awaits that session. No source writes, source financial values, transaction imports, old-book edits, role grants, operational deployment or merge occurred.

## Storage and verification

Two additive Accounting migrations introduce FK-backed mappings/conversion definitions and group detail allocations. The second replaces the initial mapping uniqueness with source-path uniqueness and backfills the path key before making it mandatory. Both were applied only to the isolated accounting PostgreSQL instance. Do not edit these applied migrations. Snapshot additions are optional for old clients.

Validation completed: 52 PostgreSQL integration tests, 15 focused Web model/filter tests, scoped API/Web lint and typechecks, Contracts/Database/API builds, and a 57-route Web production build. Browser checks on port 3100 verified 26 type definitions, filtering, clear/count/multiselect shortcuts, system type editing, new group allocation tree, mapping level-four drill-down, derived conversion entity and the note dialog. Final UI follow-ups are typechecked and rebuilt before committing.

Existing shared localization development key warnings were observed; no new accounting runtime exception was found. Raw evidence, import receipt and screenshots are outside Git. The reference book retains 222 accounts and no details, periods or journal transactions; only the 26 observed type definitions were added in this unit.
