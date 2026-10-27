# HR payroll worksheet — PC-B — 2026-10-27

User-approved reference: final interactive payroll-settings mockup. Production implementation carries its settings list → Add payroll → Persian year/month and real authorized branch → spreadsheet path, with no seeded period, employee, salary or account data.

## Scope and contracts

Additive private HR `/hr/payroll-worksheets` GET/POST, `/:id` GET/PATCH and versioned `/:id/approve` / `reopen` POST. Producer HR API and consumer HR settings UI use the additive exported worksheet types and exact integer-rial calculator. Existing payroll resources and Finance submission interfaces remain compatible and unchanged. Existing approved Finance requests are not produced, rewritten or paid by worksheet approval.

Existing HrRecord stores one unique `PAYROLL-<branch UUID>-<Persian period>` sheet under the dedicated payrollWorksheets namespace. Real Branch FK is retained. The existing generic HR record scope excludes the namespace, preventing bootstrap/detail/update/delete and employee self-service from treating it as a generic record. The leaf APIs require native read/manage plus HR sensitive access and actual actor branch membership. No grants are added.

AES-GCM encrypts all row names, time inputs, amounts and accounts with branch + record ID associated data; only period, row count, last editor and status are public metadata. Four aggregate IRR projections use existing HrRecordAmount Decimal(24,4). Audit contains only record ID, version, row count and action. Creation takes an advisory lock on the stable unique business key and returns the existing sheet on retry. Updates are transactional CAS on version and draft status; identical immediately preceding-version retries by the same editor replay the saved snapshot. Conflicting edits retain the browser draft and report the conflict.

Snapshots permit at most 500 UUID rows, strict input/rate allowlists, bounded integer monetary strings, Persian digit normalization, HH:mm minutes and 0–31 days. Rates are versioned snapshots, with the reference workbook defaults; this is not a current statutory tax engine. Spreadsheet calculated columns cannot be supplied or overridden. All 28 original nonblank Excel columns (including sequence) remain; blank spacer AB is omitted. Explicit bank/account fields remain text. Names are user-entered worksheet labels, not fabricated employee profiles.

The calculator uses BigInt rational arithmetic with integer-rial rounding, preserving the reference formulas, including the negotiated residual called کارانه and the algebraic cancellation of advances in net pay. Remaining payable is shown separately in a card as net less advance. Employer contributions never reduce employee net. Tax remains manual as in the source. No current-rate claims, automatic payments or guessed attendance integration.

## UI behavior

Settings retains Nora shell/tabs and adds the new sheet list, empty creation, direct cell edit, automatic save with retained failed drafts, Enter row navigation, multirow tab-separated paste, atomic validation before paste, add/delete row with confirmation, computed cells, colored totals, editable coefficients, CSV export and browser print. No sample reset/data-download buttons or instructional subtitles. Sensitive users without management permission receive read-only access. Approval requires native approve/manage/sensitive and a reviewer different from the last editor; empty or incomplete/negative-pay sheets cannot be approved. Approved sheets lock until explicitly reopened.

## Validation and rollout

Focused arithmetic/input/persistence/privacy/replay/CAS/scope/review tests and server-rendered empty/permission checks pass. Full affected suites, scoped lint, API/Web types and production builds plus exact-head hosted gates are required before merge. Local Docker is unavailable, so no operational database or runtime changes were attempted. No schema/migration/dependency/lockfile changes. No server deployment is requested.

Storage-bound verification: existing SQL limits each HrRecord.data to8KiB and disallows negative HrRecordAmount values. New saves atomically replace individually encrypted child records (real parent+branch FK, server-generated storage IDs and retained logical row UUIDs), leaving rates/count in the encrypted parent. Repeatable-read details prevent mixed revisions; the existing generic namespace exclusion covers parents and children. Maximum500-row and160-character payload regressions assert every stored object remains within8KiB. Signed negative draft totals use explicit `<field>Negative` positive-magnitude Decimal projections, while snapshot/cards retain the signed result. No constraint is weakened and no migration is needed.
